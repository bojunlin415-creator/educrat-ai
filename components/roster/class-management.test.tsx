import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { ClassManagement } from "./class-management";

const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

type Props = ComponentProps<typeof ClassManagement>;
type Classroom = Props["classes"][number];
type Student = Props["students"][number];

const teacher = {
  id: "30000000-0000-4000-8000-000000000001",
  label: "測試教師",
};

function makeClass(
  index: number,
  overrides: Partial<Classroom> = {},
): Classroom {
  return {
    code: `CLASS-${index}`,
    created_at: "2026-08-06",
    description: null,
    grade: "五年級",
    id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    name: `測試班級 ${index}`,
    organization_id: "20000000-0000-4000-8000-000000000001",
    school: null,
    school_year: 115,
    semester: 1,
    status: "active",
    subject: "數學",
    teacher_id: teacher.id,
    updated_at: "2026-08-06",
    ...overrides,
  };
}

function makeStudent(index: number, overrides: Partial<Student> = {}): Student {
  return {
    id: `40000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    name: `測試學生 ${index}`,
    status: "active",
    student_no: `S${String(index).padStart(3, "0")}`,
    ...overrides,
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

describe("Sprint 8 class management UI", () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders empty state and opens the create dialog when a teacher exists", async () => {
    render(<ClassManagement classes={[]} students={[]} teachers={[teacher]} />);
    expect(screen.getByText("目前條件下沒有班級資料。")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "建立班級" }));
    expect(
      screen.getByRole("heading", { name: "建立班級" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("主要教師")).toHaveValue(teacher.id);
  });

  it("updates local rows from the create response", async () => {
    const created = makeClass(1, { name: "立即出現的班級" });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response(
            { class: created, message: "班級已建立。", success: true },
            201,
          ),
        ),
    );
    render(<ClassManagement classes={[]} students={[]} teachers={[teacher]} />);

    await userEvent.click(screen.getByRole("button", { name: "建立班級" }));
    await userEvent.type(screen.getByLabelText("班級名稱"), created.name);
    await userEvent.type(screen.getByLabelText("班級代碼"), created.code);
    await userEvent.type(screen.getByLabelText("年級"), created.grade);
    await userEvent.type(screen.getByLabelText("科目"), created.subject);
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "建立班級",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: created.name }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("班級已建立。");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("resets edit fields and preserves a missing current teacher option", async () => {
    const missingTeacherId = "30000000-0000-4000-8000-000000000099";
    const first = makeClass(1, { name: "A 班" });
    const second = makeClass(2, {
      name: "B 班",
      teacher_id: missingTeacherId,
    });
    render(
      <ClassManagement
        classes={[first, second]}
        students={[]}
        teachers={[teacher]}
      />,
    );

    const firstCard = screen
      .getByRole("heading", { name: first.name })
      .closest("div");
    await userEvent.click(
      within(firstCard as HTMLElement).getByRole("button", { name: "編輯" }),
    );
    await userEvent.clear(screen.getByLabelText("班級名稱"));
    await userEvent.type(screen.getByLabelText("班級名稱"), "未儲存");
    await userEvent.click(screen.getByRole("button", { name: "關閉對話框" }));

    const secondCard = screen
      .getByRole("heading", { name: second.name })
      .closest("div");
    await userEvent.click(
      within(secondCard as HTMLElement).getByRole("button", { name: "編輯" }),
    );
    expect(screen.getByLabelText("班級名稱")).toHaveValue(second.name);
    expect(screen.getByLabelText("主要教師")).toHaveValue(missingTeacherId);
  });

  it("sends null when an edited class clears its school", async () => {
    const classroom = makeClass(1, { school: "原學校" });
    const updated = { ...classroom, school: null };
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        class: updated,
        message: "班級已更新。",
        success: true,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ClassManagement
        classes={[classroom]}
        students={[]}
        teachers={[teacher]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "編輯" }));
    await userEvent.clear(screen.getByLabelText("學校"));
    await userEvent.click(screen.getByRole("button", { name: "儲存變更" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ school: null });
  });

  it("only offers active students for assignment", async () => {
    const classroom = makeClass(1);
    const archived = makeStudent(1, {
      name: "已封存學生",
      status: "archived",
    });
    const active = makeStudent(2, { name: "可指派學生" });
    render(
      <ClassManagement
        classes={[classroom]}
        students={[archived, active]}
        teachers={[teacher]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "指派學生" }));

    const select = screen.getByLabelText("學生");
    expect(select).toHaveValue(active.id);
    expect(
      within(select).queryByRole("option", { name: /已封存學生/ }),
    ).not.toBeInTheDocument();
    expect(
      within(select).getByRole("option", { name: /可指派學生/ }),
    ).toBeInTheDocument();
  });

  it("shows an empty assignment state when every student is archived", async () => {
    render(
      <ClassManagement
        classes={[makeClass(1)]}
        students={[makeStudent(1, { status: "archived" })]}
        teachers={[teacher]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "指派學生" }));
    expect(screen.getByText("請先建立或還原 active 學生。")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "確認指派" }),
    ).not.toBeInTheDocument();
  });

  it("only exposes restore for archived classes", async () => {
    const archived = makeClass(1, { status: "archived" });
    render(
      <ClassManagement
        classes={[archived]}
        students={[makeStudent(1)]}
        teachers={[teacher]}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText("狀態"), "archived");
    const card = screen
      .getByRole("heading", { name: archived.name })
      .closest("div");
    expect(
      within(card as HTMLElement).queryByRole("button", { name: "編輯" }),
    ).not.toBeInTheDocument();
    expect(
      within(card as HTMLElement).queryByRole("button", { name: "指派學生" }),
    ).not.toBeInTheDocument();
    expect(
      within(card as HTMLElement).getByRole("button", { name: "還原" }),
    ).toBeEnabled();
  });

  it("shows pending and an in-dialog assignment error", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
      ),
    );
    render(
      <ClassManagement
        classes={[makeClass(1)]}
        students={[makeStudent(1)]}
        teachers={[teacher]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "指派學生" }));
    const confirm = screen.getByRole("button", { name: "確認指派" });
    await userEvent.click(confirm);
    expect(confirm).toBeDisabled();
    resolveFetch?.(
      response({ message: "已經在班級中。", success: false }, 409),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "已經在班級中。",
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "確認指派" })).toBeEnabled();
  });

  it("clamps the page after the final class is archived", async () => {
    const classes = Array.from({ length: 13 }, (_, index) =>
      makeClass(index + 1),
    );
    const last = classes[12]!;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          class: { ...last, status: "archived" },
          message: "班級已封存。",
          success: true,
        }),
      ),
    );
    render(
      <ClassManagement classes={classes} students={[]} teachers={[teacher]} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "下一頁" }));
    expect(screen.getByText("第 2 / 2 頁")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "封存" }));

    expect(
      await screen.findByRole("heading", { name: classes[0]!.name }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByRole("navigation", { name: "班級列表分頁" }),
      ).not.toBeInTheDocument(),
    );
  });
});
