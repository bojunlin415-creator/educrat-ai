import type {
  PrintExportTarget,
  PrintPageSize,
} from "@/lib/ai-curriculum/shared/references";

export interface PrintableQuestionLayout {
  readonly answerSpaceLines: number;
  readonly number: number;
  readonly questionId: string;
}

export interface PrintableLayout {
  readonly answerSpaces: readonly PrintableQuestionLayout[];
  readonly exportTarget: PrintExportTarget;
  readonly footer: string;
  readonly header: string;
  readonly numberedQuestions: boolean;
  readonly pageSize: PrintPageSize;
  readonly sectionOrder: readonly string[];
}

export function createPrintableLayout(input: PrintableLayout): PrintableLayout {
  return Object.freeze({
    ...input,
    answerSpaces: Object.freeze(
      input.answerSpaces.map((space) => Object.freeze({ ...space })),
    ),
    sectionOrder: Object.freeze([...input.sectionOrder]),
  });
}
