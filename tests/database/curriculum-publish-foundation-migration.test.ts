import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260729120000_pb001_curriculum_publish_foundation.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();
const compactMigration = migration.replace(/\s+/g, " ");
const overloadFixMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260729123000_pb001_fix_curriculum_create_rpc_overload.sql",
);
const overloadFixMigration = readFileSync(
  overloadFixMigrationPath,
  "utf8",
).toLowerCase();
const compactOverloadFixMigration = overloadFixMigration.replace(/\s+/g, " ");

const publishFunctions = [
  "submit_curriculum_review",
  "reopen_curriculum_draft",
  "review_curriculum",
  "publish_curriculum",
  "create_next_curriculum_version",
] as const;

describe("PB-001 curriculum publish foundation migration", () => {
  it("replaces legacy active curriculum status with the formal publish lifecycle", () => {
    expect(compactMigration).toContain(
      "update public.curriculums set status = 'published' where status = 'active'",
    );
    expect(migration).toContain(
      "status in ('draft', 'in_review', 'published', 'archived')",
    );
    expect(migration).not.toMatch(/published\s*=\s*true/i);
  });

  it("adds publish workflow audit actions without editing historical migrations", () => {
    expect(migration).toContain("'curriculum_submitted'");
    expect(migration).toContain("'curriculum_reviewed'");
    expect(migration).toContain("'curriculum_published'");
    expect(migration).toContain(
      "drop constraint if exists curriculum_lifecycle_audit_events_action_check",
    );
  });

  it.each(publishFunctions)(
    "secures %s with server-side caller context",
    (functionName) => {
      const start = migration.indexOf(
        `create or replace function public.${functionName}`,
      );
      expect(start).toBeGreaterThan(-1);
      const body = migration.slice(start, migration.indexOf("$$;", start) + 3);
      expect(body).toContain("security definer");
      expect(body).toContain("set search_path = ''");
      expect(body).toContain("auth.uid()");
      expect(body).toContain("public.get_active_organization_id()");
      expect(body).toContain("public.has_organization_role(");
      expect(migration).toContain(
        `grant execute on function public.${functionName}`,
      );
    },
  );

  it("locks published content behind new version creation instead of overwriting it", () => {
    expect(compactMigration).toContain("v_latest_version + 1");
    expect(migration).toContain("new editable version");
    expect(migration).not.toMatch(/truncate\s+|drop\s+table/);
    expect(migration).not.toMatch(
      /grant\s+delete\s+on\s+table\s+public\.curriculums\s+to\s+authenticated/,
    );
  });

  it("removes ambiguous curriculum creation RPC overloads with a forward correction", () => {
    expect(compactOverloadFixMigration).toContain(
      "drop function if exists public.create_curriculum_with_initial_version( text, uuid, uuid, uuid, integer, smallint, integer, text, text )",
    );
    expect(compactOverloadFixMigration).toContain(
      "drop function if exists public.create_curriculum_with_initial_version( text, uuid, uuid, uuid, integer, smallint, text, integer, text )",
    );
    expect(compactOverloadFixMigration).toContain(
      "create function public.create_curriculum_with_initial_version",
    );
    expect(overloadFixMigration).toContain("security definer");
    expect(overloadFixMigration).toContain("set search_path = ''");
    expect(overloadFixMigration).toContain("auth.uid()");
    expect(overloadFixMigration).toContain(
      "public.get_active_organization_id()",
    );
    expect(overloadFixMigration).toContain("public.has_organization_role(");
    expect(compactOverloadFixMigration).toContain(
      "grant execute on function public.create_curriculum_with_initial_version( text, uuid, uuid, uuid, integer, smallint, integer, text, text ) to authenticated",
    );
  });
});
