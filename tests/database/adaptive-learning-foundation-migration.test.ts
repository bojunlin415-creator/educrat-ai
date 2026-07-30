import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260730160000_ai002_create_adaptive_learning_foundation.sql",
  ),
  "utf8",
).toLowerCase();

describe("AI-002 adaptive learning migration", () => {
  it("creates recommendation and path tables only", () => {
    expect(migration).toContain("create table public.learning_recommendations");
    expect(migration).toContain("create table public.learning_paths");
    expect(migration).toContain(
      "create table public.learning_recommendation_audit_events",
    );
    expect(migration).not.toContain("create table public.dashboard");
    expect(migration).not.toContain("create table public.notifications");
    expect(migration).not.toContain("create table public.background");
  });

  it("requires existing learning analytics before recommendation writes", () => {
    expect(migration).toContain("student_knowledge_mastery");
    expect(migration).toContain("adaptive_learning_analytics_required");
    expect(migration).toContain("adaptive_learning_invalid_student");
  });

  it("enables and forces RLS on all new tables", () => {
    for (const tableName of [
      "learning_recommendations",
      "learning_paths",
      "learning_recommendation_audit_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${tableName} enable row level security`,
      );
      expect(migration).toContain(
        `alter table public.${tableName} force row level security`,
      );
    }
  });

  it("records recommendation audit events without prompt or generated content", () => {
    expect(migration).toContain("learning_recommendation_created");
    expect(migration).toContain("learning_path_viewed");
    expect(migration).not.toContain("prompt");
    expect(migration).not.toContain("provider_response");
    expect(migration).not.toContain("worksheet_content");
  });
});
