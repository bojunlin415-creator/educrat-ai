import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260728132000_ai001_create_ai_curriculum_drafts.sql",
  "utf8",
);

describe("AI-001 curriculum generation migration", () => {
  it("creates a version-level AI draft table without modifying legacy migrations", () => {
    expect(migration).toContain(
      "create table if not exists public.curriculum_ai_drafts",
    );
    expect(migration).toContain(
      "references public.curriculum_versions(id) on delete restrict",
    );
    expect(migration).toContain(
      "alter table public.curriculum_ai_drafts force row level security",
    );
    expect(migration).toContain(
      'create policy "curriculum_ai_drafts_select_active_organization"',
    );
    expect(migration).toContain("client_request_id uuid not null");
    expect(migration).toContain(
      "constraint curriculum_ai_drafts_unique_client_request unique",
    );
  });

  it("adds AI audit actions while preserving lifecycle audit immutability", () => {
    expect(migration).toContain("'CURRICULUM_AI_GENERATED'");
    expect(migration).toContain("'CURRICULUM_AI_EDITED'");
    expect(migration).toContain("'CURRICULUM_AI_SAVED'");
    expect(migration).toContain(
      "array['organization_owner', 'organization_admin', 'teacher']::text[]",
    );
    expect(migration).not.toContain("drop table");
    expect(migration).not.toContain("truncate");
  });

  it("creates a controlled RPC for teacher AI draft persistence", () => {
    expect(migration).toContain(
      "create or replace function public.create_ai_generated_curriculum_draft",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("insert into public.curriculums");
    expect(migration).toContain("insert into public.curriculum_versions");
    expect(migration).toContain("insert into public.chapters");
    expect(migration).toContain("insert into public.lessons");
    expect(migration).toContain("insert into public.curriculum_ai_drafts");
    expect(migration).toContain("p_client_request_id uuid");
    expect(migration).toContain("'idempotentReplay', true");
    expect(migration).toContain("from public, anon, service_role");
    expect(migration).toContain("to authenticated");
  });
});
