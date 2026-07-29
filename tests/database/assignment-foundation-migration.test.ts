import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260729150000_as001_create_assignment_foundation.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();
const compactMigration = migration.replace(/\s+/g, " ");

describe("AS-001 assignment foundation migration", () => {
  it("creates assignment, student assignment, submission, and audit tables", () => {
    expect(migration).toContain("create table public.assignments");
    expect(migration).toContain("create table public.assignment_students");
    expect(migration).toContain("create table public.assignment_submissions");
    expect(migration).toContain("create table public.assignment_audit_events");
    expect(migration).toContain("curriculum_version_id uuid not null");
    expect(migration).not.toMatch(/latest_version|p_latest|resolve_latest/i);
  });

  it("requires published curriculum and published curriculum version through a trigger", () => {
    expect(migration).toContain(
      "create or replace function public.validate_assignment_curriculum_version",
    );
    expect(compactMigration).toContain("v_curriculum_status <> 'published'");
    expect(compactMigration).toContain("v_version_status <> 'published'");
    expect(migration).toContain("assignment_invalid_curriculum_version");
  });

  it("enforces tenant RLS and scoped student access", () => {
    for (const table of [
      "assignments",
      "assignment_students",
      "assignment_submissions",
      "assignment_audit_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(
        `alter table public.${table} force row level security`,
      );
    }
    expect(migration).toContain("public.is_active_organization_member");
    expect(migration).toContain("student_id = (select auth.uid())");
    expect(migration).toContain("assigned_by = (select auth.uid())");
  });

  it("keeps submissions one-per-student and immutable after submit", () => {
    expect(migration).toContain(
      "constraint assignment_submissions_one_per_student unique",
    );
    expect(migration).toContain("status = 'draft'");
    expect(migration).toContain("status in ('draft', 'submitted')");
  });

  it("adds only allowed AS-001 audit events and no AI or dashboard objects", () => {
    expect(migration).toContain("'assignment_created'");
    expect(migration).toContain("'assignment_updated'");
    expect(migration).toContain("'assignment_assigned'");
    expect(migration).toContain("'assignment_submitted'");
    expect(migration).not.toMatch(/ai_|analytics|dashboard|parent/);
  });
});
