import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260714232000_s06_revoke_internal_function_access.sql",
  ),
  "utf8",
).toLowerCase();

describe("Sprint 6 internal function ACL hardening", () => {
  it.each([
    "prevent_last_organization_owner",
    "ensure_organization_has_owner",
    "clear_invalid_active_membership_preference",
    "clear_invalid_organization_preferences",
  ])("revokes direct API execution from %s", (functionName) => {
    expect(migration).toContain(`function public.${functionName}()`);
  });

  it("revokes every exposed API role without changing schema objects", () => {
    expect(
      migration.match(/from public, anon, authenticated, service_role/g),
    ).toHaveLength(4);
    expect(migration).not.toMatch(/\b(drop|truncate|delete|alter)\b/);
    expect(migration).not.toContain("grant execute");
  });
});
