import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { StudentManagement } from "./student-management";

const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

type Student = ComponentProps<typeof StudentManagement>["students"][number];

function makeStudent(index: number, overrides: Partial<Student> = {}): Student {
  return {
    birthday: null,
    created_at: "2026-08-06",
    english_name: null,
    gender: "undisclosed",
    grade: "五年級",
    id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    name: `測試學生 ${index}`,
    organization_id: "20000000-0000-4000-8000-000000000001",
    school: null,
    status: "active",
    student_no: `S${String(index).padStart(3, "0")}`,
    updated_at: "2026-08-06",
    ...overrides,
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

describe("Sprint 8 student management UI", () => {
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

  it("renders empty state and opens the create dialog", async () => {
    render(<StudentManagement students={[]} />);
    expect(screen.getByText("目前條件下沒有學生資料。")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "建立學生" }));
    expect(
      screen.getByRole("heading", { name: "建立學生" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("學號")).toBeInTheDocument();
  });

  it("updates local rows from the create response before router refresh", async () => {
    const created = makeStudent(1, { name: "立即出現的學生" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response(
          { message: "學生已建立。", student: created, success: true },
          201,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<StudentManagement students={[]} />);

    await userEvent.click(screen.getByRole("button", { name: "建立學生" }));
    await userEvent.type(screen.getByLabelText("學號"), created.student_no);
    await userEvent.type(
      screen.getByLabelText("姓名", { exact: true }),
      created.name,
    );
    await userEvent.type(screen.getByLabelText("年級"), created.grade);
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "建立學生",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: created.name }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("學生已建立。");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("resets uncontrolled fields between edit and create dialogs", async () => {
    const first = makeStudent(1, { name: "王小明" });
    const second = makeStudent(2, { name: "陳小華" });
    render(<StudentManagement students={[first, second]} />);

    const firstCard = screen
      .getByRole("heading", { name: first.name })
      .closest("div");
    await userEvent.click(
      within(firstCard as HTMLElement).getByRole("button", { name: "編輯" }),
    );
    await userEvent.clear(screen.getByLabelText("姓名", { exact: true }));
    await userEvent.type(
      screen.getByLabelText("姓名", { exact: true }),
      "未儲存",
    );
    await userEvent.click(screen.getByRole("button", { name: "關閉對話框" }));

    const secondCard = screen
      .getByRole("heading", { name: second.name })
      .closest("div");
    await userEvent.click(
      within(secondCard as HTMLElement).getByRole("button", { name: "編輯" }),
    );
    expect(screen.getByLabelText("姓名", { exact: true })).toHaveValue(
      second.name,
    );
    await userEvent.click(screen.getByRole("button", { name: "關閉對話框" }));
    await userEvent.click(screen.getByRole("button", { name: "建立學生" }));
    expect(screen.getByLabelText("學號")).toHaveValue("");
    expect(screen.getByLabelText("姓名", { exact: true })).toHaveValue("");
  });

  it("hides edit for archived students and restores from the response", async () => {
    const archived = makeStudent(1, {
      name: "已封存學生",
      status: "archived",
    });
    const restored = { ...archived, status: "active" as const };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          message: "學生已還原。",
          student: restored,
          success: true,
        }),
      ),
    );
    render(<StudentManagement students={[archived]} />);
    await userEvent.selectOptions(screen.getByLabelText("狀態"), "archived");

    const card = screen
      .getByRole("heading", { name: archived.name })
      .closest("div");
    expect(
      within(card as HTMLElement).queryByRole("button", { name: "編輯" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      within(card as HTMLElement).getByRole("button", { name: "還原" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: archived.name }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText("學生已還原。")).toBeVisible();
  });

  it("shows pending and error state for archive actions", async () => {
    const student = makeStudent(1);
    let resolveFetch: ((value: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
      ),
    );
    render(<StudentManagement students={[student]} />);

    const archive = screen.getByRole("button", { name: "封存" });
    await userEvent.click(archive);
    expect(archive).toBeDisabled();
    resolveFetch?.(
      response({ message: "暫時無法封存。", success: false }, 503),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "暫時無法封存。",
    );
    expect(screen.getByRole("button", { name: "封存" })).toBeEnabled();
  });

  it("clamps the page after the final row is archived", async () => {
    const students = Array.from({ length: 13 }, (_, index) =>
      makeStudent(index + 1),
    );
    const last = students[12]!;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          message: "學生已封存。",
          student: { ...last, status: "archived" },
          success: true,
        }),
      ),
    );
    render(<StudentManagement students={students} />);
    await userEvent.click(screen.getByRole("button", { name: "下一頁" }));
    expect(screen.getByText("第 2 / 2 頁")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "封存" }));

    expect(
      await screen.findByRole("heading", { name: students[0]!.name }),
    ).toBeVisible();
    expect(screen.queryByText("第 2 / 1 頁")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "學生列表分頁" }),
    ).not.toBeInTheDocument();
  });
});
