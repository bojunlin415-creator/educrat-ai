import { CurriculumError } from "@/lib/curriculum/errors";
import { SubjectCapabilityError } from "@/lib/subjects";
import { POST } from "./route";

const serviceMocks = vi.hoisted(() => ({
  generateAICurriculumDraft: vi.fn(),
}));

vi.mock("@/lib/curriculum/ai-generation", () => serviceMocks);

const validPayload = {
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
  subjectId: "10000000-0000-4000-8000-000000000001",
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

describe("AI curriculum generation API", () => {
  afterEach(() => vi.clearAllMocks());

  it("generates an original structured curriculum draft", async () => {
    serviceMocks.generateAICurriculumDraft.mockResolvedValue({
      draft,
      metadata: {
        correlationId: "corr-1",
        model: "gpt-test",
        provider: "openai",
        requestId: "req-1",
        usage: {
          estimatedCost: 0,
          inputTokens: 10,
          latencyMs: 100,
          model: "gpt-test",
          outputTokens: 20,
          provider: "openai",
        },
        version: 1,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/curriculums/generate", {
        body: JSON.stringify(validPayload),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.generateAICurriculumDraft).toHaveBeenCalledWith(
      validPayload,
    );
    await expect(response.json()).resolves.toMatchObject({
      draft: { title: "同分母分數加法練習" },
      success: true,
    });
  });

  it("rejects publisher-oriented prompts before service execution", async () => {
    const response = await POST(
      new Request("http://localhost/api/curriculums/generate", {
        body: JSON.stringify({ ...validPayload, curriculumTopic: "康軒單元" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(422);
    expect(serviceMocks.generateAICurriculumDraft).not.toHaveBeenCalled();
  });

  it("rejects a client-supplied subject display label", async () => {
    const response = await POST(
      new Request("http://localhost/api/curriculums/generate", {
        body: JSON.stringify({
          ...validPayload,
          subject: "數學",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(422);
    expect(serviceMocks.generateAICurriculumDraft).not.toHaveBeenCalled();
  });

  it("returns safe provider errors", async () => {
    serviceMocks.generateAICurriculumDraft.mockRejectedValue(
      new CurriculumError("ai_provider_unavailable"),
    );

    const response = await POST(
      new Request("http://localhost/api/curriculums/generate", {
        body: JSON.stringify(validPayload),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("OPENAI_API_KEY");
  });

  it("returns a structured subject capability error", async () => {
    serviceMocks.generateAICurriculumDraft.mockRejectedValue(
      new SubjectCapabilityError({
        capability: "content_generation",
        reason: "NOT_AVAILABLE",
        subject: "science",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/curriculums/generate", {
        body: JSON.stringify(validPayload),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        capability: "content_generation",
        code: "subject_capability_unavailable",
        subject: "science",
      },
      success: false,
    });
  });
});
