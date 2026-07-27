import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(process.cwd(), "lib/re-authentication");
const PRODUCTION_FILE_PATTERN = /\.(ts)$/;
const TEST_FILE_PATTERN = /\.test\.ts$/;

function listFiles(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
    })
    .sort();
}

function productionFiles(): string[] {
  return listFiles(ROOT).filter(
    (file) =>
      PRODUCTION_FILE_PATTERN.test(file) && !TEST_FILE_PATTERN.test(file),
  );
}

function read(file: string): string {
  return fs.readFileSync(file, "utf8");
}

function importsOf(file: string): string[] {
  const source = read(file);
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
    (match) => match[1] ?? "",
  );
  const sideEffectImports = [...source.matchAll(/import\s+["']([^"']+)["']/g)]
    .map((match) => match[1] ?? "")
    .filter(Boolean);
  return [...imports, ...sideEffectImports];
}

describe("re-authentication architecture", () => {
  it("does not depend on frameworks, persistence, or product modules", () => {
    const forbidden = [
      "react",
      "next",
      "@supabase",
      "@/app",
      "@/components",
      "@/lib/supabase",
      "@/lib/curriculum",
      "@/lib/lifecycle",
      "@/lib/dependency",
      "@/lib/audit",
      "@/lib/authorization",
    ];

    for (const file of productionFiles()) {
      const imports = importsOf(file);
      expect(
        imports.filter((specifier) =>
          forbidden.some((prefix) => specifier.startsWith(prefix)),
        ),
        file,
      ).toEqual([]);
    }
  });

  it("keeps layer dependencies pointed inward", () => {
    const allowedByLayer: Record<string, readonly string[]> = {
      application: [
        "@/lib/re-authentication/application",
        "@/lib/re-authentication/domain",
        "@/lib/re-authentication/interfaces",
        "@/lib/re-authentication/shared",
      ],
      domain: [
        "@/lib/re-authentication/domain",
        "@/lib/re-authentication/shared",
      ],
      interfaces: [
        "@/lib/re-authentication/domain",
        "@/lib/re-authentication/interfaces",
      ],
      shared: ["@/lib/re-authentication/shared"],
    };

    for (const file of productionFiles()) {
      const relative = path.relative(ROOT, file);
      const layer = relative.split(path.sep)[0] ?? "";
      if (relative === "index.ts") continue;
      const allowed = allowedByLayer[layer] ?? [];
      const imports = importsOf(file).filter((specifier) =>
        specifier.startsWith("@/lib/re-authentication"),
      );

      expect(
        imports.filter(
          (specifier) =>
            !allowed.some((prefix) => specifier.startsWith(prefix)),
        ),
        file,
      ).toEqual([]);
    }
  });

  it("has no circular imports inside production source", () => {
    const files = productionFiles();
    const byAlias = new Map(
      files.map((file) => [
        `@/lib/re-authentication/${path
          .relative(ROOT, file)
          .replace(/\.ts$/, "")
          .split(path.sep)
          .join("/")}`,
        file,
      ]),
    );
    const graph = new Map<string, string[]>(
      files.map((file) => [
        file,
        importsOf(file)
          .map((specifier) => byAlias.get(specifier))
          .filter((specifier): specifier is string => specifier !== undefined),
      ]),
    );
    const visiting = new Set<string>();
    const visited = new Set<string>();

    function visit(file: string): boolean {
      if (visiting.has(file)) return true;
      if (visited.has(file)) return false;
      visiting.add(file);
      for (const next of graph.get(file) ?? []) {
        if (visit(next)) return true;
      }
      visiting.delete(file);
      visited.add(file);
      return false;
    }

    expect(files.some((file) => visit(file))).toBe(false);
  });
});
