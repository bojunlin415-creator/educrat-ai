export const MASTERY_LEVELS = [
  "unknown",
  "beginner",
  "developing",
  "proficient",
  "mastered",
] as const;

export type MasteryLevel = (typeof MASTERY_LEVELS)[number];

export interface LearningEvent {
  readonly id: string;
  readonly organizationId: string;
  readonly assignmentId: string;
  readonly submissionId: string;
  readonly studentId: string;
  readonly classId: string;
  readonly curriculumId: string;
  readonly curriculumVersionId: string;
  readonly questionId: string;
  readonly knowledgePointId: string;
  readonly learningObjectiveId: string | null;
  readonly subject: string;
  readonly grade: string;
  readonly difficulty: number;
  readonly correct: boolean;
  readonly earnedScore: number;
  readonly maxScore: number;
  readonly timeSpentSeconds: number;
  readonly attemptNumber: number;
  readonly answeredAt: string;
  readonly createdAt: string;
}

export interface KnowledgeMasterySnapshot {
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly attemptCount: number;
  readonly accuracy: number;
  readonly masteryScore: number;
  readonly masteryLevel: MasteryLevel;
  readonly lastAnsweredAt: string;
}

export interface SubjectSummarySnapshot {
  readonly accuracy: number;
  readonly averageScore: number;
  readonly questionCount: number;
  readonly knowledgeCount: number;
  readonly masteryDistribution: Readonly<Record<MasteryLevel, number>>;
  readonly lastActivity: string;
}

export interface TeacherClassSummarySnapshot {
  readonly accuracy: number;
  readonly questionCount: number;
  readonly studentCount: number;
  readonly knowledgeDistribution: Readonly<Record<string, number>>;
  readonly weakKnowledgeRanking: readonly {
    readonly knowledgePointId: string;
    readonly accuracy: number;
    readonly attemptCount: number;
  }[];
  readonly activityTrend: readonly {
    readonly date: string;
    readonly questionCount: number;
    readonly accuracy: number;
  }[];
  readonly lastActivity: string;
}

export function calculateAccuracy(input: {
  readonly correctCount: number;
  readonly attemptCount: number;
}): number {
  if (input.attemptCount <= 0) return 0;
  return Number((input.correctCount / input.attemptCount).toFixed(4));
}

export function calculateMasteryScore(input: {
  readonly accuracy: number;
  readonly attemptCount: number;
}): number {
  const confidence = Math.min(1, input.attemptCount / 10);
  return Number((input.accuracy * confidence).toFixed(4));
}

export function resolveMasteryLevel(score: number): MasteryLevel {
  if (score <= 0) return "unknown";
  if (score < 0.4) return "beginner";
  if (score < 0.7) return "developing";
  if (score < 0.9) return "proficient";
  return "mastered";
}

export function buildKnowledgeMasterySnapshot(input: {
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly lastAnsweredAt: string;
}): KnowledgeMasterySnapshot {
  const attemptCount = input.correctCount + input.incorrectCount;
  const accuracy = calculateAccuracy({
    attemptCount,
    correctCount: input.correctCount,
  });
  const masteryScore = calculateMasteryScore({ accuracy, attemptCount });
  return Object.freeze({
    accuracy,
    attemptCount,
    correctCount: input.correctCount,
    incorrectCount: input.incorrectCount,
    lastAnsweredAt: input.lastAnsweredAt,
    masteryLevel: resolveMasteryLevel(masteryScore),
    masteryScore,
  });
}
