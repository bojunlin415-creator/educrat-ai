import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AICurriculumGenerator } from "./ai-curriculum-generator";

const routerMocks = vi.hoisted(() => ({
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
      code: "core",
      displayName: "課綱通用版",
      id: "10000000-0000-4000-8000-000000000003",
      referenceType: "CORE" as const,
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

const draft = {
  challengeQuestions: [],
  examples: [
    {
      explanation: "分母相同時相加分子。",
      knowledgePointIds: ["kp-1"],
      prompt: "1/5 + 2/5",
      solution: "3/5",
    },
  ],
  knowledgePoints: [{ id: "kp-1", title: "同分母分數加法" }],
  learningObjectives: ["學生能計算同分母分數加法。"],
  questions: [
    {
      answer: "3/5",
      difficulty: "MEDIUM",
      explanation: "1+2=3，分母維持 5。",
      knowledgePointIds: ["kp-1"],
      prompt: "1/5 + 2/5 = ?",
    },
  ],
  solutions: ["3/5"],
  summary: ["同分母分數相加時，分母維持不變。"],
  teacherNotes: ["提醒學生不要相加分母。"],
  title: "同分母分數加法練習",
};

describe("AICurriculumGenerator", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("generates, previews, edits, and saves an AI curriculum draft", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            draft,
            message: "AI 原創教材已生成，請檢查後再儲存。",
            success: true,
          }),
          { headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "AI 原創教材草稿已儲存。",
            redirectTo: "/curriculums/10000000-0000-4000-8000-000000000099",
            success: true,
          }),
          { headers: { "content-type": "application/json" }, status: 201 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<AICurriculumGenerator options={options} />);

    fireEvent.change(screen.getByLabelText("學習主題"), {
      target: { value: "同分母分數加法" },
    });
    fireEvent.change(screen.getByLabelText("知識點（每行一個）"), {
      target: { value: "同分母分數加法" },
    });
    fireEvent.change(screen.getByLabelText("能力指標（每行一個）"), {
      target: { value: "能理解同分母分數加法。" },
    });
    fireEvent.change(screen.getByLabelText("教學目標（每行一個）"), {
      target: { value: "學生能計算同分母分數加法。" },
    });

    await user.click(screen.getByRole("button", { name: "AI Generate" }));

    expect(
      await screen.findByText("AI 原創教材已生成，請檢查後再儲存。"),
    ).toBeInTheDocument();
    const titleInput = screen.getByLabelText("教材標題");
    fireEvent.change(titleInput, {
      target: { value: "分數加法原創練習" },
    });
    await user.click(screen.getByRole("button", { name: "儲存為教材草稿" }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/curriculums/generate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/curriculums/generate/save",
      expect.objectContaining({ method: "POST" }),
    );
    const saveBody = JSON.parse(
      (fetchMock.mock.calls[1]?.[1] as { readonly body: string }).body,
    ) as {
      clientRequestId: string;
      generatedDraft: { title: string };
    };
    expect(saveBody.clientRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(saveBody.generatedDraft.title).toBe("分數加法原創練習");
    expect(routerMocks.push).toHaveBeenCalledWith(
      "/curriculums/10000000-0000-4000-8000-000000000099",
    );
    expect(
      within(screen.getByRole("status")).getByText("AI 原創教材草稿已儲存。"),
    ).toBeInTheDocument();
  });
});
