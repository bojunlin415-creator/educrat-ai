import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260728123000_pi001_use_active_curriculum_name_uniqueness.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();

describe("PI-001 active curriculum name uniqueness migration", () => {
  it("fails closed when active duplicate curriculum names already exist", () => {
    expect(migration).toContain("where deleted_at is null");
    expect(migration).toContain("group by organization_id, lower(name)");
    expect(migration).toContain("having count(*) > 1");
    expect(migration).toContain(
      "active_curriculum_name_conflict_requires_manual_resolution",
    );
  });

  it("replaces the legacy always-on unique name index with an active-only tenant-scoped index", () => {
    expect(migration).toContain(
      "drop index if exists public.curriculums_unique_name_per_organization_idx",
    );
    expect(migration).toContain(
      "create unique index if not exists curriculums_unique_active_name_per_organization_idx",
    );
    expect(migration).toContain(
      "on public.curriculums (organization_id, lower(name))",
    );
    expect(migration).toContain("where deleted_at is null");
    expect(migration).not.toMatch(/drop\s+table|truncate\s+/);
    expect(migration).not.toMatch(/delete\s+from\s+public\.curriculums/);
  });

  it("keeps restore server-side and maps name conflicts to a safe domain error", () => {
    const functionStart = migration.indexOf(
      "create or replace function public.restore_deleted_curriculum",
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
    expect(functionBody).toContain("public.has_organization_role(");
    expect(functionBody).toContain("when unique_violation then");
    expect(functionBody).toContain("curriculum_restore_name_taken");
    expect(migration).toContain(
      "grant execute on function public.restore_deleted_curriculum(uuid)\nto authenticated",
    );
  });
});
