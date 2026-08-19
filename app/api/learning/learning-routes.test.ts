import { LearningAnalyticsError } from "@/lib/learning-analytics/errors";
import { POST as postLearningEvent } from "./events/route";
import { GET as getKnowledgeSummary } from "./knowledge/route";
import { GET as getStudentSummary } from "./student/summary/route";
import { GET as getStudentTimeline } from "./student/timeline/route";
import { GET as getTeacherClassSummary } from "./teacher/classes/[classId]/summary/route";
import { GET as getWeakKnowledge } from "./teacher/classes/[classId]/weak-knowledge/route";

const serviceMocks = vi.hoisted(() => ({
  createLearningEvent: vi.fn(),
  getKnowledgeSummary: vi.fn(),
  getStudentSummary: vi.fn(),
  getStudentTimeline: vi.fn(),
  getTeacherClassSummary: vi.fn(),
  getWeakKnowledgeRanking: vi.fn(),
}));
const shadowMocks = vi.hoisted(() => ({
  observeLearnerShadowConsumer: vi.fn().mockResolvedValue({
    outcome: "DISABLED",
    result: null,
  }),
}));

vi.mock("@/lib/learning-analytics/service", () => serviceMocks);
vi.mock("@/lib/learner-convergence/server", () => shadowMocks);

const validLearningEvent = {
  assignmentId: "10000000-0000-4000-8000-000000000001",
  classId: "10000000-0000-4000-8000-000000000002",
  correct: true,
  curriculumId: "10000000-0000-4000-8000-000000000003",
  curriculumVersionId: "10000000-0000-4000-8000-000000000004",
  difficulty: 3,
  earnedScore: 1,
  grade: "國小五年級",
  knowledgePointId: "fraction-addition",
  learningObjectiveId: "add-like-denominators",
  maxScore: 1,
  questionId: "q-1",
  studentId: "10000000-0000-4000-8000-000000000005",
  subject: "數學",
  submissionId: "10000000-0000-4000-8000-000000000006",
  timeSpentSeconds: 75,
};

describe("AN-001 learning analytics API", () => {
  afterEach(() => vi.clearAllMocks());

  it("creates learning events with validated JSON", async () => {
    serviceMocks.createLearningEvent.mockResolvedValue({ id: "event-1" });
    const response = await postLearningEvent(
      new Request("http://localhost/api/learning/events", {
        body: JSON.stringify(validLearningEvent),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(201);
    expect(serviceMocks.createLearningEvent).toHaveBeenCalledWith(
      validLearningEvent,
    );
    expect(shadowMocks.observeLearnerShadowConsumer).toHaveBeenCalledWith({
      consumer: "learning_events",
      scope: { legacyAccountIds: [validLearningEvent.studentId] },
    });
  });

  it("rejects malformed learning event before service", async () => {
    const response = await postLearningEvent(
      new Request("http://localhost/api/learning/events", {
        body: JSON.stringify({ ...validLearningEvent, maxScore: 0 }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(422);
    expect(serviceMocks.createLearningEvent).not.toHaveBeenCalled();
  });

  it("returns safe forbidden errors without stack traces", async () => {
    serviceMocks.createLearningEvent.mockRejectedValue(
      new LearningAnalyticsError("forbidden"),
    );
    const response = await postLearningEvent(
      new Request("http://localhost/api/learning/events", {
        body: JSON.stringify(validLearningEvent),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("stack");
  });

  it("loads student summary, timeline, and knowledge summary", async () => {
    serviceMocks.getStudentSummary.mockResolvedValue({ subjects: [] });
    serviceMocks.getStudentTimeline.mockResolvedValue([{ id: "event-1" }]);
    serviceMocks.getKnowledgeSummary.mockResolvedValue([{ id: "kp-1" }]);

    expect(
      await (
        await getStudentSummary(
          new Request(
            "http://localhost/api/learning/student/summary?studentId=10000000-0000-4000-8000-000000000005",
          ),
        )
      ).json(),
    ).toEqual(expect.objectContaining({ success: true }));
    expect(shadowMocks.observeLearnerShadowConsumer).toHaveBeenCalledWith({
      consumer: "mastery_subject_projections",
      scope: {
        legacyAccountIds: ["10000000-0000-4000-8000-000000000005"],
      },
    });
    expect(
      await (
        await getStudentTimeline(
          new Request("http://localhost/api/learning/student/timeline?limit=5"),
        )
      ).json(),
    ).toEqual(expect.objectContaining({ success: true }));
    expect(
      await (
        await getKnowledgeSummary(
          new Request("http://localhost/api/learning/knowledge"),
        )
      ).json(),
    ).toEqual(expect.objectContaining({ success: true }));
  });

  it("loads teacher class summary and weak knowledge ranking", async () => {
    serviceMocks.getTeacherClassSummary.mockResolvedValue({ id: "summary-1" });
    serviceMocks.getWeakKnowledgeRanking.mockResolvedValue([
      { knowledgePointId: "kp", accuracy: 0.25 },
    ]);

    const params = Promise.resolve({
      classId: "10000000-0000-4000-8000-000000000002",
    });
    const summaryResponse = await getTeacherClassSummary(
      new Request(
        "http://localhost/api/learning/teacher/classes/10000000-0000-4000-8000-000000000002/summary",
      ),
      { params },
    );
    const weakResponse = await getWeakKnowledge(
      new Request(
        "http://localhost/api/learning/teacher/classes/10000000-0000-4000-8000-000000000002/weak-knowledge",
      ),
      { params },
    );

    expect(summaryResponse.status).toBe(200);
    expect(weakResponse.status).toBe(200);
  });
});
