import { assertAllowedDecision } from "@/lib/authorization/application/adapter/authorization-request";
import {
  authorize,
  type AuthorizeDependencies,
  type AuthorizeRequest,
} from "@/lib/authorization/application/services/authorize";
import type { DecisionResult } from "@/lib/authorization/domain/decision";

export async function authorizeServerAction(
  request: AuthorizeRequest,
  dependencies: AuthorizeDependencies,
): Promise<Extract<DecisionResult, { decision: "ALLOW" }>> {
  const decision = await authorize(request, dependencies);
  assertAllowedDecision(decision);
  return decision;
}
