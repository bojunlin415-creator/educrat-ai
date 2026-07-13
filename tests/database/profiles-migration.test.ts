import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "database/migrations/20260713160000_s03_create_profiles.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();

describe("profiles migration security contract", () => {
  it("enables and forces row-level security", () => {
    expect(migration).toContain(
      "alter table public.profiles enable row level security",
    );
    expect(migration).toContain(
      "alter table public.profiles force row level security",
    );
  });

  it.each(["select", "insert", "update"])(
    "defines an authenticated %s policy scoped to auth.uid()",
    (operation) => {
      expect(migration).toContain(`for ${operation}\nto authenticated`);
      expect(migration).toContain("(select auth.uid()) = id");
    },
  );

  it("does not grant delete access", () => {
    expect(migration).not.toMatch(/grant\s+delete/);
    expect(migration).not.toMatch(/for\s+delete/);
  });

  it("limits grants and maintains updated_at with a trigger", () => {
    expect(migration).toContain(
      "revoke all on table public.profiles from anon, authenticated",
    );
    expect(migration).toContain("create trigger profiles_set_updated_at");
    expect(migration).toContain("execute function public.set_updated_at()");
  });

  it("exposes a data-free health function without granting profile access to anon", () => {
    expect(migration).toContain("function public.database_health()");
    expect(migration).toContain(
      "grant execute on function public.database_health() to anon, authenticated",
    );
    expect(migration).not.toMatch(
      /grant\s+select\s+on\s+table\s+public\.profiles\s+to\s+anon/,
    );
  });
});
