import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const files = [
  "lib/curriculum-export/domain/document.ts",
  "lib/curriculum-export/application/export-mode.ts",
  "lib/curriculum-export/application/filename.ts",
  "lib/curriculum-export/application/serialization.ts",
  "lib/curriculum-export/application/validation.ts",
  "lib/curriculum-export/infrastructure/pdf-renderer.ts",
].map((file) => ({
  file,
  source: readFileSync(join(process.cwd(), file), "utf8"),
}));

describe("curriculum export architecture boundary", () => {
  it("keeps export core independent from React, Next, browser APIs, and product persistence", () => {
    for (const { file, source } of files) {
      expect(source, file).not.toMatch(/from ["']react["']/);
      expect(source, file).not.toMatch(/next\//);
      expect(source, file).not.toMatch(/Supabase|createClient|Database/);
      expect(source, file).not.toMatch(/window\.|globalThis\.document/);
    }
  });

  it("keeps PDF library out of the export core contract", () => {
    for (const { file, source } of files) {
      expect(source, file).not.toMatch(/pdf-lib|jspdf|puppeteer|playwright/);
    }
  });
});
