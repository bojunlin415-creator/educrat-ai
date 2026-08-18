import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260818120000_le001_create_student_account_links.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();

function readFunction(name: string): string {
  const source = migration.match(
    new RegExp(
      `create or replace function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`,
    ),
  )?.[0];
  if (!source) throw new Error(`Missing function ${name}`);
  return source;
}

describe("LE-001 Student-to-Account link migration", () => {
  it("is additive and performs no historical backfill or destructive rewrite", () => {
    expect(migration).not.toMatch(/drop\s+(table|column)/);
    expect(migration).not.toMatch(/truncate\s+/);
    expect(migration).not.toMatch(/delete\s+from\s+/);
    expect(migration).not.toMatch(/alter\s+table[\s\S]*?\srename\s+/);
    expect(migration).not.toMatch(
      /insert\s+into\s+public\.student_account_links[^;]*?\)\s*select\s+/,
    );
  });

  it("creates a tenant-consistent, history-preserving link model", () => {
    expect(migration).toContain("create table public.student_account_links");
    expect(migration).toContain(
      "foreign key (student_id, organization_id)\n    references public.students(id, organization_id) on delete restrict",
    );
    expect(migration).toContain(
      "account_id uuid not null references auth.users(id) on delete restrict",
    );
    expect(migration).toContain("where status = 'active'");
    expect(migration).toContain("student_account_links_active_student_unique");
    expect(migration).toContain("student_account_links_active_account_unique");
    expect(migration).not.toContain("heuristic_auto_link");
  });

  it("forces RLS and exposes only self-resolution or tenant-admin boundaries", () => {
    for (const table of [
      "student_account_links",
      "student_account_link_audit_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(
        `alter table public.${table} force row level security`,
      );
    }
    expect(migration).toContain(
      'create policy "student_account_links_select_own_active"',
    );
    expect(migration).toContain("account_id = (select auth.uid())");
    expect(migration).toContain("public.get_active_organization_id()");
    expect(migration).not.toMatch(
      /grant\s+(all|insert|update|delete).*authenticated/,
    );
    expect(migration).not.toMatch(
      /grant\s+select\s+on\s+(table\s+)?auth\.users/,
    );
  });

  it("keeps authoritative writes behind tenant-validated RPCs with audit", () => {
    const create = readFunction("create_verified_student_account_link");
    const revoke = readFunction("revoke_student_account_link");

    for (const source of [create, revoke]) {
      expect(source).toContain("security definer");
      expect(source).toContain("set search_path = ''");
      expect(source).toContain("public.get_active_organization_id()");
      expect(source).toContain("public.has_organization_role(");
      expect(source).toContain("student_account_link_audit_events");
    }
    expect(create).toContain("student.organization_id = v_organization_id");
    expect(create).toContain("membership.organization_id = v_organization_id");
    expect(create).toContain("membership.status = 'active'");
    expect(revoke).toContain("link.organization_id = v_organization_id");
  });

  it("resolves self identity without accepting caller-controlled identity scope", () => {
    const resolver = readFunction(
      "resolve_canonical_student_for_authenticated_account",
    );

    expect(resolver).toContain("auth.uid()");
    expect(resolver).toContain("public.get_active_organization_id()");
    expect(resolver).toContain("public.is_active_organization_member(");
    expect(resolver).toContain("'ambiguous_link'");
    expect(resolver).toContain("'revoked_link'");
    expect(resolver).toContain("'expired_link'");
    expect(resolver).toContain("'wrong_organization'");
    expect(resolver).not.toContain("p_student_id");
    expect(resolver).not.toContain("p_organization_id");
  });

  it("limits parity snapshots to active-organization owners and admins", () => {
    const snapshot = readFunction("get_learner_convergence_snapshot");

    expect(snapshot).toContain(
      "array['organization_owner', 'organization_admin']",
    );
    expect(snapshot).toContain("'eligibleprofilestudents'");
    expect(snapshot).toContain("'canonicalstudents'");
    expect(snapshot).toContain("'legacyenrollments'");
    expect(snapshot).toContain("'canonicalenrollments'");
    expect(snapshot).toContain("'assignmentrecipients'");
    expect(snapshot).toContain("'submissions'");
    expect(snapshot).toContain("'learningevents'");
    expect(snapshot).toContain("'masteryrecords'");
    expect(snapshot).toContain("'guardianrelationships'");
    expect(snapshot).not.toContain("profile.email");
    expect(snapshot).not.toContain("birthday");
  });
});
