import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260730130000_an001_create_learning_analytics_foundation.sql",
  ),
  "utf8",
).toLowerCase();

describe("AN-001 learning analytics migration", () => {
  it("creates learning analytics tables only", () => {
    expect(migration).toContain("create table public.learning_events");
    expect(migration).toContain(
      "create table public.student_knowledge_mastery",
    );
    expect(migration).toContain("create table public.student_subject_summary");
    expect(migration).toContain("create table public.teacher_class_summary");
    expect(migration).toContain("create table public.learning_audit_events");
    expect(migration).not.toContain("create table public.dashboard");
    expect(migration).not.toContain("create table public.parent_reports");
    expect(migration).not.toContain("create table public.ai_recommendations");
  });

  it("keeps learning events immutable", () => {
    expect(migration).toContain("comment on table public.learning_events");
    expect(migration).toContain("prevent_learning_event_mutation");
    expect(migration).toContain("before update on public.learning_events");
    expect(migration).toContain("before delete on public.learning_events");
    expect(migration).toContain(
      "grant select, insert on table public.learning_events to authenticated",
    );
    expect(migration).not.toContain(
      "grant select, insert, update on table public.learning_events",
    );
  });

  it("enables and forces RLS on all new tables", () => {
    for (const tableName of [
      "learning_events",
      "student_knowledge_mastery",
      "student_subject_summary",
      "teacher_class_summary",
      "learning_audit_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${tableName} enable row level security`,
      );
      expect(migration).toContain(
        `alter table public.${tableName} force row level security`,
      );
    }
  });

  it("validates tenant relationships before accepting events", () => {
    expect(migration).toContain("validate_learning_event");
    expect(migration).toContain("learning_event_invalid_assignment");
    expect(migration).toContain("learning_event_invalid_submission");
    expect(migration).toContain("learning_event_invalid_student_assignment");
    expect(migration).toContain("public.class_enrollments");
  });
});
