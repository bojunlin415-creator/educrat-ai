import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260714180000_s06_create_organizations.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();

describe("Sprint 6 organization migration security contract", () => {
  it.each(["organizations", "organization_members", "user_preferences"])(
    "creates %s with enabled and forced RLS",
    (table) => {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(
        `alter table public.${table} force row level security`,
      );
      expect(migration).toContain(
        `revoke all on table public.${table} from anon, authenticated`,
      );
    },
  );

  it("constrains slug, status, roles, memberships, and soft deletion", () => {
    expect(migration).toContain(
      "constraint organization_members_unique_user unique (organization_id, user_id)",
    );
    expect(migration).toContain(
      "status in ('active', 'suspended', 'archived')",
    );
    expect(migration).toContain(
      "status in ('active', 'invited', 'suspended', 'removed')",
    );
    expect(migration).toContain("slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'");
    expect(migration).toContain("deleted_at is null or status = 'archived'");
    expect(migration).toContain("message = 'invalid_organization_details'");
    expect(migration).toContain("email ~*");
    expect(migration).toContain("phone ~");
    expect(migration).toContain("'branch_manager'");
    expect(migration).toContain("'student'");
    expect(migration).toContain("'guardian'");
  });

  it("uses non-recursive security definer helpers with fixed search paths", () => {
    expect(migration).toContain(
      "function public.is_active_organization_member",
    );
    expect(migration).toContain("function public.has_organization_role");
    expect(migration).toContain("function public.get_active_organization_id");
    expect(migration.match(/security definer/g)?.length).toBeGreaterThanOrEqual(
      9,
    );
    expect(
      migration.match(/set search_path = ''/g)?.length,
    ).toBeGreaterThanOrEqual(9);
    expect(migration).toContain(
      "revoke all on function public.is_active_organization_member(uuid) from public, anon",
    );
  });

  it("creates an atomic owner and active preference without caller identities", () => {
    const functionStart = migration.indexOf(
      "create or replace function public.create_organization_with_owner",
    );
    const functionEnd = migration.indexOf(
      "create or replace function public.switch_active_organization",
    );
    const createFunction = migration.slice(functionStart, functionEnd);

    expect(createFunction).toContain("v_user_id uuid := auth.uid()");
    expect(createFunction).toContain("from public.profiles as profile");
    expect(createFunction).toContain("profile.onboarding_completed = true");
    expect(createFunction).toContain("insert into public.organizations");
    expect(createFunction).toContain("insert into public.organization_members");
    expect(createFunction).toContain("'organization_owner'");
    expect(createFunction).toContain("insert into public.user_preferences");
    expect(createFunction).not.toContain("p_user_id");
    expect(createFunction).not.toContain("p_created_by");
    expect(migration).toContain(
      "grant execute on function public.create_organization_with_owner",
    );
  });

  it("does not grant direct tenant creation or membership mutation", () => {
    expect(migration).not.toMatch(
      /grant\s+insert\s+on\s+table\s+public\.organizations/,
    );
    expect(migration).not.toMatch(
      /grant\s+(insert|update|delete)\s+on\s+table\s+public\.organization_members/,
    );
    expect(migration).not.toMatch(
      /grant\s+(insert|update|delete)\s+on\s+table\s+public\.user_preferences/,
    );
  });

  it("protects the last owner and clears invalid active preferences", () => {
    expect(migration).toContain("organization_members_preserve_last_owner");
    expect(migration).toContain("organizations_require_owner");
    expect(migration).toContain("deferrable initially deferred");
    expect(migration).toContain(
      "organization_members_clear_invalid_preference",
    );
    expect(migration).toContain("organizations_clear_invalid_preferences");
  });

  it("does not contain destructive operations against existing schema", () => {
    expect(migration).not.toMatch(/drop\s+(table|function|policy|trigger)/);
    expect(migration).not.toMatch(/truncate\s+/);
    expect(migration).not.toMatch(/delete\s+from\s+public\./);
    expect(migration).not.toMatch(/alter\s+table\s+public\.profiles/);
    expect(migration).not.toContain("storage.objects");
  });
});
