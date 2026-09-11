import fs from "node:fs";
import path from "node:path";

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260907120000_le001_canonicalize_submission_self_resolution.sql",
    ),
    "utf8",
  )
  .toLowerCase();

describe("LE-001 Phase 5F submission self-resolution migration", () => {
  it("adds explicit canonical ownership without reinterpreting historical student_id", () => {
    const schemaDefinition = migration.slice(
      0,
      migration.indexOf(
        "create or replace function public.is_authenticated_canonical_assignment_recipient(",
      ),
    );

    expect(migration).toContain(
      "create table public.assignment_submission_canonical_ownerships",
    );
    expect(migration).toContain("references public.assignment_submissions(");
    expect(migration).toContain(
      "references public.assignment_student_recipients(",
    );
    expect(migration).toContain("on delete restrict");
    expect(migration).toContain(
      "historical assignment_submissions.student_id remains a profile identifier",
    );
    expect(migration).not.toMatch(
      /alter\s+table\s+public\.assignment_submissions\s+alter\s+column\s+student_id/,
    );
    expect(schemaDefinition).not.toMatch(
      /update\s+public\.assignment_submissions/,
    );
  });

  it("derives canonical self identity and recipient eligibility inside fixed-path RPCs", () => {
    const persistenceFunction = migration.slice(
      migration.indexOf(
        "create or replace function public.persist_authenticated_student_submission(",
      ),
      migration.indexOf(
        "revoke all on function public.persist_authenticated_student_submission(",
      ),
    );

    expect(migration).toContain(
      "create or replace function public.save_authenticated_student_submission(",
    );
    expect(migration).toContain(
      "create or replace function public.persist_authenticated_student_submission(",
    );
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("from public.student_account_links");
    expect(migration).toContain("from public.assignment_student_recipients");
    expect(migration).toContain("link.account_id = v_account_id");
    expect(migration).not.toContain("from auth.users");
    expect(persistenceFunction).not.toContain("p_student_id");
    expect(persistenceFunction).not.toContain("p_organization_id");
  });

  it("fails closed for missing, inactive, expired, conflicting and cross-tenant identity", () => {
    for (const code of [
      "student_account_link_missing",
      "student_account_link_inactive",
      "student_account_link_expired",
      "student_identity_conflict",
      "assignment_recipient_not_found",
      "cross_tenant_forbidden",
      "submission_not_allowed",
      "submission_locked",
    ]) {
      expect(migration).toContain(code);
    }
  });

  it("enables FORCE RLS, minimizes grants, and removes direct Submission writes", () => {
    expect(migration).toContain(
      "alter table public.assignment_submission_canonical_ownerships\nenable row level security",
    );
    expect(migration).toContain(
      "alter table public.assignment_submission_canonical_ownerships\nforce row level security",
    );
    expect(migration).toContain(
      "revoke insert, update on table public.assignment_submissions from authenticated",
    );
    expect(migration).toContain(
      "create or replace function public.can_authenticated_read_legacy_assignment_recipient(",
    );
    expect(migration).toContain(
      'create policy "assignment_students_select_scoped"',
    );
    expect(migration).toContain("link.status = 'active'");
    expect(migration).toContain("link.verified_at is not null");
    expect(migration).toContain(
      "from public, anon, authenticated, service_role",
    );
    expect(migration).not.toContain("using (true)");
  });

  it("keeps canonical write failure separate from explicit legacy rollback", () => {
    expect(migration).toContain(
      "create or replace function public.save_legacy_authenticated_student_submission(",
    );
    expect(migration).toContain("p_use_canonical_identity");
    expect(migration).not.toMatch(/exception[\s\S]{0,200}save_legacy/);
  });

  it("does not expose a mapped compatibility recipient after link revocation", () => {
    const recipientProjection = migration.slice(
      migration.indexOf(
        "create or replace function public.get_authenticated_student_assignment_recipients(",
      ),
      migration.indexOf(
        "revoke all on function public.get_authenticated_student_assignment_recipients(",
      ),
    );
    expect(recipientProjection).toContain(
      "and not exists (\n        select 1\n        from public.assignment_recipient_legacy_compatibility",
    );
    expect(recipientProjection).not.toContain(
      "v_student_id is not null\n        and exists",
    );
  });

  it("contains no destructive migration or broad historical backfill", () => {
    expect(migration).not.toMatch(/\b(drop table|truncate|delete from)\b/);
    expect(migration).not.toContain("drop column");
    expect(migration).not.toContain("alter column student_id type");
  });
});
