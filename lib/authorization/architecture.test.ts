import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const authorizationRoot = path.join(process.cwd(), "lib", "authorization");

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

function resolveAuthorizationImport(
  importer: string,
  specifier: string,
): string | null {
  let basePath: string;
  if (specifier.startsWith("@/lib/authorization/")) {
    basePath = path.join(
      authorizationRoot,
      specifier.slice("@/lib/authorization/".length),
    );
  } else if (specifier.startsWith(".")) {
    basePath = path.resolve(path.dirname(importer), specifier);
  } else {
    return null;
  }

  const candidates = [`${basePath}.ts`, path.join(basePath, "index.ts")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function layerOf(file: string): string {
  return path.relative(authorizationRoot, file).split(path.sep)[0] ?? "";
}

describe("authorization architecture boundary", () => {
  const sourceFiles = listSourceFiles(authorizationRoot);

  it("does not import UI, routes, framework runtime, Supabase, or feature services", () => {
    const forbiddenPrefixes = [
      "react",
      "next",
      "@/app",
      "@/components",
      "@/lib/supabase",
      "@/lib/curriculum",
      "@/lib/organization",
      "@supabase/",
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

  it("keeps dependencies directed toward shared and domain layers", () => {
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
        const target = resolveAuthorizationImport(file, specifier);
        if (!target) continue;
        expect(
          allowedLayers[sourceLayer]?.includes(layerOf(target)),
          `${sourceLayer} cannot depend on ${layerOf(target)}`,
        ).toBe(true);
      }
    }
  });

  it("contains no circular authorization imports", () => {
    const graph = new Map(
      sourceFiles.map((file) => [
        file,
        readImports(file)
          .map((specifier) => resolveAuthorizationImport(file, specifier))
          .filter((target): target is string => target !== null),
      ]),
    );
    const visited = new Set<string>();
    const active = new Set<string>();

    function visit(file: string): void {
      if (active.has(file)) {
        throw new Error(
          `Circular authorization import: ${path.relative(process.cwd(), file)}`,
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
});
