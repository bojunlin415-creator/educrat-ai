import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260803140000_ux001_create_access_control_management.sql",
  ),
  "utf8",
).toLowerCase();

describe("UX-001 access control management migration", () => {
  it("creates an audit table for access-management actions only", () => {
    expect(migration).toContain(
      "create table public.access_control_audit_events",
    );
    expect(migration).toContain("'role_assigned'");
    expect(migration).toContain("'role_removed'");
    expect(migration).toContain("'member_disabled'");
    expect(migration).toContain("'member_enabled'");
    expect(migration).toContain("'role_context_switched'");
    expect(migration).not.toContain("password text");
    expect(migration).not.toContain("password_hash");
    expect(migration).not.toContain("raw_token");
  });

  it("keeps access-control audit RLS enabled and forced", () => {
    expect(migration).toContain(
      "alter table public.access_control_audit_events enable row level security",
    );
    expect(migration).toContain(
      "alter table public.access_control_audit_events force row level security",
    );
    expect(migration).toContain(
      "revoke all on table public.access_control_audit_events from anon, authenticated",
    );
  });

  it("allows role context switch audit only for active members", () => {
    expect(migration).toContain("action = 'role_context_switched'");
    expect(migration).toContain("public.is_active_organization_member");
  });

  it("protects owner and admin mutations through server-side RPCs", () => {
    expect(migration).toContain(
      "function public.assign_organization_member_role",
    );
    expect(migration).toContain(
      "function public.remove_organization_member_role",
    );
    expect(migration).toContain(
      "function public.set_organization_member_access_status",
    );
    expect(migration).toContain("owner_role_protected");
    expect(migration).toContain("organization_requires_active_owner");
    expect(migration).toContain("self_mutation_forbidden");
    expect(migration).toContain("self_elevation_forbidden");
    expect(migration).toContain("admin_cannot_assign_admin");
  });

  it("does not create product-domain, API, UI, or service-role bypasses", () => {
    expect(migration).not.toContain("create table public.curriculums");
    expect(migration).not.toContain("create table public.messages");
    expect(migration).not.toContain("create table public.notifications");
    expect(migration).not.toContain("service_role key");
  });
});
