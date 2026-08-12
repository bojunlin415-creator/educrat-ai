import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260806100000_s08_extend_classes_students_foundation.sql",
  ),
  "utf8",
).toLowerCase();

const hardeningMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260811153000_s08_harden_classes_students_foundation.sql",
  ),
  "utf8",
).toLowerCase();

describe("Sprint 8 classes and students migration", () => {
  it("extends classes additively and creates canonical student tables", () => {
    expect(migration).toContain("alter table public.classes");
    expect(migration).toContain("add column if not exists school");
    expect(migration).toContain("create table public.students");
    expect(migration).toContain("create table public.student_class_members");
    expect(migration).not.toContain("drop table");
    expect(migration).not.toContain("truncate");
  });

  it("enforces tenant-consistent class and student foreign keys", () => {
    expect(migration).toContain("foreign key (class_id, organization_id)");
    expect(migration).toContain("foreign key (student_id, organization_id)");
    expect(migration).toContain("unique (organization_id, student_no)");
  });

  it("enables and forces RLS with staff-scoped writes", () => {
    for (const table of [
      "students",
      "student_class_members",
      "class_student_audit_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(
        `alter table public.${table} force row level security`,
      );
    }
    expect(migration).toContain(
      "'organization_owner', 'organization_admin', 'teacher'",
    );
    expect(migration).not.toContain("service_role");
  });

  it("hardens the applied foundation with a forward-only migration", () => {
    expect(hardeningMigration).toContain("managed_class.status = 'active'");
    expect(hardeningMigration).toContain("array['teacher']::text[]");
    expect(hardeningMigration).toContain(
      "revoke all privileges on table public.students from authenticated",
    );
    expect(hardeningMigration).toContain(
      "grant update (joined_at, left_at, status)",
    );
    expect(hardeningMigration).not.toContain(
      "grant update (\n  organization_id",
    );
    expect(hardeningMigration).not.toContain("drop table");
    expect(hardeningMigration).not.toContain("drop column");
    expect(hardeningMigration).not.toContain("truncate");
    expect(hardeningMigration).not.toMatch(/\bdelete\s+from\b/);
  });

  it("derives append-only audit events from successful row mutations", () => {
    expect(hardeningMigration).toContain(
      "revoke insert on table public.class_student_audit_events from authenticated",
    );
    expect(hardeningMigration).toContain(
      'drop policy if exists "class_student_audit_insert_staff"',
    );
    expect(hardeningMigration).toContain(
      "create trigger classes_write_roster_audit",
    );
    expect(hardeningMigration).toContain(
      "create trigger students_write_roster_audit",
    );
    expect(hardeningMigration).toContain(
      "create trigger student_class_members_write_roster_audit",
    );
    expect(hardeningMigration).toContain(
      "insert into public.classroom_audit_events",
    );
    expect(hardeningMigration).toContain(
      "old.status is not distinct from new.status",
    );
  });
});
