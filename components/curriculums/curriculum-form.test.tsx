import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurriculumForm } from "./curriculum-form";

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));

const options = {
  grades: [
    {
      code: "4",
      id: "10000000-0000-4000-8000-000000000002",
      name: "四年級",
    },
  ],
  references: [
    {
      code: "teaching-progress-template-2",
      displayName: "教學進度模板 2",
      id: "10000000-0000-4000-8000-000000000003",
      referenceType: "REFERENCE" as const,
    },
  ],
  subjects: [
    {
      code: "math",
      id: "10000000-0000-4000-8000-000000000001",
      name: "數學",
    },
  ],
};

const defaultValues = {
  gradeId: "10000000-0000-4000-8000-000000000002",
  name: "四年級數學",
  curriculumReferenceId: "10000000-0000-4000-8000-000000000003",
  schoolYear: 115,
  semester: 1 as const,
  status: "draft" as const,
  subjectId: "10000000-0000-4000-8000-000000000001",
  versionRemark: "",
};

describe("CurriculumForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("submits validated curriculum creation data", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          curriculum: {
            id: "10000000-0000-4000-8000-000000000009",
            name: "四年級數學",
          },
          message: "教材已建立。",
          redirectTo: "/curriculums/10000000-0000-4000-8000-000000000009",
          success: true,
        }),
        { headers: { "content-type": "application/json" }, status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <CurriculumForm
        defaultValues={defaultValues}
        mode="create"
        options={options}
      />,
    );

    await user.click(screen.getByRole("button", { name: "建立教材" }));

    expect(await screen.findByText("教材已建立。")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/curriculums",
      expect.objectContaining({ method: "POST" }),
    );
    expect(routerMocks.push).toHaveBeenCalledWith(
      "/curriculums/10000000-0000-4000-8000-000000000009",
    );
  });

  it("shows client validation and does not submit invalid data", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <CurriculumForm
        defaultValues={{ ...defaultValues, name: "" }}
        mode="create"
        options={options}
      />,
    );

    await user.click(screen.getByRole("button", { name: "建立教材" }));

    expect(
      await screen.findByText("教材名稱至少需要 2 個字。"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses PATCH and hides initial-version controls in edit mode", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          curriculum: {
            id: "10000000-0000-4000-8000-000000000009",
            name: "四年級數學",
          },
          message: "教材資料已更新。",
          success: true,
        }),
        { headers: { "content-type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <CurriculumForm
        curriculumId="10000000-0000-4000-8000-000000000009"
        defaultValues={defaultValues}
        mode="edit"
        options={options}
      />,
    );

    expect(screen.queryByText("初始版本備註（選填）")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "儲存教材" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/curriculums/10000000-0000-4000-8000-000000000009",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
