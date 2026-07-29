import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260729100000_ex001_add_curriculum_export_audit.sql",
  ),
  "utf8",
);

describe("EX-001 curriculum export audit migration", () => {
  it("adds export audit action without editing historical migrations", () => {
    expect(migration).toContain("'CURRICULUM_EXPORTED'");
    expect(migration).toContain(
      "drop constraint if exists curriculum_lifecycle_audit_events_action_check",
    );
    expect(migration).toContain(
      "array['organization_owner', 'organization_admin', 'teacher']",
    );
  });

  it("does not create storage, API, or PDF persistence tables", () => {
    expect(migration).not.toMatch(/create\s+table/i);
    expect(migration).not.toMatch(/storage/i);
    expect(migration).not.toMatch(/public\s+url/i);
  });
});
