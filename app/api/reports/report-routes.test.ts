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

vi.mock("@/lib/reporting/service", () => serviceMocks);

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
  });

  it("rejects malformed teacher report input before service access", async () => {
    const response = await getTeacherReport(
      new Request("http://localhost/api/reports/teacher?classId=not-a-uuid"),
    );

    expect(response.status).toBe(422);
    expect(serviceMocks.getTeacherReport).not.toHaveBeenCalled();
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
