import type { KnowledgePointId } from "@/lib/ai-curriculum/shared/references";

export interface KnowledgePoint {
  readonly id: KnowledgePointId;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly competencyIndicator: string;
}

export function createKnowledgePoint(input: KnowledgePoint): KnowledgePoint {
  return Object.freeze({ ...input });
}
