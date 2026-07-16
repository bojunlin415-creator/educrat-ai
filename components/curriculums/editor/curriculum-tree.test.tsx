import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CurriculumChapter } from "@/lib/curriculum/service";
import { CurriculumEditor } from "@/components/curriculums/editor/curriculum-editor";
import { CurriculumTree } from "@/components/curriculums/editor/curriculum-tree";
import { HierarchyProvider } from "@/components/curriculums/editor/hierarchy-context";

const routerMocks = vi.hoisted(() => ({ refresh: vi.fn() }));
const hierarchyClientMocks = vi.hoisted(() => ({
  sendHierarchyMutation: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));
vi.mock("@/lib/curriculum/hierarchy-client", () => hierarchyClientMocks);

const versionId = "10000000-0000-4000-8000-000000000001";

function chapter(index: number): CurriculumChapter {
  return {
    chapter_no: index,
    created_at: "2026-07-15T00:00:00.000Z",
    curriculum_version_id: versionId,
    description: null,
    id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    lessons: [],
    order_no: index,
    status: "draft",
    title: `章節 ${index}`,
    updated_at: "2026-07-15T00:00:00.000Z",
  };
}

function chapterWithLesson(): CurriculumChapter {
  return {
    ...chapter(1),
    lessons: [
      {
        chapter_id: chapter(1).id,
        created_at: "2026-07-15T00:00:00.000Z",
        difficulty: null,
        estimated_minutes: 40,
        id: "30000000-0000-4000-8000-000000000001",
        keywords: [],
        learning_objectives: ["能完成原始目標"],
        lesson_no: 1,
        order_no: 1,
        status: "draft",
        teaching_notes: "原始備註",
        title: "原始課次",
        updated_at: "2026-07-15T00:00:00.000Z",
      },
    ],
  };
}

describe("CurriculumTree", () => {
  afterEach(() => vi.clearAllMocks());

  it("lazy-renders chapter pages and exposes accessible controls", () => {
    const chapters = Array.from({ length: 30 }, (_, index) =>
      chapter(index + 1),
    );
    const { container } = render(
      <HierarchyProvider
        canEdit
        initialChapters={chapters}
        versionId={versionId}
      >
        <CurriculumTree />
      </HierarchyProvider>,
    );

    expect(container.querySelector('[role="tree"]')).toBeInTheDocument();
    expect(container.querySelectorAll('li[role="treeitem"]')).toHaveLength(25);
    expect(
      screen.getByRole("button", { name: "新增章節" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("載入更多章節"));
    expect(container.querySelectorAll('li[role="treeitem"]')).toHaveLength(30);
    expect(
      screen.getByRole("button", { name: "將第 1 章向上移" }),
    ).toBeDisabled();
  }, 15_000);

  it("keeps teacher/reviewer mode read-only", () => {
    render(
      <HierarchyProvider
        canEdit={false}
        initialChapters={[chapter(1)]}
        versionId={versionId}
      >
        <CurriculumTree />
      </HierarchyProvider>,
    );
    expect(
      screen.queryByRole("button", { name: "新增章節" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("treeitem")).not.toHaveAttribute(
      "draggable",
      "true",
    );
  });

  it("synchronizes a saved lesson into the tree before router refresh completes", async () => {
    hierarchyClientMocks.sendHierarchyMutation.mockResolvedValue({
      entityId: "30000000-0000-4000-8000-000000000001",
      message: "課次已更新。",
      success: true,
    });

    render(
      <CurriculumEditor
        canEdit
        chapters={[chapterWithLesson()]}
        versionId={versionId}
        versionNumber={1}
        versionStatus="draft"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /第 1 課.*原始課次/ }));
    fireEvent.change(screen.getByLabelText("課次標題"), {
      target: { value: "更新後課次" },
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存課次" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /第 1 課.*更新後課次/ }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /第 1 課.*原始課次/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /第 1 章.*章節 1/ }),
    ).toBeInTheDocument();
    expect(routerMocks.refresh).toHaveBeenCalledOnce();
  });
});
