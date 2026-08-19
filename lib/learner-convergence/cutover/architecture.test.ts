import fs from "node:fs";
import path from "node:path";

const cutoverRoot = path.join(
  process.cwd(),
  "lib",
  "learner-convergence",
  "cutover",
);

function productionFiles(): readonly string[] {
  return fs
    .readdirSync(cutoverRoot)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => path.join(cutoverRoot, file));
}

function importsOf(file: string): readonly string[] {
  const source = fs.readFileSync(file, "utf8");
  return Array.from(
    source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g),
    (match) => match[1],
  ).filter((specifier): specifier is string => specifier !== undefined);
}

function sourceFiles(root: string): readonly string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [absolute] : [];
  });
}

describe("LE-001 Phase 5 architecture boundary", () => {
  it("keeps planning contracts framework-neutral and product neutral", () => {
    const forbidden = [
      "react",
      "next",
      "@supabase",
      "@/app",
      "@/components",
      "@/lib/supabase",
      "@/lib/assignment",
      "@/lib/classroom",
      "@/lib/learning-analytics",
      "@/lib/guardian-verification",
      "@/lib/parent-portal",
      "@/lib/reporting",
      "@/lib/teacher-dashboard",
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

  it("does not expose PII or auth.users through snapshot contracts", () => {
    const contract = fs.readFileSync(
      path.join(cutoverRoot, "snapshot-contract.ts"),
      "utf8",
    );

    expect(contract).not.toMatch(
      /auth\.users|email|birthday|displayName|studentName|phone|address/,
    );
    expect(contract).toContain("organizationId");
    expect(contract).toContain("relationshipId");
    expect(contract).toContain("studentId");
  });

  it("does not wire cutover planning into existing runtime consumers", () => {
    const roots = [
      "app",
      "lib/assignment",
      "lib/classroom",
      "lib/learning-analytics",
      "lib/adaptive-learning",
      "lib/reporting",
      "lib/teacher-dashboard",
      "lib/guardian-verification",
      "lib/parent-portal",
    ].map((directory) => path.join(process.cwd(), directory));
    const imports = roots
      .flatMap(sourceFiles)
      .flatMap(importsOf)
      .filter((specifier) =>
        specifier.startsWith("@/lib/learner-convergence/cutover"),
      );

    expect(imports).toEqual([]);
  });

  it("has no circular production imports", () => {
    const files = productionFiles();
    const aliasPrefix = "@/lib/learner-convergence/cutover/";
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
});
