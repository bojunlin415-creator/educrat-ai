import { describe, expect, it } from "vitest";

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MODULE_ROOT = "lib/ai-curriculum";
const FORBIDDEN_IMPORTS = [
  "next/",
  "next/server",
  "react",
  "@supabase",
  "@/lib/supabase",
  "@/app/",
  "@/components/",
  "@/lib/curriculum/service",
] as const;

function listTypeScriptFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return [...listTypeScriptFiles(path)];
    return path.endsWith(".ts") ? [path] : [];
  });
}

describe("AI curriculum architecture boundary", () => {
  it("does not import framework, database, UI, or product persistence modules", () => {
    const files = listTypeScriptFiles(MODULE_ROOT).filter(
      (file) => !file.endsWith(".test.ts"),
    );
    const sources = files.map((file) => readFileSync(file, "utf8"));

    for (const source of sources) {
      for (const forbiddenImport of FORBIDDEN_IMPORTS) {
        expect(source).not.toContain(forbiddenImport);
      }
    }
  });
});
