import { ReportingError } from "@/lib/reporting/errors";
import { GET as getExportOptions } from "./export-options/route";
import { GET as getOrganizationReport } from "./organization/route";
import { GET as getStudentReport } from "./student/route";
import { GET as getTeacherReport } from "./teacher/route";

const serviceMocks = vi.hoisted(() => ({
  getOrganizationReport: vi.fn(),
  getReportExportOptions: vi.fn(),
  getStudentReport: vi.fn(),
  getTeacherReport: vi.fn(),
}));
const shadowMocks = vi.hoisted(() => ({
  observeLearnerShadowConsumer: vi.fn().mockResolvedValue({
    outcome: "DISABLED",
    result: null,
  }),
}));

vi.mock("@/lib/reporting/service", () => serviceMocks);
vi.mock("@/lib/learner-convergence/server", () => shadowMocks);

describe("RP-001 reporting API", () => {
  afterEach(() => vi.clearAllMocks());

  it("loads a student report through the reporting service boundary", async () => {
    serviceMocks.getStudentReport.mockResolvedValue({
      overallAccuracy: 0.82,
      studentId: "10000000-0000-4000-8000-000000000001",
    });
    const response = await getStudentReport(
      new Request(
        "http://localhost/api/reports/student?studentId=10000000-0000-4000-8000-000000000001",
      ),
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.getStudentReport).toHaveBeenCalledWith({
      studentId: "10000000-0000-4000-8000-000000000001",
    });
    expect(await response.json()).toEqual(
      expect.objectContaining({
        report: expect.objectContaining({ overallAccuracy: 0.82 }),
        success: true,
      }),
    );
    expect(shadowMocks.observeLearnerShadowConsumer).toHaveBeenCalledWith({
      consumer: "reporting",
      scope: {
        legacyAccountIds: ["10000000-0000-4000-8000-000000000001"],
      },
    });
  });

  it("rejects malformed teacher report input before service access", async () => {
    const response = await getTeacherReport(
      new Request("http://localhost/api/reports/teacher?classId=not-a-uuid"),
    );

    expect(response.status).toBe(422);
    expect(serviceMocks.getTeacherReport).not.toHaveBeenCalled();
  });

  it("loads the teacher report without sending learner identifiers to shadow diagnostics", async () => {
    const classId = "10000000-0000-4000-8000-000000000002";
    serviceMocks.getTeacherReport.mockResolvedValue({
      classId,
      studentRanking: [
        {
          accuracy: 0.8,
          learnerReference: "canonical-reference",
          studentId: "10000000-0000-4000-8000-000000000003",
        },
      ],
    });

    const response = await getTeacherReport(
      new Request(`http://localhost/api/reports/teacher?classId=${classId}`),
    );

    expect(response.status).toBe(200);
    expect(shadowMocks.observeLearnerShadowConsumer).toHaveBeenCalledWith({
      consumer: "reporting",
      scope: { classIds: [classId] },
    });
    expect(
      shadowMocks.observeLearnerShadowConsumer.mock.calls.at(-1)?.[0],
    ).not.toHaveProperty("scope.legacyAccountIds");
  });

  it("returns safe forbidden errors without leaking stack traces", async () => {
    serviceMocks.getStudentReport.mockRejectedValue(
      new ReportingError("forbidden"),
    );
    const response = await getStudentReport(
      new Request("http://localhost/api/reports/student"),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("stack");
  });

  it("loads organization report and export option contracts", async () => {
    serviceMocks.getOrganizationReport.mockResolvedValue({
      organizationAccuracy: 0.74,
    });
    serviceMocks.getReportExportOptions.mockResolvedValue([
      { format: "pdf", label: "PDF Export Contract" },
    ]);

    const organizationResponse = await getOrganizationReport();
    const exportResponse = await getExportOptions();

    expect(organizationResponse.status).toBe(200);
    expect(exportResponse.status).toBe(200);
    expect(await organizationResponse.json()).toEqual(
      expect.objectContaining({ success: true }),
    );
    expect(await exportResponse.json()).toEqual(
      expect.objectContaining({
        exportOptions: [{ format: "pdf", label: "PDF Export Contract" }],
        success: true,
      }),
    );
  });
});
