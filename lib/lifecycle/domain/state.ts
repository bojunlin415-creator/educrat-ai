import type { LifecycleStateId } from "@/lib/lifecycle/shared/references";

export const LIFECYCLE_STATE_CATEGORIES = [
  "WORKING",
  "RELEASED",
  "INACTIVE",
  "REMOVAL",
  "TERMINAL",
] as const;

export type LifecycleStateCategory =
  (typeof LIFECYCLE_STATE_CATEGORIES)[number];

export interface LifecycleState {
  readonly category: LifecycleStateCategory;
  readonly id: LifecycleStateId;
  readonly isRestorable: boolean;
  readonly isTerminal: boolean;
  readonly readonly: boolean;
  readonly version: number;
}
