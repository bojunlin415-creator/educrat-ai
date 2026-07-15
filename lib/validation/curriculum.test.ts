import { canManageCurriculums } from "@/lib/organization/constants";
import {
  createCurriculumSchema,
  curriculumIdSchema,
  updateCurriculumSchema,
} from "@/lib/validation/curriculum";

const validInput = {
  gradeId: "10000000-0000-4000-8000-000000000002",
  name: "四年級數學上學期",
  publisherId: "10000000-0000-4000-8000-000000000003",
  schoolYear: 115,
  semester: 1 as const,
  status: "draft" as const,
  subjectId: "10000000-0000-4000-8000-000000000001",
  versionRemark: "初始版本",
};

describe("curriculum validation", () => {
  it("accepts and trims valid curriculum input", () => {
    const result = createCurriculumSchema.parse({
      ...validInput,
      name: "  四年級數學上學期  ",
    });

    expect(result.name).toBe("四年級數學上學期");
  });

  it.each([
    { field: "name", value: "一" },
    { field: "subjectId", value: "not-a-uuid" },
    { field: "gradeId", value: "not-a-uuid" },
    { field: "publisherId", value: "not-a-uuid" },
    { field: "schoolYear", value: 99 },
    { field: "semester", value: 3 },
    { field: "status", value: "published" },
  ])("rejects invalid $field", ({ field, value }) => {
    expect(
      createCurriculumSchema.safeParse({ ...validInput, [field]: value })
        .success,
    ).toBe(false);
  });

  it("rejects archived status during creation but allows it during update", () => {
    const archived = { ...validInput, status: "archived" as const };
    expect(createCurriculumSchema.safeParse(archived).success).toBe(false);
    const updateInput = {
      gradeId: archived.gradeId,
      name: archived.name,
      publisherId: archived.publisherId,
      schoolYear: archived.schoolYear,
      semester: archived.semester,
      status: archived.status,
      subjectId: archived.subjectId,
    };
    expect(updateCurriculumSchema.safeParse(updateInput).success).toBe(true);
  });

  it("rejects unknown fields that could cross tenant boundaries", () => {
    expect(
      createCurriculumSchema.safeParse({
        ...validInput,
        organizationId: "10000000-0000-4000-8000-000000000004",
      }).success,
    ).toBe(false);
  });

  it("validates curriculum identifiers", () => {
    expect(
      curriculumIdSchema.safeParse("10000000-0000-4000-8000-000000000001")
        .success,
    ).toBe(true);
    expect(curriculumIdSchema.safeParse("invalid").success).toBe(false);
  });

  it.each([
    ["organization_owner", true],
    ["organization_admin", true],
    ["teacher", false],
    ["reviewer", false],
    ["branch_manager", false],
    ["student", false],
    ["guardian", false],
  ] as const)(
    "applies curriculum management access for %s",
    (role, expected) => {
      expect(canManageCurriculums(role)).toBe(expected);
    },
  );
});
