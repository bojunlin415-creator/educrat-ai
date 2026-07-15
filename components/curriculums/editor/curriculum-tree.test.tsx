import { fireEvent, render, screen } from "@testing-library/react";
import type { CurriculumChapter } from "@/lib/curriculum/service";
import { CurriculumTree } from "@/components/curriculums/editor/curriculum-tree";
import { HierarchyProvider } from "@/components/curriculums/editor/hierarchy-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

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

describe("CurriculumTree", () => {
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
});
