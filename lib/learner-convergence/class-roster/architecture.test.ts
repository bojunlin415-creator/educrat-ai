import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const rosterRoot = path.join(
  projectRoot,
  "lib",
  "learner-convergence",
  "class-roster",
);

function productionFiles(): readonly string[] {
  return fs
    .readdirSync(rosterRoot)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => path.join(rosterRoot, file));
}

function importsOf(file: string): readonly string[] {
  const source = fs.readFileSync(file, "utf8");
  return Array.from(
    source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g),
    (match) => match[1],
  ).filter((specifier): specifier is string => specifier !== undefined);
}

describe("LE-001 Phase 5A Class roster architecture", () => {
  it("keeps authority, parity, and access rules framework-neutral", () => {
    const forbidden = [
      "react",
      "next",
      "@supabase",
      "@/app",
      "@/components",
      "@/lib/supabase",
      "@/lib/classroom",
    ];

    for (const file of productionFiles()) {
      expect(
        importsOf(file).filter((specifier) =>
          forbidden.some(
            (prefix) =>
              specifier === prefix || specifier.startsWith(`${prefix}/`),
          ),
        ),
        file,
      ).toEqual([]);
    }
  });

  it("has no circular imports in the Class roster core", () => {
    const files = productionFiles();
    const aliasPrefix = "@/lib/learner-convergence/class-roster/";
    const byAlias = new Map(
      files.map((file) => [
        `${aliasPrefix}${path.basename(file, ".ts")}`,
        file,
      ]),
    );
    const graph = new Map(
      files.map((file) => [
        file,
        importsOf(file)
          .map((specifier) => byAlias.get(specifier))
          .filter((target): target is string => target !== undefined),
      ]),
    );
    const visited = new Set<string>();
    const active = new Set<string>();

    function visit(file: string): void {
      if (active.has(file)) throw new Error(`Circular import: ${file}`);
      if (visited.has(file)) return;
      active.add(file);
      for (const dependency of graph.get(file) ?? []) visit(dependency);
      active.delete(file);
      visited.add(file);
    }

    for (const file of files) visit(file);
    expect(visited.size).toBe(files.length);
  });

  it("uses fixed batched reads and never reads identity or broad Profile sources", () => {
    const adapter = fs.readFileSync(
      path.join(projectRoot, "lib", "classroom", "roster.ts"),
      "utf8",
    );

    expect(adapter.match(/\.from\("student_class_members"\)/g)).toHaveLength(1);
    expect(adapter.match(/\.from\("students"\)/g)).toHaveLength(1);
    expect(adapter.match(/\.from\("class_enrollments"\)/g)).toHaveLength(1);
    expect(adapter).not.toContain('.from("profiles")');
    expect(adapter).not.toContain('.from("student_account_links")');
    expect(adapter).not.toContain("auth.users");
    expect(adapter).not.toMatch(/\.(?:delete|insert|update|upsert)\s*\(/);
    expect(adapter).not.toContain("birthday");
    expect(adapter).not.toContain("guardian");
    expect(adapter).not.toContain("accountLink");
  });

  it("cuts over only the Class detail GET consumer", () => {
    const classRoute = fs.readFileSync(
      path.join(projectRoot, "app", "api", "classes", "[id]", "route.ts"),
      "utf8",
    );
    const untouchedConsumers = [
      path.join(projectRoot, "lib", "assignment", "service.ts"),
      path.join(projectRoot, "lib", "teacher-dashboard", "service.ts"),
      path.join(projectRoot, "lib", "reporting", "service.ts"),
    ];

    expect(classRoute).toContain("getCanonicalClassRosterDetail");
    expect(classRoute).toContain("updateClass");
    expect(classRoute).toContain("archiveClass");
    for (const file of untouchedConsumers) {
      expect(fs.readFileSync(file, "utf8")).not.toContain("classroom/roster");
    }
  });
});
