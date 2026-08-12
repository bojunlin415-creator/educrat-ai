import { isClassActive, isEnrollmentActive } from "@/lib/classroom";
import {
  createClassSchema,
  enrollStudentSchema,
  updateClassSchema,
} from "@/lib/validation/classroom";

const validClassPayload = {
  code: "MATH-501",
  description: "五年級數學班",
  grade: "國小五年級",
  name: "五年級數學 A 班",
  schoolYear: 115,
  semester: 1,
  subject: "數學",
  teacherId: "10000000-0000-4000-8000-000000000001",
};

describe("CL-001 class and enrollment foundation", () => {
  it("validates class aggregate input with organization-safe code", () => {
    expect(createClassSchema.safeParse(validClassPayload).success).toBe(true);
    expect(
      createClassSchema.safeParse({
        ...validClassPayload,
        code: "../MATH",
      }).success,
    ).toBe(false);
  });

  it("keeps class and enrollment lifecycle explicit", () => {
    expect(isClassActive("active")).toBe(true);
    expect(isClassActive("inactive")).toBe(false);
    expect(isClassActive("archived")).toBe(false);
    expect(isEnrollmentActive("active")).toBe(true);
    expect(isEnrollmentActive("inactive")).toBe(false);
    expect(isEnrollmentActive("left")).toBe(false);
  });

  it("validates update without permitting archived as direct update target", () => {
    expect(updateClassSchema.safeParse({ status: "inactive" }).success).toBe(
      true,
    );
    expect(updateClassSchema.safeParse({ status: "archived" }).success).toBe(
      false,
    );
    expect(updateClassSchema.safeParse({}).success).toBe(false);
    expect(updateClassSchema.safeParse({ school: null }).success).toBe(true);
  });

  it("validates enrollment student identity shape", () => {
    expect(
      enrollStudentSchema.safeParse({
        studentId: "10000000-0000-4000-8000-000000000002",
      }).success,
    ).toBe(true);
    expect(
      enrollStudentSchema.safeParse({ studentId: "student-1" }).success,
    ).toBe(false);
  });
});
