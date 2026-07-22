import type { DecisionResult } from "@/lib/authorization/domain/decision";
import { authorizationErrorFromDecision } from "@/lib/authorization/application/errors/application-authorization-errors";

export function assertAllowedDecision(
  decision: DecisionResult,
): asserts decision is Extract<DecisionResult, { decision: "ALLOW" }> {
  if (decision.decision === "DENY") {
    throw authorizationErrorFromDecision(decision);
  }
}
