import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const auditRoot = path.join(process.cwd(), "lib", "audit");

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

function resolveAuditImport(
  importer: string,
  specifier: string,
): string | null {
  let basePath: string;
  if (specifier.startsWith("@/lib/audit/")) {
    basePath = path.join(auditRoot, specifier.slice("@/lib/audit/".length));
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
  return path.relative(auditRoot, file).split(path.sep)[0] ?? "";
}

describe("immutable audit architecture", () => {
  const sourceFiles = listSourceFiles(auditRoot);

  it("does not depend on framework, persistence, authorization, or product modules", () => {
    const forbiddenPrefixes = [
      "react",
      "next",
      "@supabase/",
      "@/app",
      "@/components",
      "@/lib/authorization",
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
      application: ["domain", "interfaces", "shared"],
      domain: ["domain", "shared"],
      interfaces: ["domain", "interfaces", "shared"],
      shared: ["shared"],
    };

    for (const file of sourceFiles) {
      const sourceLayer = layerOf(file);
      if (!(sourceLayer in allowedLayers)) continue;
      for (const specifier of readImports(file)) {
        const target = resolveAuditImport(file, specifier);
        if (!target) continue;
        expect(
          allowedLayers[sourceLayer]?.includes(layerOf(target)),
          `${sourceLayer} cannot depend on ${layerOf(target)}`,
        ).toBe(true);
      }
    }
  });

  it("contains no circular audit imports", () => {
    const graph = new Map(
      sourceFiles.map((file) => [
        file,
        readImports(file)
          .map((specifier) => resolveAuditImport(file, specifier))
          .filter((target): target is string => target !== null),
      ]),
    );
    const visited = new Set<string>();
    const active = new Set<string>();

    function visit(file: string): void {
      if (active.has(file)) {
        throw new Error(
          `Circular audit import: ${path.relative(process.cwd(), file)}`,
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

  it("keeps repository and hash-chain ports interface-only", () => {
    const repository = readFileSync(
      path.join(auditRoot, "interfaces", "audit-repository.ts"),
      "utf8",
    );
    const hashChain = readFileSync(
      path.join(auditRoot, "interfaces", "audit-hash-chain.ts"),
      "utf8",
    );

    expect(repository).toContain("export interface AuditRepository");
    expect(repository).not.toMatch(/\bclass\s+AuditRepository\b/);
    expect(repository).not.toMatch(/\b(update|delete|remove)\s*\(/);
    expect(hashChain).toContain("export interface AuditHashChain");
    expect(hashChain).not.toMatch(/\bclass\s+AuditHashChain\b/);
  });

  it("keeps production audit code free from runtime and persistence side effects", () => {
    const forbiddenPatterns = [
      /from\s+["']node:crypto["']/,
      /Date\.now\s*\(/,
      /Math\.random\s*\(/,
      /process\.env/,
      /\bfetch\s*\(/,
      /\beval\s*\(/,
      /new\s+Function\b/,
      /setTimeout\s*\(/,
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
