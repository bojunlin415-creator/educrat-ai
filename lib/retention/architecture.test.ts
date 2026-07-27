import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const retentionRoot = path.join(process.cwd(), "lib", "retention");

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolutePath);
    if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) {
      return [];
    }
    return [absolutePath];
  });
}

function readImports(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return Array.from(
    source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g),
    (match) => match[1],
  ).filter((specifier): specifier is string => specifier !== undefined);
}

function resolveRetentionImport(
  importer: string,
  specifier: string,
): string | null {
  let basePath: string;
  if (specifier.startsWith("@/lib/retention/")) {
    basePath = path.join(
      retentionRoot,
      specifier.slice("@/lib/retention/".length),
    );
  } else if (specifier.startsWith(".")) {
    basePath = path.resolve(path.dirname(importer), specifier);
  } else {
    return null;
  }
  return (
    [`${basePath}.ts`, path.join(basePath, "index.ts")].find(existsSync) ?? null
  );
}

function layerOf(file: string): string {
  return path.relative(retentionRoot, file).split(path.sep)[0] ?? "";
}

describe("retention and legal hold foundation architecture", () => {
  const sourceFiles = listSourceFiles(retentionRoot);

  it("does not depend on frameworks, persistence, or product modules", () => {
    const forbiddenPrefixes = [
      "react",
      "next",
      "@supabase/",
      "@/app",
      "@/components",
      "@/lib/audit",
      "@/lib/auth",
      "@/lib/authorization",
      "@/lib/curriculum",
      "@/lib/database",
      "@/lib/dependency",
      "@/lib/lifecycle",
      "@/lib/supabase",
    ];

    for (const file of sourceFiles) {
      for (const specifier of readImports(file)) {
        expect(
          forbiddenPrefixes.some(
            (prefix) =>
              specifier === prefix || specifier.startsWith(`${prefix}/`),
          ),
          `${path.relative(process.cwd(), file)} imports ${specifier}`,
        ).toBe(false);
      }
    }
  });

  it("keeps Clean Architecture dependencies inward", () => {
    const allowedLayers: Readonly<Record<string, readonly string[]>> = {
      application: ["application", "domain", "interfaces", "shared"],
      domain: ["domain", "shared"],
      interfaces: ["domain", "interfaces", "shared"],
      shared: ["shared"],
    };

    for (const file of sourceFiles) {
      const sourceLayer = layerOf(file);
      if (!(sourceLayer in allowedLayers)) continue;
      for (const specifier of readImports(file)) {
        const target = resolveRetentionImport(file, specifier);
        if (!target) continue;
        expect(
          allowedLayers[sourceLayer]?.includes(layerOf(target)),
          `${sourceLayer} cannot depend on ${layerOf(target)}`,
        ).toBe(true);
      }
    }
  });

  it("contains no circular dependency module imports", () => {
    const graph = new Map(
      sourceFiles.map((file) => [
        file,
        readImports(file)
          .map((specifier) => resolveRetentionImport(file, specifier))
          .filter((target): target is string => target !== null),
      ]),
    );
    const visited = new Set<string>();
    const active = new Set<string>();

    function visit(file: string): void {
      if (active.has(file)) {
        throw new Error(
          `Circular retention import: ${path.relative(process.cwd(), file)}`,
        );
      }
      if (visited.has(file)) return;
      active.add(file);
      for (const imported of graph.get(file) ?? []) visit(imported);
      active.delete(file);
      visited.add(file);
    }

    for (const file of sourceFiles) visit(file);
    expect(visited.size).toBe(sourceFiles.length);
  });

  it("keeps RetentionPolicy as an interface-only port", () => {
    const policy = readFileSync(
      path.join(retentionRoot, "interfaces", "retention-policy.ts"),
      "utf8",
    );

    expect(policy).toContain("export interface RetentionPolicy");
    expect(policy).not.toMatch(/\bclass\s+RetentionPolicy\b/);
  });

  it("keeps production retention code free from I/O and runtime side effects", () => {
    const forbiddenPatterns = [
      /process\.env/,
      /\bfetch\s*\(/,
      /Date\.now\s*\(/,
      /new\s+Date\b/,
      /Math\.random\s*\(/,
      /setTimeout\s*\(/,
      /\beval\s*\(/,
      /new\s+Function\b/,
    ];

    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      for (const pattern of forbiddenPatterns) {
        expect(
          pattern.test(source),
          `${path.relative(process.cwd(), file)} contains ${pattern.source}`,
        ).toBe(false);
      }
    }
  });
});
