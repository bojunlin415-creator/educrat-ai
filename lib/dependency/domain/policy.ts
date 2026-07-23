import type { DependencyReference } from "@/lib/dependency/domain/model";
import type { DependencyCheckRequest } from "@/lib/dependency/domain/request";

export interface DependencyPolicyEvaluation {
  readonly dependencies: readonly DependencyReference[];
  readonly request: DependencyCheckRequest;
}

export type DependencyPolicyResult =
  | Readonly<{ readonly decision: "ALLOW" }>
  | Readonly<{
      readonly decision: "DENY";
      readonly reason: "DEPENDENCY_POLICY_DENIED";
    }>;
