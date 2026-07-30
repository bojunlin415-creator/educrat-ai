import {
  buildKnowledgeMasterySnapshot,
  calculateAccuracy,
  calculateMasteryScore,
  resolveMasteryLevel,
} from "@/lib/learning-analytics/domain";
import { createLearningEventSchema } from "@/lib/validation/learning-analytics";

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

describe("AN-001 learning analytics domain", () => {
  it("calculates knowledge mastery using attempts, not only average score", () => {
    const snapshot = buildKnowledgeMasterySnapshot({
      correctCount: 8,
      incorrectCount: 2,
      lastAnsweredAt: "2026-07-30T00:00:00.000Z",
    });
    expect(snapshot).toEqual({
      accuracy: 0.8,
      attemptCount: 10,
      correctCount: 8,
      incorrectCount: 2,
      lastAnsweredAt: "2026-07-30T00:00:00.000Z",
      masteryLevel: "proficient",
      masteryScore: 0.8,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("keeps mastery level thresholds deterministic", () => {
    expect(calculateAccuracy({ attemptCount: 4, correctCount: 3 })).toBe(0.75);
    expect(calculateMasteryScore({ accuracy: 1, attemptCount: 5 })).toBe(0.5);
    expect(resolveMasteryLevel(0)).toBe("unknown");
    expect(resolveMasteryLevel(0.39)).toBe("beginner");
    expect(resolveMasteryLevel(0.69)).toBe("developing");
    expect(resolveMasteryLevel(0.89)).toBe("proficient");
    expect(resolveMasteryLevel(0.9)).toBe("mastered");
  });

  it("accepts valid immutable learning event input", () => {
    expect(createLearningEventSchema.parse(validLearningEvent)).toEqual(
      validLearningEvent,
    );
  });

  it("rejects invalid cross-shape learning event input", () => {
    expect(
      createLearningEventSchema.safeParse({
        ...validLearningEvent,
        earnedScore: 2,
        extraTenant: "forged",
      }).success,
    ).toBe(false);
  });

  it("requires a knowledge point for every answer", () => {
    expect(
      createLearningEventSchema.safeParse({
        ...validLearningEvent,
        knowledgePointId: "",
      }).success,
    ).toBe(false);
  });
});
