import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260730210000_td001_create_teacher_dashboard_audit.sql",
  ),
  "utf8",
).toLowerCase();

describe("TD-001 teacher dashboard audit migration", () => {
  it("creates only teacher dashboard audit foundation", () => {
    expect(migration).toContain(
      "create table public.teacher_dashboard_audit_events",
    );
    expect(migration).not.toContain("create table public.learning_events");
    expect(migration).not.toContain("create table public.student_knowledge");
    expect(migration).not.toContain("create table public.parent_dashboard");
    expect(migration).not.toContain(
      "create table public.organization_dashboard",
    );
    expect(migration).not.toContain("create table public.scheduled_reports");
    expect(migration).not.toContain("create table public.notifications");
  });

  it("records dashboard audit events without dashboard payloads", () => {
    expect(migration).toContain("teacher_dashboard_viewed");
    expect(migration).toContain("teaching_insight_viewed");
    expect(migration).toContain("does not store dashboard payloads");
    expect(migration).not.toContain("provider_response");
    expect(migration).not.toContain("prompt_payload");
    expect(migration).not.toContain("student_answer_content");
  });

  it("enables and forces RLS", () => {
    expect(migration).toContain(
      "alter table public.teacher_dashboard_audit_events enable row level security",
    );
    expect(migration).toContain(
      "alter table public.teacher_dashboard_audit_events force row level security",
    );
  });

  it("allows scoped insert only for owner admin or teacher", () => {
    expect(migration).toContain("teacher_dashboard_audit_insert_scoped");
    expect(migration).toContain("organization_owner");
    expect(migration).toContain("organization_admin");
    expect(migration).toContain("teacher");
    expect(migration).toContain("actor_id = (select auth.uid())");
  });
});
