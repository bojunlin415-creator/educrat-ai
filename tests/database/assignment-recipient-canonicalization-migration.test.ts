import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260831120000_le001_canonicalize_assignment_recipients.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();
const compact = migration.replace(/\s+/g, " ");

describe("LE-001 Phase 5E Assignment recipient canonicalization migration", () => {
  it("adds a canonical students.id recipient boundary without repurposing legacy identity", () => {
    expect(migration).toContain(
      "create table public.assignment_student_recipients",
    );
    expect(migration).toContain(
      "references public.students(id, organization_id) on delete restrict",
    );
    expect(migration).toContain(
      "historical assignment_students.student_id remains a profile identifier",
    );
    expect(migration).not.toMatch(
      /alter\s+table\s+public\.assignment_students[\s\S]*student_id/,
    );
    expect(migration).not.toMatch(/update\s+public\.assignment_students/);
    expect(migration).not.toMatch(/drop\s+table\s+public\.assignment_students/);
  });

  it("enforces Assignment, Student, Class, and membership tenant integrity", () => {
    expect(migration).toContain("foreign key (assignment_id, organization_id)");
    expect(migration).toContain("foreign key (student_id, organization_id)");
    expect(compact).toContain(
      "foreign key (assignment_id, class_id, organization_id)",
    );
    expect(compact).toContain(
      "foreign key (membership_id, class_id, student_id, organization_id)",
    );
    expect(migration).toContain(
      "constraint assignment_student_recipients_unique",
    );
    expect(migration).not.toContain("on delete cascade");
  });

  it("keeps accountless recipients canonical and creates only verified legacy compatibility", () => {
    const canonicalInsert = migration.indexOf(
      "insert into public.assignment_student_recipients",
    );
    const compatibilityBranch = migration.indexOf(
      "if p_write_legacy_compatibility then",
    );
    expect(canonicalInsert).toBeGreaterThan(-1);
    expect(canonicalInsert).toBeLessThan(compatibilityBranch);
    expect(migration).toContain("link.status = 'active'");
    expect(migration).toContain("link.verified_at is not null");
    expect(migration).toContain("membership.role = 'student'");
    expect(migration).toContain("membership.status = 'active'");
    expect(migration).not.toContain("auth.users");
  });

  it("uses an atomic security-definer write path and never exposes the internal helper", () => {
    expect(migration).toContain(
      "create or replace function public.create_assignment_with_canonical_recipients",
    );
    expect(migration).toContain(
      "create or replace function public.persist_assignment_canonical_recipient_snapshot",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(compact).toContain(
      "revoke all on function public.persist_assignment_canonical_recipient_snapshot( uuid, uuid[], uuid[], uuid[], boolean ) from public, anon, authenticated, service_role",
    );
    expect(migration).toContain("assignment_recipient_snapshot_changed");
    expect(migration).toContain(
      "on conflict (assignment_id, student_id) do nothing",
    );
  });

  it("enables and forces RLS without direct recipient mutation grants", () => {
    for (const table of [
      "assignment_student_recipients",
      "assignment_recipient_classes",
      "assignment_recipient_legacy_compatibility",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(
        `alter table public.${table} force row level security`,
      );
      expect(migration).toContain(
        `revoke all on table public.${table} from anon, authenticated`,
      );
    }
    expect(migration).not.toMatch(
      /grant\s+(insert|update|delete|all)[\s\S]*assignment_(student_recipients|recipient_classes|recipient_legacy_compatibility)/,
    );
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/);
  });

  it("exposes a canonical-safe projection without raw Profile or Account keys", () => {
    const projection = migration.slice(
      migration.indexOf(
        "create or replace function public.get_assignment_recipient_projection",
      ),
    );
    expect(projection).toContain("canonical_student_id uuid");
    expect(projection).toContain("legacy_only_historical");
    expect(projection).not.toContain("legacy_student_id uuid");
    expect(projection).not.toContain("account_id uuid");
  });
});
