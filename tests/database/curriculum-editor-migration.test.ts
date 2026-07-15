import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260715160000_s08_extend_curriculum_editor.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();

const mutationFunctions = [
  "create_chapter",
  "update_chapter",
  "delete_chapter",
  "reorder_chapters",
  "create_lesson",
  "update_lesson",
  "delete_lesson",
  "reorder_lessons",
] as const;

describe("Sprint 8 curriculum editor migration", () => {
  it("only extends the existing hierarchy with necessary fields", () => {
    expect(migration).toContain("alter table public.chapters");
    expect(migration).toContain(
      "add column status text not null default 'draft'",
    );
    expect(migration).toContain("alter table public.lessons");
    expect(migration).toContain("add column teaching_notes text");
    expect(migration).not.toMatch(/create\s+table/);
    expect(migration).not.toMatch(/drop\s+/);
    expect(migration).not.toMatch(/truncate\s+/);
    expect(migration).not.toMatch(
      /alter\s+table\s+public\.(profiles|organizations|organization_members|user_preferences|curriculums|curriculum_versions)/,
    );
  });

  it.each(mutationFunctions)(
    "secures %s with caller context and least privilege",
    (functionName) => {
      const start = migration.indexOf(
        `create or replace function public.${functionName}`,
      );
      expect(start).toBeGreaterThan(-1);
      const body = migration.slice(start, migration.indexOf("$$;", start) + 3);
      expect(body).toContain("security definer");
      expect(body).toContain("set search_path = ''");
      expect(body).toContain("auth.uid()");
      expect(body).toContain("public.get_active_organization_id()");
      expect(body).toContain("public.has_organization_role(");
      expect(body).toContain("'organization_owner', 'organization_admin'");
      expect(migration).toContain(
        `grant execute on function public.${functionName}`,
      );
      expect(migration).toMatch(
        new RegExp(
          `revoke all on function public\\.${functionName}[\\s\\S]*?from public, anon, service_role`,
        ),
      );
    },
  );

  it("limits all editor mutations to version 1", () => {
    expect(migration.match(/curriculum_version\.version = 1/g)?.length).toBe(8);
    expect(migration).not.toContain("insert into public.curriculum_versions");
  });

  it("validates complete server-side reorder sets under parent locks", () => {
    expect(migration).toContain("cardinality(p_ordered_ids)");
    expect(migration).toContain("count(distinct ordered_id)");
    expect(migration).toContain("for update");
    expect(migration).toContain("order_no = order_no + 1000000");
    expect(migration).toContain("with ordinality");
  });

  it("keeps direct writes denied and out-of-scope resources absent", () => {
    expect(migration).not.toMatch(
      /grant\s+(insert|update|delete)\s+on\s+table\s+public\.(chapters|lessons)/,
    );
    expect(migration).not.toContain("service_role key");
    expect(migration).not.toContain("storage.objects");
    expect(migration).not.toContain("questions");
    expect(migration).not.toContain("worksheets");
    expect(migration).not.toContain("openai");
  });
});
