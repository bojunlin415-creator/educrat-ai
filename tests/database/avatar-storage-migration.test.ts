import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260714150000_s05_create_avatar_storage.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();

describe("avatar storage migration security contract", () => {
  it("creates a private bucket with size and MIME restrictions", () => {
    expect(migration).toContain("'avatars'");
    expect(migration).toMatch(/public[\s\S]*false/);
    expect(migration).toContain("2097152");
    expect(migration).toContain("'image/jpeg'");
    expect(migration).toContain("'image/png'");
    expect(migration).toContain("'image/webp'");
  });

  it.each(["select", "insert", "update", "delete"])(
    "defines an authenticated %s policy",
    (operation) => {
      expect(migration).toContain(`for ${operation}\nto authenticated`);
    },
  );

  it("scopes every object policy to the avatars bucket and auth.uid folder", () => {
    expect(migration.match(/bucket_id = 'avatars'/g)).toHaveLength(5);
    expect(
      migration.match(
        /\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)::text\)/g,
      ),
    ).toHaveLength(5);
  });

  it("does not expose a public-read policy", () => {
    expect(migration).not.toMatch(/to\s+anon/);
    expect(migration).not.toMatch(/public\s*=\s*true/);
  });
});
