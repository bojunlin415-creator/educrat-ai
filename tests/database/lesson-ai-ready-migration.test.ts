import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260715183000_s08_add_lesson_ai_ready_fields.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();

describe("Sprint 8 lesson AI-ready architecture reserve", () => {
  it("adds only backward-compatible lesson attributes", () => {
    expect(migration).toContain("alter table public.lessons");
    expect(migration).toContain("add column difficulty smallint");
    expect(migration).toContain(
      "add column keywords text[] not null default '{}'::text[]",
    );
    expect(migration).not.toMatch(/create\s+table/);
    expect(migration).not.toMatch(/drop\s+/);
    expect(migration).not.toMatch(/truncate\s+/);
    expect(migration).not.toMatch(/alter\s+column/);
  });

  it("keeps difficulty optional and bounded without encoding an AI score", () => {
    expect(migration).toContain("difficulty is null");
    expect(migration).toContain("difficulty between 1 and 5");
    expect(migration).toContain("this is not an ai score");
  });

  it("validates bounded, normalized, unique human keywords", () => {
    expect(migration).toContain("lesson_keywords_are_valid");
    expect(migration).toContain("cardinality(p_keywords) <= 30");
    expect(migration).toContain(
      "char_length(keyword.value) not between 1 and 80",
    );
    expect(migration).toContain("count(distinct lower(keyword.value))");
    expect(migration).toContain(
      "revoke all on function public.lesson_keywords_are_valid(text[])",
    );
  });

  it("does not implement future AI Engine resources", () => {
    expect(migration).not.toMatch(
      /create\s+table\s+public\.(ai_|prompt|embedding|generation|review)/,
    );
    expect(migration).not.toMatch(
      /add\s+column\s+(prompt|embedding|generation|review_status|model|provider)/,
    );
    expect(migration).not.toContain("service_role key");
  });
});
