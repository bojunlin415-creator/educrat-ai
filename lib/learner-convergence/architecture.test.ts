import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "lib", "learner-convergence");
const coreDirectories = ["application", "domain", "interfaces"];

function productionFiles(directory: string): readonly string[] {
  const absolute = path.join(root, directory);
  return fs
    .readdirSync(absolute)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => path.join(absolute, file));
}

function importsOf(file: string): readonly string[] {
  const source = fs.readFileSync(file, "utf8");
  return Array.from(
    source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g),
    (match) => match[1],
  ).filter((specifier): specifier is string => specifier !== undefined);
}

describe("LE-001 architecture", () => {
  it("keeps discrepancy and resolver contracts framework-neutral", () => {
    const forbidden = [
      "react",
      "next",
      "@supabase",
      "@/app",
      "@/components",
      "@/lib/supabase",
      "@/lib/assignment",
      "@/lib/learning-analytics",
      "@/lib/guardian-verification",
      "@/lib/parent-portal",
    ];

    for (const directory of coreDirectories) {
      for (const file of productionFiles(directory)) {
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
    }
  });

  it("has no circular production imports", () => {
    const files = [
      ...coreDirectories.flatMap(productionFiles),
      ...productionFiles("infrastructure"),
    ];
    const aliasPrefix = "@/lib/learner-convergence/";
    const byAlias = new Map(
      files.map((file) => [
        `${aliasPrefix}${path.relative(root, file).replace(/\.ts$/, "")}`,
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

  it("keeps Phase 3 operator tooling outside public API and product routes", () => {
    const operator = fs.readFileSync(path.join(root, "operator.ts"), "utf8");

    expect(operator).toContain('import "server-only"');
    expect(operator).not.toContain("@/app/");
    expect(operator).not.toContain("@/lib/supabase/");
    expect(operator).not.toContain("next/");
    expect(operator).not.toContain("react");
  });
});
