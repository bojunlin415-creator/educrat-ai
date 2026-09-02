import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "lib", "learner-convergence");
const coreDirectories = ["application", "domain", "interfaces"];

function shadowCoreFiles(): readonly string[] {
  return ["analyze.ts", "domain.ts", "interfaces.ts", "run.ts"].map((file) =>
    path.join(root, "shadow", file),
  );
}

function productionFiles(directory: string): readonly string[] {
  const absolute = path.join(root, directory);
  return fs
    .readdirSync(absolute)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => path.join(absolute, file));
}

function importsOf(file: string): readonly string[] {
  const source = fs.readFileSync(file, "utf8");
  return Array.from(
    source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g),
    (match) => match[1],
  ).filter((specifier): specifier is string => specifier !== undefined);
}

describe("LE-001 architecture", () => {
  it("keeps discrepancy and resolver contracts framework-neutral", () => {
    const forbidden = [
      "react",
      "next",
      "@supabase",
      "@/app",
      "@/components",
      "@/lib/supabase",
      "@/lib/assignment",
      "@/lib/learning-analytics",
      "@/lib/guardian-verification",
      "@/lib/parent-portal",
    ];

    for (const directory of coreDirectories) {
      for (const file of productionFiles(directory)) {
        expect(
          importsOf(file).filter((specifier) =>
            forbidden.some(
              (prefix) =>
                specifier === prefix || specifier.startsWith(`${prefix}/`),
            ),
          ),
          file,
        ).toEqual([]);
      }
    }
    for (const file of shadowCoreFiles()) {
      expect(
        importsOf(file).filter((specifier) =>
          forbidden.some(
            (prefix) =>
              specifier === prefix || specifier.startsWith(`${prefix}/`),
          ),
        ),
        file,
      ).toEqual([]);
    }
  });

  it("has no circular production imports", () => {
    const files = [
      ...coreDirectories.flatMap(productionFiles),
      ...productionFiles("infrastructure"),
      ...shadowCoreFiles(),
    ];
    const aliasPrefix = "@/lib/learner-convergence/";
    const byAlias = new Map(
      files.map((file) => [
        `${aliasPrefix}${path.relative(root, file).replace(/\.ts$/, "")}`,
        file,
      ]),
    );
    const graph = new Map(
      files.map((file) => [
        file,
        importsOf(file)
          .map((specifier) => byAlias.get(specifier))
          .filter((target): target is string => target !== undefined),
      ]),
    );
    const visited = new Set<string>();
    const active = new Set<string>();

    function visit(file: string): void {
      if (active.has(file)) throw new Error(`Circular import: ${file}`);
      if (visited.has(file)) return;
      active.add(file);
      for (const dependency of graph.get(file) ?? []) visit(dependency);
      active.delete(file);
      visited.add(file);
    }

    for (const file of files) visit(file);
    expect(visited.size).toBe(files.length);
  });

  it("keeps Phase 3 operator tooling outside public API and product routes", () => {
    const operator = fs.readFileSync(path.join(root, "operator.ts"), "utf8");

    expect(operator).toContain('import "server-only"');
    expect(operator).not.toContain("@/app/");
    expect(operator).not.toContain("@/lib/supabase/");
    expect(operator).not.toContain("next/");
    expect(operator).not.toContain("react");
  });

  it("keeps Phase 4 shadow reads batched and read-only", () => {
    const shadowServer = fs.readFileSync(
      path.join(root, "shadow", "server.ts"),
      "utf8",
    );

    expect(shadowServer.match(/\.rpc\(/g)).toHaveLength(1);
    expect(shadowServer).not.toMatch(/\.(?:delete|insert|update|upsert)\s*\(/);
  });

  it("cuts Assignment expansion and recipient identity to their canonical authorities", () => {
    const assignmentService = fs.readFileSync(
      path.join(process.cwd(), "lib", "assignment", "service.ts"),
      "utf8",
    );
    const assignmentExpansion = fs.readFileSync(
      path.join(process.cwd(), "lib", "assignment", "class-expansion.ts"),
      "utf8",
    );

    expect(assignmentExpansion).toContain("createClassRosterSource");
    expect(assignmentExpansion).toContain('.from("class_enrollments")');
    expect(assignmentExpansion).not.toMatch(
      /auth\.users|\.from\("profiles"\)|\.from\("student_account_links"\)/,
    );
    expect(assignmentService).not.toContain('.from("class_enrollments")');
    expect(assignmentService).not.toContain('.from("student_class_members")');
    expect(assignmentService).toContain("prepareAssignmentClassExpansion");
    expect(assignmentService).toContain(
      "create_assignment_with_canonical_recipients",
    );
    expect(assignmentService).toContain("get_assignment_recipient_projection");
    expect(assignmentService).not.toContain(
      "requireMaterializableAssignmentRecipients",
    );
    const createFlow = assignmentService.slice(
      assignmentService.indexOf("export async function createAssignment"),
      assignmentService.indexOf("export async function updateAssignment"),
    );
    expect(createFlow.indexOf("prepareAssignmentClassExpansion")).toBeLessThan(
      createFlow.indexOf('.from("assignments")'),
    );
    expect(createFlow.indexOf("createCanonicalAssignment")).toBeLessThan(
      createFlow.indexOf('.from("assignments")'),
    );
    expect(assignmentService).toContain('.from("assignment_students")');
    expect(assignmentService).toContain("const studentId = user.id");
  });
});
