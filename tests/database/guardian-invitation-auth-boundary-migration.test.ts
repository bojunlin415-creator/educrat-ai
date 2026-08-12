import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260804123000_gv001_fix_guardian_invitation_auth_user_boundary.sql",
  ),
  "utf8",
).toLowerCase();

const policyStart = migration.indexOf(
  'create policy "guardian_invitations_email_select"',
);
const policyEnd = migration.indexOf(
  "create or replace function public.accept_guardian_invitation",
);
const emailSelectPolicy = migration.slice(policyStart, policyEnd);

describe("GV-001 guardian invitation auth user boundary fix migration", () => {
  it("exposes verified email only through a security definer helper", () => {
    expect(migration).toContain(
      "function public.get_current_verified_auth_email",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("email_confirmed_at is not null");
    expect(migration).toContain(
      "revoke all on function public.get_current_verified_auth_email()",
    );
    expect(migration).toContain(
      "grant execute on function public.get_current_verified_auth_email()",
    );
  });

  it("replaces the email-select policy without granting auth.users access", () => {
    expect(migration).toContain(
      'drop policy if exists "guardian_invitations_email_select"',
    );
    expect(migration).toContain(
      'create policy "guardian_invitations_email_select"',
    );
    expect(migration).toContain(
      "guardian_email_normalized = public.get_current_verified_auth_email()",
    );
    expect(migration).not.toMatch(/grant\s+select\s+on\s+.*auth\.users/);
    expect(emailSelectPolicy).not.toMatch(/from\s+auth\.users/);
  });

  it("keeps invitation acceptance server-side and using the helper", () => {
    expect(migration).toContain(
      "create or replace function public.accept_guardian_invitation",
    );
    expect(migration).toContain(
      "v_email := public.get_current_verified_auth_email()",
    );
    expect(migration).toContain("guardian_email_mismatch");
    expect(migration).toContain("guardian_verified_email_required");
  });

  it("does not weaken RLS or introduce product bypasses", () => {
    expect(migration).not.toContain("disable row level security");
    expect(migration).not.toContain("service_role key");
    expect(migration).not.toContain("create table public.users");
    expect(migration).not.toContain("create table public.notifications");
  });
});
