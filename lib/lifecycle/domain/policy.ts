import type { LifecycleDefinition } from "@/lib/lifecycle/domain/definition";
import type { LifecycleDecisionReason } from "@/lib/lifecycle/domain/decision";
import type { LifecycleState } from "@/lib/lifecycle/domain/state";
import type { LifecycleTransition } from "@/lib/lifecycle/domain/transition";

export interface LifecyclePolicyEvaluation {
  readonly currentState: LifecycleState;
  readonly definition: LifecycleDefinition;
  readonly targetState: LifecycleState;
  readonly transition: LifecycleTransition;
}

export type LifecyclePolicyResult =
  | Readonly<{ readonly decision: "ALLOW" }>
  | Readonly<{
      readonly decision: "DENY";
      readonly reason: LifecycleDecisionReason;
    }>;
