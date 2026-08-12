import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260803153000_td001_fix_classroom_rls_recursion.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();
const compactMigration = migration.replace(/\s+/g, " ");

describe("TD-001 classroom RLS recursion fix migration", () => {
  it("uses security definer helpers for class relationship checks", () => {
    expect(migration).toContain(
      "create or replace function public.is_class_primary_teacher",
    );
    expect(migration).toContain(
      "create or replace function public.is_class_enrolled_student",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
  });

  it("replaces recursive classroom policies", () => {
    for (const policy of [
      "classes_select_scoped",
      "class_enrollments_select_scoped",
      "class_enrollments_insert_teacher",
      "class_enrollments_update_teacher",
      "assignment_classes_select_scoped",
      "assignment_classes_insert_teacher",
    ]) {
      expect(migration).toContain(`drop policy if exists "${policy}"`);
      expect(migration).toContain(`create policy "${policy}"`);
    }
  });

  it("keeps tenant-scoped role and relationship boundaries", () => {
    expect(compactMigration).toContain(
      "public.has_organization_role( organization_id, array['organization_owner', 'organization_admin']::text[] )",
    );
    expect(compactMigration).toContain(
      "public.is_class_primary_teacher( class_enrollments.class_id, class_enrollments.organization_id, (select auth.uid()) )",
    );
    expect(compactMigration).toContain(
      "public.is_class_enrolled_student( classes.id, classes.organization_id, (select auth.uid()) )",
    );
  });

  it("does not add product tables or broaden grants", () => {
    expect(migration).not.toMatch(/create\s+table\s+public\./);
    expect(migration).not.toContain("grant all");
    expect(migration).not.toContain("service_role");
  });
});
