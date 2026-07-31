import { TeacherDashboardError } from "@/lib/teacher-dashboard/errors";
import { GET as getTeacherDashboard } from "./route";
import { GET as getClasses } from "./classes/route";
import { GET as getInsights } from "./insights/route";
import { GET as getStudents } from "./students/route";

const serviceMocks = vi.hoisted(() => ({
  getTeacherDashboard: vi.fn(),
  getTeacherDashboardClasses: vi.fn(),
  getTeacherDashboardInsights: vi.fn(),
  getTeacherDashboardStudents: vi.fn(),
}));

vi.mock("@/lib/teacher-dashboard/service", () => serviceMocks);

const classId = "10000000-0000-4000-8000-000000000003";

describe("TD-001 teacher dashboard API", () => {
  afterEach(() => vi.clearAllMocks());

  it("loads the teacher dashboard through the service boundary", async () => {
    serviceMocks.getTeacherDashboard.mockResolvedValue({
      todayOverview: { averageAccuracy: 0.8 },
    });

    const response = await getTeacherDashboard(
      new Request(`http://localhost/api/dashboard/teacher?classId=${classId}`),
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.getTeacherDashboard).toHaveBeenCalledWith({ classId });
    expect(await response.json()).toEqual(
      expect.objectContaining({
        dashboard: expect.objectContaining({
          todayOverview: { averageAccuracy: 0.8 },
        }),
        success: true,
      }),
    );
  });

  it("validates student ranking before service access", async () => {
    const response = await getStudents(
      new Request(
        "http://localhost/api/dashboard/teacher/students?ranking=bad",
      ),
    );

    expect(response.status).toBe(422);
    expect(serviceMocks.getTeacherDashboardStudents).not.toHaveBeenCalled();
  });

  it("returns safe forbidden errors without stack traces", async () => {
    serviceMocks.getTeacherDashboard.mockRejectedValue(
      new TeacherDashboardError("forbidden"),
    );
    const response = await getTeacherDashboard(
      new Request("http://localhost/api/dashboard/teacher"),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("stack");
  });

  it("loads classes, students, and insights endpoints", async () => {
    serviceMocks.getTeacherDashboardClasses.mockResolvedValue([
      { classId: "class-1" },
    ]);
    serviceMocks.getTeacherDashboardStudents.mockResolvedValue([
      { studentId: "student-1" },
    ]);
    serviceMocks.getTeacherDashboardInsights.mockResolvedValue([
      { title: "穩定" },
    ]);

    expect(
      await (
        await getClasses(
          new Request("http://localhost/api/dashboard/teacher/classes"),
        )
      ).json(),
    ).toEqual(expect.objectContaining({ success: true }));
    expect(
      await (
        await getStudents(
          new Request(
            "http://localhost/api/dashboard/teacher/students?ranking=needs_attention",
          ),
        )
      ).json(),
    ).toEqual(expect.objectContaining({ success: true }));
    expect(
      await (
        await getInsights(
          new Request("http://localhost/api/dashboard/teacher/insights"),
        )
      ).json(),
    ).toEqual(expect.objectContaining({ success: true }));
  });
});
