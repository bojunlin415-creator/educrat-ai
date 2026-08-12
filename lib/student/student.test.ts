import {
  createStudentSchema,
  listStudentsQuerySchema,
  updateStudentSchema,
} from "@/lib/validation/student";

const valid = {
  birthday: "2015-03-12",
  englishName: "Amy",
  gender: "female" as const,
  grade: "國小五年級",
  name: "王小明",
  school: "測試國小",
  studentNo: "S-001",
};

describe("Sprint 8 student validation", () => {
  it("accepts a complete student and rejects unknown fields", () => {
    expect(createStudentSchema.safeParse(valid).success).toBe(true);
    expect(
      createStudentSchema.safeParse({ ...valid, organizationId: "forged" })
        .success,
    ).toBe(false);
  });

  it("rejects future birthdays and empty updates", () => {
    expect(
      createStudentSchema.safeParse({ ...valid, birthday: "2999-01-01" })
        .success,
    ).toBe(false);
    expect(updateStudentSchema.safeParse({}).success).toBe(false);
  });

  it("bounds pagination", () => {
    expect(
      listStudentsQuerySchema.safeParse({ page: "1", pageSize: "20" }).success,
    ).toBe(true);
    expect(
      listStudentsQuerySchema.safeParse({ page: "0", pageSize: "101" }).success,
    ).toBe(false);
  });
});
