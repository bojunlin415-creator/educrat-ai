import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const lifecycleRoot = path.join(process.cwd(), "lib", "lifecycle");

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

function resolveLifecycleImport(
  importer: string,
  specifier: string,
): string | null {
  let basePath: string;
  if (specifier.startsWith("@/lib/lifecycle/")) {
    basePath = path.join(
      lifecycleRoot,
      specifier.slice("@/lib/lifecycle/".length),
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
  return path.relative(lifecycleRoot, file).split(path.sep)[0] ?? "";
}

describe("lifecycle foundation architecture", () => {
  const sourceFiles = listSourceFiles(lifecycleRoot);

  it("does not depend on frameworks, persistence, audit, or product modules", () => {
    const forbiddenPrefixes = [
      "react",
      "next",
      "@supabase/",
      "@/app",
      "@/components",
      "@/lib/audit",
      "@/lib/curriculum",
      "@/lib/database",
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
        const target = resolveLifecycleImport(file, specifier);
        if (!target) continue;
        expect(
          allowedLayers[sourceLayer]?.includes(layerOf(target)),
          `${sourceLayer} cannot depend on ${layerOf(target)}`,
        ).toBe(true);
      }
    }
  });

  it("contains no circular lifecycle imports", () => {
    const graph = new Map(
      sourceFiles.map((file) => [
        file,
        readImports(file)
          .map((specifier) => resolveLifecycleImport(file, specifier))
          .filter((target): target is string => target !== null),
      ]),
    );
    const visited = new Set<string>();
    const active = new Set<string>();

    function visit(file: string): void {
      if (active.has(file)) {
        throw new Error(
          `Circular lifecycle import: ${path.relative(process.cwd(), file)}`,
        );
      }
      if (visited.has(file)) return;
      active.add(file);
      for (const dependency of graph.get(file) ?? []) visit(dependency);
      active.delete(file);
      visited.add(file);
    }

    for (const file of sourceFiles) visit(file);
    expect(visited.size).toBe(sourceFiles.length);
  });

  it("keeps policy and definition provider as interface-only ports", () => {
    const policy = readFileSync(
      path.join(lifecycleRoot, "interfaces", "lifecycle-policy.ts"),
      "utf8",
    );
    const provider = readFileSync(
      path.join(
        lifecycleRoot,
        "interfaces",
        "lifecycle-definition-provider.ts",
      ),
      "utf8",
    );

    expect(policy).toContain("export interface LifecyclePolicy");
    expect(provider).toContain("export interface LifecycleDefinitionProvider");
    expect(policy).not.toMatch(/\bclass\s+LifecyclePolicy\b/);
    expect(provider).not.toMatch(/\bclass\s+LifecycleDefinitionProvider\b/);
  });

  it("keeps production lifecycle code free from I/O and runtime side effects", () => {
    const forbiddenPatterns = [
      /process\.env/,
      /\bfetch\s*\(/,
      /Date\.now\s*\(/,
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
