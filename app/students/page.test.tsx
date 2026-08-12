import { render, screen } from "@testing-library/react";
import StudentsPage from "./page";

const mocks = vi.hoisted(() => ({
  captureProps: vi.fn(),
  listAllStudents: vi.fn(),
  requireDashboardContext: vi.fn(),
}));

vi.mock("@/lib/onboarding/guard", () => ({
  requireDashboardContext: mocks.requireDashboardContext,
}));
vi.mock("@/lib/student/service", () => ({
  listAllStudents: mocks.listAllStudents,
}));
vi.mock("@/components/roster/student-management", () => ({
  StudentManagement: (props: { students: readonly unknown[] }) => {
    mocks.captureProps(props);
    return <div data-testid="student-management" />;
  },
}));

describe("Sprint 8 students page", () => {
  beforeEach(() => {
    mocks.requireDashboardContext.mockResolvedValue({
      currentOrganization: { organization: { id: "organization-1" } },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads the complete student roster instead of truncating at 100", async () => {
    const students = Array.from({ length: 101 }, (_, index) => ({ id: index }));
    mocks.listAllStudents.mockResolvedValue(students);

    render(await StudentsPage());

    expect(screen.getByTestId("student-management")).toBeVisible();
    expect(mocks.listAllStudents).toHaveBeenCalledWith({ status: "all" });
    expect(mocks.captureProps).toHaveBeenCalledWith({ students });
  });

  it("shows the page error state when the roster cannot load", async () => {
    mocks.listAllStudents.mockRejectedValue(new Error("load failed"));

    render(await StudentsPage());

    expect(screen.getByRole("alert")).toHaveTextContent("無法載入學生資料");
    expect(mocks.captureProps).not.toHaveBeenCalled();
  });
});
