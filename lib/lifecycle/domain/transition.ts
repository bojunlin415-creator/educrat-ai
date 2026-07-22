import type { LifecycleRequirements } from "@/lib/lifecycle/domain/requirements";
import type {
  LifecycleIntent,
  LifecycleStateId,
  LifecycleTransitionId,
} from "@/lib/lifecycle/shared/references";

export const LIFECYCLE_INTENTS = [
  "PUBLISH",
  "ARCHIVE",
  "RESTORE",
  "TRASH",
  "DELETE",
] as const;

export interface LifecycleTransition {
  readonly from: LifecycleStateId;
  readonly intent: LifecycleIntent;
  readonly requirements: LifecycleRequirements;
  readonly to: LifecycleStateId;
  readonly transitionId: LifecycleTransitionId;
  readonly version: number;
}
