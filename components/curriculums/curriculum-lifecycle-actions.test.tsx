import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurriculumLifecycleAction } from "./curriculum-lifecycle-actions";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));

const curriculum = {
  grade: { name: "四年級" },
  id: "10000000-0000-4000-8000-000000000009",
  latestVersion: 1,
  name: "四年級數學草稿",
  status: "draft" as const,
  subject: { name: "數學" },
};

describe("CurriculumLifecycleAction", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal(
      this: HTMLDialogElement,
    ) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function close(
      this: HTMLDialogElement,
    ) {
      this.open = false;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("moves a curriculum to the recycle bin without native confirm", async () => {
    const user = userEvent.setup();
    const confirmMock = vi.fn();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "教材已移入回收桶。",
          redirectTo: "/curriculums",
          success: true,
        }),
        { headers: { "content-type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("confirm", confirmMock);
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CurriculumLifecycleAction action="delete" curriculum={curriculum} />,
    );

    await user.click(screen.getByRole("button", { name: "刪除教材" }));
    await user.type(screen.getByLabelText("刪除原因（選填）"), "不再使用");
    await user.click(screen.getByRole("button", { name: "確認刪除教材" }));

    expect(confirmMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/curriculums/10000000-0000-4000-8000-000000000009",
      expect.objectContaining({
        body: JSON.stringify({ reason: "不再使用" }),
        method: "DELETE",
      }),
    );
    expect(routerMocks.push).toHaveBeenCalledWith("/curriculums");
  });

  it("requires typed confirmation for permanent deletion", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "教材已永久刪除。",
          redirectTo: "/curriculums/recycle-bin",
          success: true,
        }),
        { headers: { "content-type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CurriculumLifecycleAction
        action="permanent-delete"
        curriculum={curriculum}
        source="recycle-bin"
      />,
    );

    await user.click(screen.getByRole("button", { name: "永久刪除" }));
    await user.type(
      screen.getByLabelText("請輸入教材名稱或「永久刪除」以確認"),
      "永久刪除",
    );
    await user.click(screen.getByRole("button", { name: "確認永久刪除" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/curriculums/10000000-0000-4000-8000-000000000009/permanent-delete",
      expect.objectContaining({
        body: JSON.stringify({ confirmation: "永久刪除" }),
        method: "POST",
      }),
    );
  });
});
