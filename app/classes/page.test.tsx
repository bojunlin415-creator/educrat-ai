import { render, screen } from "@testing-library/react";
import ClassesPage from "./page";

const mocks = vi.hoisted(() => ({
  captureProps: vi.fn(),
  createClient: vi.fn(),
  listAllStudents: vi.fn(),
  listClasses: vi.fn(),
  requireDashboardContext: vi.fn(),
}));

vi.mock("@/lib/classroom/service", () => ({ listClasses: mocks.listClasses }));
vi.mock("@/lib/onboarding/guard", () => ({
  requireDashboardContext: mocks.requireDashboardContext,
}));
vi.mock("@/lib/student/service", () => ({
  listAllStudents: mocks.listAllStudents,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/components/roster/class-management", () => ({
  ClassManagement: (props: {
    classes: readonly unknown[];
    students: readonly unknown[];
    teachers: readonly { id: string; label: string }[];
  }) => {
    mocks.captureProps(props);
    return <div data-testid="class-management" />;
  },
}));

function supabaseClient({
  membershipError = null,
  memberships,
  profiles,
}: {
  membershipError?: { message: string } | null;
  memberships: readonly { user_id: string }[];
  profiles: readonly { display_name: string | null; id: string }[];
}) {
  const eq = vi.fn();
  const membershipQuery = {
    data: memberships,
    eq,
    error: membershipError,
  };
  eq.mockReturnValue(membershipQuery);
  return {
    from: vi.fn((table: string) => {
      if (table === "organization_members") {
        return { select: vi.fn(() => membershipQuery) };
      }
      return {
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({ data: profiles, error: null }),
        })),
      };
    }),
  };
}

describe("Sprint 8 classes page", () => {
  beforeEach(() => {
    mocks.requireDashboardContext.mockResolvedValue({
      currentOrganization: { organization: { id: "organization-1" } },
    });
    mocks.listClasses.mockResolvedValue([]);
    mocks.listAllStudents.mockResolvedValue(
      Array.from({ length: 101 }, (_, index) => ({
        birthday: "2015-01-01",
        id: index,
        name: `Student ${index}`,
        status: "active",
        student_no: `S${index}`,
      })),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses memberships as teacher options and profiles only as labels", async () => {
    const namedTeacher = "30000000-0000-4000-8000-000000000001";
    const unnamedTeacher = "30000000-0000-4000-8000-000000000099";
    mocks.createClient.mockResolvedValue(
      supabaseClient({
        memberships: [{ user_id: namedTeacher }, { user_id: unnamedTeacher }],
        profiles: [{ display_name: "有名教師", id: namedTeacher }],
      }),
    );

    render(await ClassesPage());

    expect(screen.getByTestId("class-management")).toBeVisible();
    expect(mocks.listAllStudents).toHaveBeenCalledWith({ status: "active" });
    expect(mocks.captureProps).toHaveBeenCalledWith(
      expect.objectContaining({
        students: expect.arrayContaining([
          {
            id: 100,
            name: "Student 100",
            status: "active",
            student_no: "S100",
          },
        ]),
        teachers: [
          { id: namedTeacher, label: "有名教師" },
          { id: unnamedTeacher, label: "未命名教師 · …000099" },
        ],
      }),
    );
    const props = mocks.captureProps.mock.calls[0]?.[0] as {
      students: readonly Record<string, unknown>[];
    };
    expect(props.students[0]).not.toHaveProperty("birthday");
  });

  it("does not turn a membership query error into an empty teacher list", async () => {
    mocks.createClient.mockResolvedValue(
      supabaseClient({
        membershipError: { message: "membership load failed" },
        memberships: [],
        profiles: [],
      }),
    );

    render(await ClassesPage());

    expect(screen.getByRole("alert")).toHaveTextContent("無法載入班級資料");
    expect(mocks.captureProps).not.toHaveBeenCalled();
  });
});
