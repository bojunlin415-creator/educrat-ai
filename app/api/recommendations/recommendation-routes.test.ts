import { AdaptiveLearningError } from "@/lib/adaptive-learning/errors";
import { GET as getDifficulty } from "./difficulty/route";
import { GET as getPath } from "./path/route";
import { GET as getStudentRecommendations } from "./student/route";
import { GET as getWeakKnowledge } from "./weak-knowledge/route";

const serviceMocks = vi.hoisted(() => ({
  getDifficultyRecommendations: vi.fn(),
  getLearningPathRecommendations: vi.fn(),
  getStudentRecommendations: vi.fn(),
  getWeakKnowledge: vi.fn(),
}));
const shadowMocks = vi.hoisted(() => ({
  observeLearnerShadowConsumer: vi.fn().mockResolvedValue({
    outcome: "DISABLED",
    result: null,
  }),
}));

vi.mock("@/lib/adaptive-learning/service", () => serviceMocks);
vi.mock("@/lib/learner-convergence/server", () => shadowMocks);

describe("AI-002 recommendation API", () => {
  afterEach(() => vi.clearAllMocks());

  it("loads student recommendations through the service boundary", async () => {
    serviceMocks.getStudentRecommendations.mockResolvedValue([
      { id: "rec-1", student_id: "10000000-0000-4000-8000-000000000001" },
    ]);
    const response = await getStudentRecommendations(
      new Request("http://localhost/api/recommendations/student"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        recommendations: [
          expect.objectContaining({
            id: "rec-1",
            student_id: "10000000-0000-4000-8000-000000000001",
          }),
        ],
        success: true,
      }),
    );
    expect(shadowMocks.observeLearnerShadowConsumer).toHaveBeenCalledWith({
      consumer: "adaptive_recommendations",
      scope: {
        legacyAccountIds: ["10000000-0000-4000-8000-000000000001"],
      },
    });
  });

  it("validates recommendation query before service", async () => {
    const response = await getStudentRecommendations(
      new Request(
        "http://localhost/api/recommendations/student?studentId=not-a-uuid",
      ),
    );
    expect(response.status).toBe(422);
    expect(serviceMocks.getStudentRecommendations).not.toHaveBeenCalled();
  });

  it("returns safe forbidden errors without stack traces", async () => {
    serviceMocks.getStudentRecommendations.mockRejectedValue(
      new AdaptiveLearningError("forbidden"),
    );
    const response = await getStudentRecommendations(
      new Request("http://localhost/api/recommendations/student"),
    );
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("stack");
  });

  it("loads path, weak knowledge, and difficulty endpoints", async () => {
    serviceMocks.getLearningPathRecommendations.mockResolvedValue([
      { id: "path-1" },
    ]);
    serviceMocks.getWeakKnowledge.mockResolvedValue([
      { knowledgePointId: "kp-1" },
    ]);
    serviceMocks.getDifficultyRecommendations.mockResolvedValue([
      { recommendedDifficulty: "easy" },
    ]);

    expect(
      await (
        await getPath(new Request("http://localhost/api/recommendations/path"))
      ).json(),
    ).toEqual(expect.objectContaining({ success: true }));
    expect(
      await (
        await getWeakKnowledge(
          new Request("http://localhost/api/recommendations/weak-knowledge"),
        )
      ).json(),
    ).toEqual(expect.objectContaining({ success: true }));
    expect(
      await (
        await getDifficulty(
          new Request("http://localhost/api/recommendations/difficulty"),
        )
      ).json(),
    ).toEqual(expect.objectContaining({ success: true }));
  });
});
