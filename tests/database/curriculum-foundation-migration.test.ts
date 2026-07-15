import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260715090000_s07_create_curriculum_foundation.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();

const curriculumTables = [
  "subjects",
  "grades",
  "publishers",
  "curriculums",
  "curriculum_versions",
  "chapters",
  "lessons",
] as const;

describe("Sprint 7 curriculum foundation migration", () => {
  it.each(curriculumTables)(
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

  it("seeds database-managed subjects, grades, and extensible publishers", () => {
    expect(migration).toContain("('chinese', '國語', 10)");
    expect(migration).toContain("('life', '生活', 60)");
    expect(migration).toContain("('1', '一年級', 1)");
    expect(migration).toContain("('6', '六年級', 6)");
    expect(migration).toContain("('nan-yi', '南一', 10)");
    expect(migration).toContain("('kang-hsuan', '康軒', 20)");
    expect(migration).toContain("('han-lin', '翰林', 30)");
    expect(migration).not.toMatch(/create\s+type\s+.*publisher/);
  });

  it("enforces the curriculum hierarchy and non-overwriting versions", () => {
    expect(migration).toContain(
      "constraint curriculum_versions_unique_version unique (curriculum_id, version)",
    );
    expect(migration).toContain(
      "constraint chapters_unique_number unique (curriculum_version_id, chapter_no)",
    );
    expect(migration).toContain(
      "constraint lessons_unique_number unique (chapter_id, lesson_no)",
    );
    expect(migration).toContain("curriculums_unique_name_per_organization_idx");
    expect(migration).toContain("learning_objectives text[]");
  });

  it("isolates tenant reads by active organization", () => {
    expect(migration).toContain(
      'policy "curriculums_select_active_organization"',
    );
    expect(migration).toContain(
      "organization_id = public.get_active_organization_id()",
    );
    expect(migration).toContain(
      "public.is_active_organization_member(organization_id)",
    );
    expect(migration).toContain(
      'policy "curriculum_versions_select_active_organization"',
    );
    expect(migration).toContain('policy "chapters_select_active_organization"');
    expect(migration).toContain('policy "lessons_select_active_organization"');
  });

  it("limits mutations to owner/admin without direct insert or delete", () => {
    expect(migration).toContain(
      "array['organization_owner', 'organization_admin']::text[]",
    );
    expect(migration).not.toMatch(
      /grant\s+insert\s+on\s+table\s+public\.curriculums/,
    );
    expect(migration).not.toMatch(
      /grant\s+delete\s+on\s+table\s+public\.(curriculums|curriculum_versions|chapters|lessons)/,
    );
    expect(migration).not.toMatch(
      /create\s+policy\s+"[^"]+"\s+on\s+public\.curriculums\s+for\s+delete/,
    );
  });

  it("atomically creates a curriculum and initial version from caller context", () => {
    const functionStart = migration.indexOf(
      "create or replace function public.create_curriculum_with_initial_version",
    );
    const functionEnd = migration.indexOf(
      "revoke all on function public.create_curriculum_with_initial_version",
    );
    const createFunction = migration.slice(functionStart, functionEnd);

    expect(createFunction).toContain("security definer");
    expect(createFunction).toContain("set search_path = ''");
    expect(createFunction).toContain("v_user_id uuid := auth.uid()");
    expect(createFunction).toContain("public.get_active_organization_id()");
    expect(createFunction).toContain("insert into public.curriculums");
    expect(createFunction).toContain("insert into public.curriculum_versions");
    expect(createFunction).not.toContain("p_organization_id");
    expect(createFunction).not.toContain("p_created_by");
    expect(migration).toContain(
      "grant execute on function public.create_curriculum_with_initial_version",
    );
  });

  it("does not alter prior tables or create out-of-scope resources", () => {
    expect(migration).not.toMatch(/drop\s+(table|function|policy|trigger)/);
    expect(migration).not.toMatch(/truncate\s+/);
    expect(migration).not.toMatch(/delete\s+from\s+public\./);
    expect(migration).not.toMatch(
      /alter\s+table\s+public\.(profiles|organizations|organization_members|user_preferences)/,
    );
    expect(migration).not.toContain("storage.objects");
    expect(migration).not.toContain("questions");
    expect(migration).not.toContain("worksheets");
  });
});
