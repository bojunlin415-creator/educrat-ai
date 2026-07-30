import {
  buildMasterySummary,
  calculateAverage,
  REPORT_EXPORT_CONTRACTS,
} from "@/lib/reporting/domain";

describe("RP-001 reporting domain", () => {
  it("aggregates mastery distribution view models", () => {
    expect(
      buildMasterySummary([
        { beginner: 2, developing: 1, mastered: 0, proficient: 3, unknown: 1 },
        { beginner: 1, developing: 2, mastered: 4, proficient: 0 },
      ]),
    ).toEqual({
      beginner: 3,
      developing: 3,
      mastered: 4,
      proficient: 3,
      unknown: 1,
    });
  });

  it("calculates rounded averages without depending on UI", () => {
    expect(calculateAverage([0.1, 0.2, 0.3])).toBe(0.2);
    expect(calculateAverage([])).toBe(0);
    expect(calculateAverage([1, 0, 0])).toBe(0.3333);
  });

  it("defines export contracts without implementing export rendering", () => {
    expect(REPORT_EXPORT_CONTRACTS).toHaveLength(3);
    expect(REPORT_EXPORT_CONTRACTS.map((contract) => contract.format)).toEqual([
      "pdf",
      "excel",
      "csv",
    ]);
    expect(Object.isFrozen(REPORT_EXPORT_CONTRACTS)).toBe(true);
    for (const contract of REPORT_EXPORT_CONTRACTS) {
      expect(contract.supportedReports).toEqual([
        "organization",
        "student",
        "teacher",
      ]);
      expect(contract).not.toHaveProperty("render");
      expect(contract).not.toHaveProperty("download");
    }
  });
});
