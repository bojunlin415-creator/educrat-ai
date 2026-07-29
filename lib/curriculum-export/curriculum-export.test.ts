import { describe, expect, it } from "vitest";
import {
  createCurriculumExportDocument,
  createSafeCurriculumExportFilename,
  renderCurriculumExportPdf,
  serializeCurriculumExportDocument,
  validateCurriculumExportDocument,
  type CurriculumExportMode,
} from "@/lib/curriculum-export";

const metadata = {
  curriculumId: "11111111-1111-4111-8111-111111111111",
  curriculumVersionId: "22222222-2222-4222-8222-222222222222",
  grade: "國小五年級",
  organizationName: "測試機構",
  subject: "數學",
  title: "分數加減",
  topic: "分數加減",
  version: 1,
};

function createDocument(mode: CurriculumExportMode = "worksheet") {
  return createCurriculumExportDocument({
    metadata,
    mode,
    questions: [
      {
        answer: { explanation: "同分母直接相加。", value: "1/2" },
        knowledgePointIds: ["kp-1"],
        prompt: "計算 1/4 + 1/4。",
      },
      {
        answer: { explanation: "先通分再相加。", value: "5/6" },
        challenge: true,
        knowledgePointIds: ["kp-2"],
        prompt: "計算 1/2 + 1/3。",
      },
    ],
    sections: [
      {
        heading: "教學目標",
        items: ["理解分數加減。"],
        kind: "objectives",
      },
    ],
  });
}

describe("curriculum export foundation", () => {
  it("creates worksheet documents with continuous question numbers", () => {
    const document = createDocument("worksheet");
    const questionSection = document.sections.find(
      (section) => section.kind === "questions",
    );
    expect(
      questionSection?.questions?.map((question) => question.number),
    ).toEqual([1, 2]);
    expect(questionSection?.questions?.[1]?.challenge).toBe(true);
    expect(validateCurriculumExportDocument(document).success).toBe(true);
  });

  it("creates answer-sheet and combined documents", () => {
    expect(
      validateCurriculumExportDocument(createDocument("answer-sheet")).success,
    ).toBe(true);
    expect(
      validateCurriculumExportDocument(createDocument("combined")).success,
    ).toBe(true);
  });

  it("rejects answer sheets with missing answers", () => {
    const document = createCurriculumExportDocument({
      metadata,
      mode: "answer-sheet",
      questions: [{ prompt: "缺少答案。" }],
    });
    expect(validateCurriculumExportDocument(document)).toMatchObject({
      reason: "missing_answer",
      success: false,
    });
  });

  it("creates safe PDF filenames", () => {
    const document = createCurriculumExportDocument({
      metadata: { ...metadata, topic: "../分數/加減:*?" },
      mode: "worksheet",
      questions: [],
    });
    expect(createSafeCurriculumExportFilename(document)).toBe(
      "國小五年級-數學-分數加減-題目卷.pdf",
    );
  });

  it("serializes deterministically", () => {
    const document = createDocument();
    expect(serializeCurriculumExportDocument(document)).toBe(
      serializeCurriculumExportDocument(document),
    );
  });

  it("renders a non-empty PDF", () => {
    const pdf = renderCurriculumExportPdf(createDocument("combined"));
    expect(pdf.contentType).toBe("application/pdf");
    expect(pdf.data.byteLength).toBeGreaterThan(500);
    expect(new TextDecoder().decode(pdf.data.slice(0, 8))).toBe("%PDF-1.7");
  });
});
