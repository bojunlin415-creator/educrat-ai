import { describe, expect, it } from "vitest";

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MODULE_ROOT = "lib/ai-generation";
const FORBIDDEN_IMPORTS = [
  "react",
  "next/",
  "next/server",
  "@supabase",
  "@/lib/supabase",
  "@/app/",
  "@/components/",
  "@/lib/curriculum/service",
  'from "openai"',
  "from 'openai'",
  "fetch(",
] as const;

const INFRASTRUCTURE_FORBIDDEN_IMPORTS = [
  "react",
  "next/",
  "next/server",
  "@supabase",
  "@/lib/supabase",
  "@/app/",
  "@/components/",
  "@/lib/curriculum/service",
  'from "openai"',
  "from 'openai'",
] as const;

function listTypeScriptFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return [...listTypeScriptFiles(path)];
    return path.endsWith(".ts") ? [path] : [];
  });
}

describe("AI generation architecture boundary", () => {
  it("does not import UI, framework, database, SDK, or HTTP behavior", () => {
    const files = listTypeScriptFiles(MODULE_ROOT).filter(
      (file) =>
        !file.endsWith(".test.ts") && !file.includes("/infrastructure/"),
    );
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const forbiddenImport of FORBIDDEN_IMPORTS) {
        expect(source).not.toContain(forbiddenImport);
      }
    }
  });

  it("keeps provider infrastructure isolated from UI, framework, database, and SDK imports", () => {
    const files = listTypeScriptFiles(
      join(MODULE_ROOT, "infrastructure"),
    ).filter((file) => !file.endsWith(".test.ts"));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const forbiddenImport of INFRASTRUCTURE_FORBIDDEN_IMPORTS) {
        expect(source).not.toContain(forbiddenImport);
      }
    }
  });
});
