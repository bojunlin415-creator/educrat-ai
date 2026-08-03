import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260803113000_gv001_create_guardian_verification_consent.sql",
  ),
  "utf8",
).toLowerCase();

describe("GV-001 guardian verification and consent migration", () => {
  it("creates invitation table with hash-only token storage", () => {
    expect(migration).toContain("create table public.guardian_invitations");
    expect(migration).toContain("token_hash text not null unique");
    expect(migration).toContain("raw tokens are never stored");
    expect(migration).not.toContain("raw_token");
    expect(migration).not.toContain("plain_token");
  });

  it("extends guardian relationship lifecycle and consent fields", () => {
    expect(migration).toContain(
      "status in ('pending', 'verified', 'active', 'revoked')",
    );
    expect(migration).toContain("consent_granted_at");
    expect(migration).toContain("consent_version");
    expect(migration).toContain("activated_at");
    expect(migration).toContain("revocation_reason");
  });

  it("keeps invitation acceptance server-side and fail closed", () => {
    expect(migration).toContain("function public.accept_guardian_invitation");
    expect(migration).toContain("security definer");
    expect(migration).toContain("email_confirmed_at is not null");
    expect(migration).toContain("guardian_email_mismatch");
    expect(migration).toContain("guardian_existing_membership_role_conflict");
  });

  it("keeps relationship revocation server-side and audited", () => {
    expect(migration).toContain("function public.revoke_guardian_relationship");
    expect(migration).toContain("guardian_relationship_not_found");
    expect(migration).toContain("guardian_relationship_not_active");
    expect(migration).toContain("guardian_relationship_revoked");
    expect(migration).toContain(
      "revoke all on function public.revoke_guardian_relationship",
    );
  });

  it("enables and forces RLS", () => {
    expect(migration).toContain(
      "alter table public.guardian_invitations enable row level security",
    );
    expect(migration).toContain(
      "alter table public.guardian_invitations force row level security",
    );
  });

  it("does not create messaging, notification, billing, or service-role test bypass", () => {
    expect(migration).not.toContain("create table public.notifications");
    expect(migration).not.toContain("create table public.messages");
    expect(migration).not.toContain("create table public.billing");
    expect(migration).not.toContain("service_role key");
  });
});
