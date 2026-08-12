import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "lib", "subjects");

function productionFiles(): readonly string[] {
  return fs
    .readdirSync(ROOT)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => path.join(ROOT, file));
}

function importsOf(file: string): readonly string[] {
  const source = fs.readFileSync(file, "utf8");
  return Array.from(
    source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g),
    (match) => match[1],
  ).filter((specifier): specifier is string => specifier !== undefined);
}

describe("subject capability architecture", () => {
  it("remains framework-, persistence-, and product-feature-neutral", () => {
    const forbidden = [
      "react",
      "next",
      "@supabase",
      "@/app",
      "@/components",
      "@/lib/supabase",
      "@/lib/curriculum",
      "@/lib/assignment",
      "@/lib/learning-analytics",
      "@/lib/adaptive-learning",
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

  it("does not infer identity from localized display labels", () => {
    const source = productionFiles()
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");
    for (const displayLabel of [
      "國語",
      "英文",
      "數學",
      "自然",
      "社會",
      "生活",
    ]) {
      expect(source).not.toContain(displayLabel);
    }
  });

  it("contains no circular production imports", () => {
    const files = productionFiles();
    const byAlias = new Map(
      files.map((file) => [
        `@/lib/subjects/${path.basename(file, ".ts")}`,
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
