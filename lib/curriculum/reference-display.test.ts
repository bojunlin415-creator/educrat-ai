import {
  toCurriculumReferenceDisplay,
  withLegacyReferenceCompatibility,
} from "@/lib/curriculum/reference-display";

const legacyRows = [
  { code: "nan-yi", id: "reference-1", name: "南一" },
  { code: "kang-hsuan", id: "reference-2", name: "康軒" },
  { code: "han-lin", id: "reference-3", name: "翰林" },
] as const;

describe("Curriculum Reference display adapter", () => {
  it("maps legacy rows to neutral reference labels", () => {
    expect(legacyRows.map(toCurriculumReferenceDisplay)).toEqual([
      {
        code: "teaching-progress-template-1",
        displayName: "教學進度模板 1",
        id: "reference-1",
        referenceType: "REFERENCE",
      },
      {
        code: "teaching-progress-template-2",
        displayName: "教學進度模板 2",
        id: "reference-2",
        referenceType: "REFERENCE",
      },
      {
        code: "teaching-progress-template-3",
        displayName: "教學進度模板 3",
        id: "reference-3",
        referenceType: "REFERENCE",
      },
    ]);
  });

  it("never returns a raw legacy source name", () => {
    const result = legacyRows.map(toCurriculumReferenceDisplay);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("南一");
    expect(serialized).not.toContain("康軒");
    expect(serialized).not.toContain("翰林");
  });

  it("keeps the legacy API shape with neutral values", () => {
    const reference = toCurriculumReferenceDisplay(legacyRows[0]);
    const result = withLegacyReferenceCompatibility({
      id: "curriculum-1",
      reference,
    });

    expect(result.publisher_id).toBe("reference-1");
    expect(result.publisher).toEqual({
      code: "teaching-progress-template-1",
      id: "reference-1",
      name: "教學進度模板 1",
    });
  });

  it("uses a neutral fallback for unknown legacy rows", () => {
    expect(
      toCurriculumReferenceDisplay({
        code: "unknown-source",
        id: "reference-4",
        name: "Untrusted raw label",
      }),
    ).toEqual({
      code: "custom-teaching-progress",
      displayName: "自訂教學進度",
      id: "reference-4",
      referenceType: "CUSTOM",
    });
  });
});
