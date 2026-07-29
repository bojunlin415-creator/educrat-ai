import { CurriculumError } from "@/lib/curriculum/errors";
import { POST } from "./route";

const serviceMocks = vi.hoisted(() => ({
  saveAICurriculumDraft: vi.fn(),
}));

vi.mock("@/lib/curriculum/ai-generation", () => serviceMocks);

const generatedDraft = {
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

const validPayload = {
  clientRequestId: "10000000-0000-4000-8000-000000000010",
  curriculumReferenceId: "10000000-0000-4000-8000-000000000003",
  generatedDraft,
  gradeId: "10000000-0000-4000-8000-000000000002",
  originalDraft: generatedDraft,
  request: {
    competencyIndicators: ["能理解同分母分數加法。"],
    curriculumTopic: "同分母分數加法",
    difficulty: "MEDIUM",
    grade: 4,
    knowledgePoints: ["同分母分數加法"],
    language: "zh-TW",
    learningObjectives: ["學生能計算同分母分數加法。"],
    learningStage: "國民小學",
    purpose: "課堂補充教材",
    questionCount: 4,
    subject: "數學",
  },
  schoolYear: 115,
  semester: 1,
  subjectId: "10000000-0000-4000-8000-000000000001",
};

describe("AI curriculum save API", () => {
  afterEach(() => vi.clearAllMocks());

  it("persists a generated curriculum draft through the service boundary", async () => {
    serviceMocks.saveAICurriculumDraft.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000099",
      name: generatedDraft.title,
    });

    const response = await POST(
      new Request("http://localhost/api/curriculums/generate/save", {
        body: JSON.stringify(validPayload),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(serviceMocks.saveAICurriculumDraft).toHaveBeenCalledWith(
      validPayload,
    );
    await expect(response.json()).resolves.toMatchObject({
      redirectTo: "/curriculums/10000000-0000-4000-8000-000000000099",
      success: true,
    });
  });

  it("does not expose raw database errors", async () => {
    serviceMocks.saveAICurriculumDraft.mockRejectedValue(
      new CurriculumError("duplicate_name"),
    );

    const response = await POST(
      new Request("http://localhost/api/curriculums/generate/save", {
        body: JSON.stringify(validPayload),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("PostgreSQL");
  });
});
