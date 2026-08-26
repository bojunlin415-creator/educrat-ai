import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const foundationRoot = path.join(
  projectRoot,
  "lib",
  "learner-convergence",
  "teacher-dashboard-population",
);

function productionFiles(): readonly string[] {
  return fs
    .readdirSync(foundationRoot)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => path.join(foundationRoot, file));
}

function importsOf(file: string): readonly string[] {
  const source = fs.readFileSync(file, "utf8");
  return Array.from(
    source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g),
    (match) => match[1],
  ).filter((specifier): specifier is string => specifier !== undefined);
}

describe("LE-001 Phase 5B Teacher Dashboard population architecture", () => {
  it("keeps the authority core framework, database, and product neutral", () => {
    const forbidden = [
      "react",
      "next",
      "@supabase",
      "@/app",
      "@/components",
      "@/lib/supabase",
      "@/lib/teacher-dashboard",
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

  it("has no circular production imports", () => {
    const files = productionFiles();
    const aliasPrefix =
      "@/lib/learner-convergence/teacher-dashboard-population/";
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

  it("limits the application adapter to canonical roster reads and safe output", () => {
    const adapter = fs.readFileSync(
      path.join(
        projectRoot,
        "lib",
        "teacher-dashboard",
        "learner-population.ts",
      ),
      "utf8",
    );
    const dashboardService = fs.readFileSync(
      path.join(projectRoot, "lib", "teacher-dashboard", "service.ts"),
      "utf8",
    );

    expect(adapter).toContain("createClassRosterSource");
    expect(adapter).not.toContain("auth.users");
    expect(adapter).not.toContain("student_account_links");
    expect(adapter).not.toContain("profiles");
    expect(adapter).not.toContain("birthday");
    expect(adapter).not.toMatch(/\.(?:delete|insert|update|upsert)\s*\(/);
    expect(dashboardService).toContain("loadTeacherDashboardLearnerPopulation");
    expect(dashboardService).not.toContain("getClass(");
  });
});
