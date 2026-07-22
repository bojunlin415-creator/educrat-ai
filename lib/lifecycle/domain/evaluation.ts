import type { LifecycleDefinitionVersion } from "@/lib/lifecycle/domain/definition";
import type {
  LifecycleDefinitionId,
  LifecycleIntent,
  LifecycleStateId,
  LifecycleTransitionId,
} from "@/lib/lifecycle/shared/references";

export interface LifecycleEvaluationRequest {
  readonly currentStateId: LifecycleStateId;
  readonly definitionId: LifecycleDefinitionId;
  readonly intent: LifecycleIntent;
  readonly targetStateId: LifecycleStateId;
  readonly transitionId: LifecycleTransitionId;
  readonly version: LifecycleDefinitionVersion;
}
