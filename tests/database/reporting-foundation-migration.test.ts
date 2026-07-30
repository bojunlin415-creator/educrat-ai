import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260730190000_rp001_create_reporting_foundation.sql",
  ),
  "utf8",
).toLowerCase();

describe("RP-001 reporting foundation migration", () => {
  it("creates reporting audit and optional cache tables only", () => {
    expect(migration).toContain("create table public.report_audit_events");
    expect(migration).toContain("create table public.report_cache");
    expect(migration).not.toContain("create table public.dashboard");
    expect(migration).not.toContain("create table public.charts");
    expect(migration).not.toContain("create table public.email_reports");
    expect(migration).not.toContain("create table public.notifications");
    expect(migration).not.toContain("create table public.scheduled_reports");
  });

  it("does not alter learning analytics source tables", () => {
    expect(migration).not.toContain("alter table public.learning_events");
    expect(migration).not.toContain(
      "alter table public.student_knowledge_mastery",
    );
    expect(migration).not.toContain(
      "alter table public.student_subject_summary",
    );
    expect(migration).not.toContain("alter table public.teacher_class_summary");
  });

  it("enables and forces RLS on all new reporting tables", () => {
    for (const tableName of ["report_audit_events", "report_cache"]) {
      expect(migration).toContain(
        `alter table public.${tableName} enable row level security`,
      );
      expect(migration).toContain(
        `alter table public.${tableName} force row level security`,
      );
    }
  });

  it("records report audit events without storing report payloads", () => {
    expect(migration).toContain("report_viewed");
    expect(migration).toContain("report_exported");
    expect(migration).toContain("does not store report payloads");
    expect(migration).not.toContain("pdf binary");
    expect(migration).not.toContain("full answer");
    expect(migration).not.toContain("provider_response");
  });
});
