import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260728124000_pi001_inline_curriculum_lifecycle_role_checks.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();

const lifecycleFunctions = [
  "archive_curriculum",
  "restore_archived_curriculum",
  "soft_delete_curriculum",
  "restore_deleted_curriculum",
  "permanently_delete_curriculum",
] as const;

describe("PI-001 curriculum lifecycle RPC role check migration", () => {
  it("adds an explicit caller-bound lifecycle role helper", () => {
    expect(migration).toContain(
      "create or replace function public.can_manage_curriculum_lifecycle",
    );
    expect(migration).toContain("p_user_id uuid");
    expect(migration).toContain("membership.user_id = p_user_id");
    expect(migration).toContain(
      "membership.role in ('organization_owner', 'organization_admin')",
    );
    expect(migration).toContain("membership.status = 'active'");
    expect(migration).toContain("organization.deleted_at is null");
    expect(migration).toContain(
      "revoke all on function public.can_manage_curriculum_lifecycle(uuid, uuid)",
    );
  });

  it.each(lifecycleFunctions)(
    "keeps %s fixed-search-path and authenticated-only",
    (functionName) => {
      const functionStart = migration.indexOf(
        `create or replace function public.${functionName}`,
      );
      expect(functionStart).toBeGreaterThan(-1);
      const functionBody = migration.slice(
        functionStart,
        migration.indexOf("$$;", functionStart) + 3,
      );
      expect(functionBody).toContain("security definer");
      expect(functionBody).toContain("set search_path = ''");
      expect(functionBody).toContain("auth.uid()");
      expect(functionBody).toContain("public.get_active_organization_id()");
      expect(functionBody).toContain(
        "public.can_manage_curriculum_lifecycle(v_organization_id, v_user_id)",
      );
      expect(migration).toContain(
        `grant execute on function public.${functionName}`,
      );
    },
  );

  it("does not modify historical migrations or use broad destructive operations", () => {
    expect(migration).not.toMatch(/drop\s+table|truncate\s+/);
    expect(migration).not.toMatch(/grant\s+execute[\s\S]*to\s+service_role/);
    expect(migration).not.toMatch(
      /grant\s+delete\s+on\s+table\s+public\.curriculums\s+to\s+authenticated/,
    );
  });
});
