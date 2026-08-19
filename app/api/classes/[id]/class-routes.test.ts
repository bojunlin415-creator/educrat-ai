import { ClassroomError } from "@/lib/classroom/errors";
import { DELETE, GET, PATCH } from "./route";
import { POST as enrollPost } from "./enrollments/route";
import { DELETE as removeEnrollmentDelete } from "./enrollments/[studentId]/route";

const serviceMocks = vi.hoisted(() => ({
  archiveClass: vi.fn(),
  enrollStudent: vi.fn(),
  getClass: vi.fn(),
  removeStudent: vi.fn(),
  updateClass: vi.fn(),
}));
const rosterMocks = vi.hoisted(() => ({
  getCanonicalClassRosterDetail: vi.fn(),
}));
const shadowMocks = vi.hoisted(() => ({
  observeLearnerShadowConsumer: vi.fn().mockResolvedValue({
    outcome: "DISABLED",
    result: null,
  }),
}));

vi.mock("@/lib/classroom/service", () => serviceMocks);
vi.mock("@/lib/classroom/roster", () => rosterMocks);
vi.mock("@/lib/learner-convergence/server", () => shadowMocks);

const classId = "10000000-0000-4000-8000-000000000010";
const studentId = "10000000-0000-4000-8000-000000000011";
const routeContext = { params: Promise.resolve({ id: classId }) };
const enrollmentRouteContext = {
  params: Promise.resolve({ id: classId, studentId }),
};

describe("CL-001 class detail API", () => {
  afterEach(() => vi.clearAllMocks());

  it("loads class detail by id", async () => {
    rosterMocks.getCanonicalClassRosterDetail.mockResolvedValue({
      authority: "CANONICAL",
      class: { id: classId },
      fallbackUsed: false,
      mode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
    });
    const response = await GET(
      new Request(`http://localhost/api/classes/${classId}`),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(rosterMocks.getCanonicalClassRosterDetail).toHaveBeenCalledWith(
      classId,
    );
    expect(shadowMocks.observeLearnerShadowConsumer).toHaveBeenCalledWith({
      consumer: "class_read_detail",
      scope: { classIds: [classId] },
    });
    expect(await response.json()).toEqual({
      class: { id: classId },
      message: "班級資料已載入。",
      success: true,
    });
  });

  it("maps anonymous roster access to 401 without authority metadata", async () => {
    rosterMocks.getCanonicalClassRosterDetail.mockRejectedValue(
      new ClassroomError("not_authenticated"),
    );
    const response = await GET(
      new Request(`http://localhost/api/classes/${classId}`),
      routeContext,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      code: "not_authenticated",
      message: "請先登入後再管理班級。",
      success: false,
    });
  });

  it("updates class through service boundary", async () => {
    serviceMocks.updateClass.mockResolvedValue({ id: classId });
    const payload = { name: "五年級數學 B 班", status: "inactive" };
    const response = await PATCH(
      new Request(`http://localhost/api/classes/${classId}`, {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(serviceMocks.updateClass).toHaveBeenCalledWith(classId, payload);
  });

  it("archives class through the dedicated archive endpoint", async () => {
    serviceMocks.archiveClass.mockResolvedValue({ id: classId });
    const response = await DELETE(
      new Request(`http://localhost/api/classes/${classId}`, {
        method: "DELETE",
      }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(serviceMocks.archiveClass).toHaveBeenCalledWith(classId);
  });

  it("enrolls and removes students without exposing raw database errors", async () => {
    serviceMocks.enrollStudent.mockResolvedValue({ id: "enrollment-1" });
    serviceMocks.removeStudent.mockResolvedValue({ id: "enrollment-1" });
    const enrollResponse = await enrollPost(
      new Request(`http://localhost/api/classes/${classId}/enrollments`, {
        body: JSON.stringify({ studentId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      routeContext,
    );
    const removeResponse = await removeEnrollmentDelete(
      new Request(
        `http://localhost/api/classes/${classId}/enrollments/${studentId}`,
        { method: "DELETE" },
      ),
      enrollmentRouteContext,
    );
    expect(enrollResponse.status).toBe(201);
    expect(removeResponse.status).toBe(200);
    expect(serviceMocks.enrollStudent).toHaveBeenCalledWith(classId, {
      studentId,
    });
    expect(serviceMocks.removeStudent).toHaveBeenCalledWith(classId, studentId);
  });

  it("returns safe invalid teacher errors", async () => {
    serviceMocks.updateClass.mockRejectedValue(
      new ClassroomError("invalid_teacher"),
    );
    const response = await PATCH(
      new Request(`http://localhost/api/classes/${classId}`, {
        body: JSON.stringify({ teacherId: studentId }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      routeContext,
    );
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("class_invalid_teacher");
  });
});
