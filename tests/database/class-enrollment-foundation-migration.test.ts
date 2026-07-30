import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260730100000_cl001_create_class_enrollment_foundation.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();
const compactMigration = migration.replace(/\s+/g, " ");

describe("CL-001 class and enrollment foundation migration", () => {
  it("creates class, enrollment, assignment class target, and audit tables", () => {
    expect(migration).toContain("create table public.classes");
    expect(migration).toContain("create table public.class_enrollments");
    expect(migration).toContain("create table public.assignment_classes");
    expect(migration).toContain("create table public.classroom_audit_events");
    expect(migration).toContain("constraint classes_code_unique unique");
  });

  it("validates teacher, student, and assignment class tenant boundaries", () => {
    expect(migration).toContain(
      "create or replace function public.validate_class_teacher",
    );
    expect(migration).toContain(
      "create or replace function public.validate_class_enrollment",
    );
    expect(migration).toContain(
      "create or replace function public.validate_assignment_class",
    );
    expect(migration).toContain("class_invalid_teacher");
    expect(migration).toContain("class_invalid_student");
    expect(migration).toContain("assignment_invalid_class");
    expect(compactMigration).toContain("membership.role = 'teacher'");
    expect(compactMigration).toContain("membership.role = 'student'");
  });

  it("enables force RLS and scoped select policies", () => {
    for (const table of [
      "classes",
      "class_enrollments",
      "assignment_classes",
      "classroom_audit_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(
        `alter table public.${table} force row level security`,
      );
    }
    expect(migration).toContain("teacher_id = (select auth.uid())");
    expect(migration).toContain("student_id = (select auth.uid())");
  });

  it("adds only CL-001 audit events and no excluded product areas", () => {
    expect(migration).toContain("'class_created'");
    expect(migration).toContain("'class_updated'");
    expect(migration).toContain("'class_archived'");
    expect(migration).toContain("'enrollment_created'");
    expect(migration).toContain("'enrollment_removed'");
    expect(migration).not.toMatch(
      /create\s+table\s+public\.(attendance|timetable|analytics|dashboard|recommendation)/,
    );
  });
});
