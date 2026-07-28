import type { GeneratedCurriculum } from "@/lib/ai-curriculum/domain/curriculum";
import type { CurriculumGenerationInput } from "@/lib/ai-curriculum/domain/input";
import type { PrintableLayout } from "@/lib/ai-curriculum/domain/layout";
import type { CurriculumValidationIssue } from "@/lib/ai-curriculum/domain/validation";
import { createValidationResult } from "@/lib/ai-curriculum/domain/validation";
import {
  AI_CURRICULUM_CONTRACT_VERSION,
  CURRICULUM_DIFFICULTIES,
  ELEMENTARY_GRADES,
} from "@/lib/ai-curriculum/shared/references";

const MAX_QUESTION_COUNT = 50;

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function validateGenerationInput(input: CurriculumGenerationInput) {
  const issues: CurriculumValidationIssue[] = [];
  if (input.version !== AI_CURRICULUM_CONTRACT_VERSION) {
    issues.push({ code: "INVALID_INPUT", path: "version" });
  }
  if (!ELEMENTARY_GRADES.includes(input.grade)) {
    issues.push({ code: "INVALID_INPUT", path: "grade" });
  }
  if (isBlank(input.subject)) {
    issues.push({ code: "MISSING_REQUIRED_FIELD", path: "subject" });
  }
  if (isBlank(input.unit)) {
    issues.push({ code: "MISSING_REQUIRED_FIELD", path: "unit" });
  }
  if (isBlank(input.curriculumTopic)) {
    issues.push({ code: "MISSING_REQUIRED_FIELD", path: "curriculumTopic" });
  }
  if (isBlank(input.purpose)) {
    issues.push({ code: "MISSING_REQUIRED_FIELD", path: "purpose" });
  }
  if (input.competencyIndicators.length === 0) {
    issues.push({
      code: "MISSING_REQUIRED_FIELD",
      path: "competencyIndicators",
    });
  }
  if (input.learningObjectives.length === 0) {
    issues.push({
      code: "MISSING_REQUIRED_FIELD",
      path: "learningObjectives",
    });
  }
  if (!CURRICULUM_DIFFICULTIES.includes(input.difficulty)) {
    issues.push({ code: "INVALID_DIFFICULTY", path: "difficulty" });
  }
  if (
    !Number.isSafeInteger(input.questionCount) ||
    input.questionCount < 1 ||
    input.questionCount > MAX_QUESTION_COUNT
  ) {
    issues.push({ code: "INVALID_QUESTION_COUNT", path: "questionCount" });
  }
  if (input.knowledgePoints.length === 0) {
    issues.push({ code: "MISSING_KNOWLEDGE_MAPPING", path: "knowledgePoints" });
  }
  for (const [index, knowledgePoint] of input.knowledgePoints.entries()) {
    if (
      isBlank(knowledgePoint.id) ||
      isBlank(knowledgePoint.title) ||
      isBlank(knowledgePoint.competencyIndicator)
    ) {
      issues.push({
        code: "MISSING_REQUIRED_FIELD",
        path: `knowledgePoints.${index}`,
      });
    }
  }
  return createValidationResult(issues);
}

export function validateGeneratedCurriculum(
  input: CurriculumGenerationInput,
  curriculum: GeneratedCurriculum,
  layout: PrintableLayout,
) {
  const issues: CurriculumValidationIssue[] = [];
  const knownKnowledgePointIds = new Set(
    input.knowledgePoints.map((knowledgePoint) => knowledgePoint.id),
  );
  const questions = [...curriculum.exercises, ...curriculum.challengeQuestions];

  if (isBlank(curriculum.title)) {
    issues.push({ code: "MISSING_REQUIRED_FIELD", path: "title" });
  }
  if (
    curriculum.teachingGoals.length === 0 ||
    curriculum.summaryPoints.length === 0 ||
    curriculum.examples.length === 0 ||
    curriculum.answers.length === 0 ||
    curriculum.teacherReminders.length === 0
  ) {
    issues.push({ code: "INVALID_CURRICULUM", path: "sections" });
  }
  if (questions.length !== input.questionCount) {
    issues.push({ code: "INVALID_QUESTION_COUNT", path: "questions" });
  }
  for (const [index, question] of questions.entries()) {
    if (question.knowledgePointIds.length === 0) {
      issues.push({
        code: "MISSING_KNOWLEDGE_MAPPING",
        path: `questions.${index}.knowledgePointIds`,
      });
    }
    for (const knowledgePointId of question.knowledgePointIds) {
      if (!knownKnowledgePointIds.has(knowledgePointId)) {
        issues.push({
          code: "UNKNOWN_KNOWLEDGE_POINT",
          path: `questions.${index}.knowledgePointIds`,
        });
      }
    }
    if (!CURRICULUM_DIFFICULTIES.includes(question.difficulty)) {
      issues.push({
        code: "INVALID_DIFFICULTY",
        path: `questions.${index}.difficulty`,
      });
    }
    if (question.answerSpaceLines < 1) {
      issues.push({
        code: "INCOMPLETE_LAYOUT",
        path: `questions.${index}.answerSpaceLines`,
      });
    }
  }
  if (
    layout.pageSize !== "A4" ||
    layout.exportTarget !== "PDF" ||
    isBlank(layout.header) ||
    isBlank(layout.footer) ||
    !layout.numberedQuestions ||
    layout.answerSpaces.length !== questions.length
  ) {
    issues.push({ code: "INVALID_LAYOUT", path: "layout" });
  }

  return createValidationResult(issues);
}
