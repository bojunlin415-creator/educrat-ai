export const CURRICULUM_EXPORT_MODES = [
  "worksheet",
  "answer-sheet",
  "combined",
] as const;

export type CurriculumExportMode = (typeof CURRICULUM_EXPORT_MODES)[number];

export interface CurriculumExportMetadata {
  readonly curriculumId: string;
  readonly curriculumVersionId: string;
  readonly grade: string;
  readonly organizationName: string;
  readonly subject: string;
  readonly title: string;
  readonly topic: string;
  readonly version: number;
}

export interface CurriculumExportAnswer {
  readonly explanation?: string;
  readonly value: string;
}

export interface CurriculumExportQuestion {
  readonly answer?: CurriculumExportAnswer;
  readonly challenge: boolean;
  readonly knowledgePointIds: readonly string[];
  readonly number: number;
  readonly prompt: string;
}

export interface CurriculumExportSection {
  readonly heading: string;
  readonly items: readonly string[];
  readonly kind: "examples" | "notes" | "objectives" | "questions" | "summary";
  readonly questions?: readonly CurriculumExportQuestion[];
}

export interface CurriculumExportDocument {
  readonly metadata: CurriculumExportMetadata;
  readonly mode: CurriculumExportMode;
  readonly sections: readonly CurriculumExportSection[];
  readonly version: 1;
}

export interface CurriculumExportQuestionInput {
  readonly answer?: CurriculumExportAnswer;
  readonly challenge?: boolean;
  readonly knowledgePointIds?: readonly string[];
  readonly prompt: string;
}

export interface CreateCurriculumExportDocumentInput {
  readonly metadata: CurriculumExportMetadata;
  readonly mode: CurriculumExportMode;
  readonly sections?: readonly Omit<CurriculumExportSection, "questions">[];
  readonly questions: readonly CurriculumExportQuestionInput[];
}

function freezeQuestion(
  question: CurriculumExportQuestion,
): CurriculumExportQuestion {
  return Object.freeze({
    ...question,
    answer: question.answer ? Object.freeze({ ...question.answer }) : undefined,
    knowledgePointIds: Object.freeze([...question.knowledgePointIds]),
  });
}

function freezeSection(section: CurriculumExportSection) {
  return Object.freeze({
    ...section,
    items: Object.freeze([...section.items]),
    questions: section.questions
      ? Object.freeze(section.questions.map(freezeQuestion))
      : undefined,
  });
}

export function createCurriculumExportDocument(
  input: CreateCurriculumExportDocumentInput,
): CurriculumExportDocument {
  const numberedQuestions = input.questions.map((question, index) =>
    freezeQuestion({
      answer: question.answer
        ? Object.freeze({ ...question.answer })
        : undefined,
      challenge: question.challenge ?? false,
      knowledgePointIds: Object.freeze([...(question.knowledgePointIds ?? [])]),
      number: index + 1,
      prompt: question.prompt,
    }),
  );
  const baseSections = input.sections ?? [];
  const questionSection = freezeSection({
    heading: "題目",
    items: [],
    kind: "questions",
    questions: Object.freeze(numberedQuestions),
  });

  return Object.freeze({
    metadata: Object.freeze({ ...input.metadata }),
    mode: input.mode,
    sections: Object.freeze([
      ...baseSections.map(freezeSection),
      questionSection,
    ]),
    version: 1,
  });
}
