import { randomUUID } from "node:crypto";

const CURRICULUM_NAME_MAX_LENGTH = 120;

function assertCurriculumNameLength(name: string) {
  if (name.length > CURRICULUM_NAME_MAX_LENGTH) {
    throw new Error("E2E curriculum fixture name exceeds the product limit.");
  }

  return name;
}

export function createE2ERunId(workerIndex: number) {
  const timestamp = Date.now().toString(36);
  const processId = process.pid.toString(36);
  const randomSuffix = randomUUID().replaceAll("-", "").slice(0, 8);

  return `${timestamp}-w${workerIndex}-${processId}-${randomSuffix}`.toLowerCase();
}

export function createUniqueCurriculumName(
  runId: string,
  purpose = "國語教材",
) {
  return assertCurriculumNameLength(`E2E ${purpose} ${runId}`);
}

export function createUpdatedCurriculumName(curriculumName: string) {
  return assertCurriculumNameLength(`${curriculumName} 已更新`);
}
