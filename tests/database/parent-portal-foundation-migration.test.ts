import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260803110000_pp001_create_parent_portal_foundation.sql",
  ),
  "utf8",
).toLowerCase();

describe("PP-001 parent portal foundation migration", () => {
  it("creates minimal guardian relationship and parent audit foundations", () => {
    expect(migration).toContain("create table public.student_guardians");
    expect(migration).toContain(
      "create table public.parent_portal_audit_events",
    );
    expect(migration).toContain("relationship_type in");
    expect(migration).toContain("status in ('pending', 'active', 'revoked')");
  });

  it("protects guardian access with RLS and active relationship scope", () => {
    expect(migration).toContain(
      "alter table public.student_guardians force row level security",
    );
    expect(migration).toContain("student_guardians_select_own_active");
    expect(migration).toContain("status = 'active'");
    expect(migration).toContain("guardian_user_id = (select auth.uid())");
    expect(migration).toContain("array['guardian']");
  });

  it("prevents duplicate active relationships and client status elevation", () => {
    expect(migration).toContain(
      "create unique index student_guardians_active_unique",
    );
    expect(migration).not.toContain(
      "grant insert on table public.student_guardians",
    );
    expect(migration).not.toContain(
      "grant update on table public.student_guardians",
    );
  });

  it("does not create dashboards or query learning implementation tables", () => {
    expect(migration).not.toContain("create table public.parent_dashboard");
    expect(migration).not.toContain("create table public.parent_reports");
    expect(migration).not.toContain("create table public.learning_events");
    expect(migration).not.toContain(
      "create table public.student_knowledge_mastery",
    );
    expect(migration).not.toContain("create table public.notifications");
  });

  it("keeps audit metadata minimal", () => {
    expect(migration).toContain("parent_dashboard_viewed");
    expect(migration).toContain("parent_student_report_viewed");
    expect(migration).toContain("does not store raw learning events");
    expect(migration).not.toContain("provider_response");
    expect(migration).not.toContain("prompt_payload");
    expect(migration).not.toContain("answer_content");
  });
});
