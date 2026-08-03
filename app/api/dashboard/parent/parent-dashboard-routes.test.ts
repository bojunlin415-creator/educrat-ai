import { ParentPortalError } from "@/lib/parent-portal/errors";
import { GET as getParentDashboard } from "./route";
import { GET as getChildren } from "./children/route";
import { GET as getSummary } from "./students/[studentId]/summary/route";
import { GET as getAssignments } from "./students/[studentId]/assignments/route";
import { GET as getRecommendations } from "./students/[studentId]/recommendations/route";

const serviceMocks = vi.hoisted(() => ({
  getParentAssignmentSummary: vi.fn(),
  getParentDashboard: vi.fn(),
  getParentRecommendations: vi.fn(),
  getParentStudentReport: vi.fn(),
  listParentChildren: vi.fn(),
}));

vi.mock("@/lib/parent-portal/service", () => serviceMocks);

const studentId = "10000000-0000-4000-8000-000000000004";

describe("PP-001 parent portal API", () => {
  afterEach(() => vi.clearAllMocks());

  it("loads parent dashboard through the parent service boundary", async () => {
    serviceMocks.getParentDashboard.mockResolvedValue({
      children: [],
      selectedReport: null,
      selectedStudentId: null,
    });

    const response = await getParentDashboard(
      new Request(
        `http://localhost/api/dashboard/parent?studentId=${studentId}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.getParentDashboard).toHaveBeenCalledWith({ studentId });
  });

  it("validates dashboard query before service access", async () => {
    const response = await getParentDashboard(
      new Request("http://localhost/api/dashboard/parent?studentId=bad"),
    );

    expect(response.status).toBe(422);
    expect(serviceMocks.getParentDashboard).not.toHaveBeenCalled();
  });

  it("returns safe forbidden errors without raw internals", async () => {
    serviceMocks.getParentStudentReport.mockRejectedValue(
      new ParentPortalError("forbidden"),
    );

    const response = await getSummary(new Request("http://localhost"), {
      params: Promise.resolve({ studentId }),
    });

    expect(response.status).toBe(403);
    const text = await response.text();
    expect(text).not.toContain("PostgreSQL");
    expect(text).not.toContain("stack");
  });

  it("loads children, assignments, and recommendations endpoints", async () => {
    serviceMocks.listParentChildren.mockResolvedValue([{ studentId }]);
    serviceMocks.getParentAssignmentSummary.mockResolvedValue({ total: 1 });
    serviceMocks.getParentRecommendations.mockResolvedValue([
      { knowledgePointId: "位值概念" },
    ]);

    expect(await (await getChildren()).json()).toEqual(
      expect.objectContaining({ success: true }),
    );
    expect(
      await (
        await getAssignments(new Request("http://localhost"), {
          params: Promise.resolve({ studentId }),
        })
      ).json(),
    ).toEqual(expect.objectContaining({ success: true }));
    expect(
      await (
        await getRecommendations(new Request("http://localhost"), {
          params: Promise.resolve({ studentId }),
        })
      ).json(),
    ).toEqual(expect.objectContaining({ success: true }));
  });
});
