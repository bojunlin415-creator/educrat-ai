import {
  isAssignmentEditable,
  isStudentSubmissionEditable,
} from "@/lib/assignment";
import {
  createAssignmentSchema,
  saveSubmissionSchema,
  updateAssignmentSchema,
} from "@/lib/validation/assignment";

const publishedVersionPayload = {
  curriculumId: "10000000-0000-4000-8000-000000000001",
  curriculumVersionId: "10000000-0000-4000-8000-000000000002",
  dueAt: "2026-09-10T10:00:00.000Z",
  publishAt: "2026-09-01T10:00:00.000Z",
  studentIds: ["10000000-0000-4000-8000-000000000003"],
  title: "分數加減作業",
};

describe("AS-001 assignment foundation", () => {
  it("validates assignment creation without accepting latest version references", () => {
    expect(
      createAssignmentSchema.safeParse(publishedVersionPayload).success,
    ).toBe(true);
    expect(
      createAssignmentSchema.safeParse({
        ...publishedVersionPayload,
        curriculumVersionId: "latest",
      }).success,
    ).toBe(false);
  });

  it("rejects due dates before publish dates", () => {
    expect(
      createAssignmentSchema.safeParse({
        ...publishedVersionPayload,
        dueAt: "2026-08-31T10:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      updateAssignmentSchema.safeParse({
        dueAt: "2026-08-31T10:00:00.000Z",
        publishAt: "2026-09-01T10:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("keeps lifecycle and submission editability explicit", () => {
    expect(isAssignmentEditable("draft")).toBe(true);
    expect(isAssignmentEditable("scheduled")).toBe(true);
    expect(isAssignmentEditable("cancelled")).toBe(false);
    expect(isStudentSubmissionEditable("not_started")).toBe(true);
    expect(isStudentSubmissionEditable("in_progress")).toBe(true);
    expect(isStudentSubmissionEditable("submitted")).toBe(false);
  });

  it("validates one structured submission payload without AI grading", () => {
    expect(
      saveSubmissionSchema.safeParse({
        content: {
          "question-1": { answer: "1/2" },
        },
      }).success,
    ).toBe(true);
    expect(saveSubmissionSchema.safeParse({ content: [] }).success).toBe(false);
  });
});
