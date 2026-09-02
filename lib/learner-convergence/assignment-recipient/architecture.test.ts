import fs from "node:fs";
import path from "node:path";

const root = path.join(
  process.cwd(),
  "lib",
  "learner-convergence",
  "assignment-recipient",
);

function productionFiles(): readonly string[] {
  return fs
    .readdirSync(root)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => path.join(root, file));
}

function importsOf(file: string): readonly string[] {
  const source = fs.readFileSync(file, "utf8");
  return Array.from(
    source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g),
    (match) => match[1],
  ).filter((specifier): specifier is string => specifier !== undefined);
}

describe("LE-001 Phase 5E Assignment recipient architecture", () => {
  it("keeps the authority model framework-neutral and free of product persistence", () => {
    const forbidden = [
      "react",
      "next",
      "@supabase",
      "@/app",
      "@/components",
      "@/lib/assignment",
      "@/lib/supabase",
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
    const aliasPrefix = "@/lib/learner-convergence/assignment-recipient/";
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
