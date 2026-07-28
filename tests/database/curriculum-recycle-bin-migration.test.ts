import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260728120000_pi001_add_curriculum_recycle_bin.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();

const lifecycleFunctions = [
  "archive_curriculum",
  "restore_archived_curriculum",
  "soft_delete_curriculum",
  "restore_deleted_curriculum",
  "permanently_delete_curriculum",
] as const;

describe("PI-001 curriculum recycle bin migration", () => {
  it("adds non-breaking recycle bin columns to curriculums", () => {
    expect(migration).toContain(
      "add column if not exists deleted_at timestamptz",
    );
    expect(migration).toContain(
      "add column if not exists deleted_by uuid references auth.users(id) on delete set null",
    );
    expect(migration).toContain(
      "add column if not exists deletion_reason text",
    );
    expect(migration).toContain("curriculums_active_recent_idx");
    expect(migration).toContain("curriculums_recycle_bin_recent_idx");
    expect(migration).not.toMatch(/drop\s+table|truncate\s+/);
  });

  it("creates an append-only lifecycle audit table with RLS", () => {
    expect(migration).toContain(
      "create table if not exists public.curriculum_lifecycle_audit_events",
    );
    expect(migration).toContain(
      "alter table public.curriculum_lifecycle_audit_events enable row level security",
    );
    expect(migration).toContain(
      "alter table public.curriculum_lifecycle_audit_events force row level security",
    );
    expect(migration).toContain("prevent_curriculum_lifecycle_audit_mutation");
    expect(migration).toContain("before update");
    expect(migration).toContain("before delete");
  });

  it.each(lifecycleFunctions)(
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
      expect(body).toContain("'organization_owner', 'organization_admin'");
      expect(migration).toContain(
        `grant execute on function public.${functionName}`,
      );
    },
  );

  it("keeps direct hard delete unavailable to authenticated callers", () => {
    expect(migration).not.toMatch(
      /grant\s+delete\s+on\s+table\s+public\.curriculums\s+to\s+authenticated/,
    );
    expect(migration).not.toMatch(
      /create\s+policy\s+"[^"]+"\s+on\s+public\.curriculums\s+for\s+delete/,
    );
    expect(migration).toContain("permanently_delete_curriculum");
  });
});
