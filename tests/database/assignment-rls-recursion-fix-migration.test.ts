import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260817134500_td001_fix_assignment_rls_recursion.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();

function readPolicy(name: string): string {
  const policy = migration.match(
    new RegExp(`create policy "${name}"[\\s\\S]*?;`),
  )?.[0];
  if (!policy) throw new Error(`Missing policy ${name}`);
  return policy;
}

describe("TD-001 assignment RLS recursion fix migration", () => {
  it("uses tenant-scoped security definer helpers for cross-table checks", () => {
    for (const helper of [
      "assignment_belongs_to_organization",
      "is_assignment_manager",
      "is_assignment_recipient",
      "is_assignment_submission_eligible",
    ]) {
      expect(migration).toContain(
        `create or replace function public.${helper}`,
      );
    }
    expect(migration.match(/security definer/g)).toHaveLength(4);
    expect(migration.match(/set search_path = ''/g)).toHaveLength(4);
  });

  it("replaces every assignment policy that traversed the recursive graph", () => {
    for (const policy of [
      "assignments_select_member",
      "assignment_students_select_scoped",
      "assignment_students_insert_teacher",
      "assignment_students_update_student_or_teacher",
      "assignment_submissions_select_scoped",
      "assignment_submissions_insert_student",
    ]) {
      expect(migration).toContain(`drop policy if exists "${policy}"`);
      expect(migration).toContain(`create policy "${policy}"`);
    }
  });

  it("removes direct policy traversal between assignments and recipients", () => {
    expect(readPolicy("assignments_select_member")).not.toContain(
      "from public.assignment_students",
    );
    expect(readPolicy("assignment_students_select_scoped")).not.toContain(
      "from public.assignments",
    );
    expect(
      readPolicy("assignment_students_update_student_or_teacher"),
    ).not.toContain("from public.assignments");
  });

  it("preserves role, actor, tenant and submission-state boundaries", () => {
    expect(readPolicy("assignments_select_member")).toContain(
      "public.is_active_organization_member(organization_id)",
    );
    expect(readPolicy("assignment_students_insert_teacher")).toContain(
      "public.assignment_belongs_to_organization(",
    );
    expect(readPolicy("assignment_submissions_insert_student")).toContain(
      "public.is_assignment_submission_eligible(",
    );
    expect(migration).toContain(
      "student_assignment.status in ('not_started', 'in_progress', 'overdue')",
    );
  });

  it("does not weaken RLS or grant elevated database access", () => {
    expect(migration).not.toMatch(
      /alter\s+table[\s\S]*disable\s+row\s+level\s+security/,
    );
    expect(migration).not.toContain("grant all");
    expect(migration).not.toContain("service_role");
    expect(migration).not.toMatch(/create\s+table\s+public\./);
  });
});
