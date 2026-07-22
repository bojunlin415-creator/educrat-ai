import {
  authorizationErrorFromDecision,
  type ForbiddenError,
  InvalidAuthorizationContextError,
  UnauthenticatedError,
} from "@/lib/authorization/application/errors/application-authorization-errors";
import {
  authorize,
  type AuthorizeDependencies,
  type AuthorizeRequest,
} from "@/lib/authorization/application/services/authorize";
import type { DecisionResult } from "@/lib/authorization/domain/decision";

type AllowDecision = Extract<DecisionResult, { decision: "ALLOW" }>;
type DenyDecision = Extract<DecisionResult, { decision: "DENY" }>;

export type ApiAuthorizationResult =
  | Readonly<{
      authorized: true;
      decision: AllowDecision;
    }>
  | Readonly<{
      authorized: false;
      decision?: DenyDecision;
      error:
        | ForbiddenError
        | InvalidAuthorizationContextError
        | UnauthenticatedError;
    }>;

export async function authorizeApiRequest(
  request: AuthorizeRequest,
  dependencies: AuthorizeDependencies,
): Promise<ApiAuthorizationResult> {
  try {
    const decision = await authorize(request, dependencies);
    if (decision.decision === "DENY") {
      return Object.freeze({
        authorized: false,
        decision,
        error: authorizationErrorFromDecision(decision),
      });
    }
    return Object.freeze({ authorized: true, decision });
  } catch (error) {
    if (
      error instanceof UnauthenticatedError ||
      error instanceof InvalidAuthorizationContextError
    ) {
      return Object.freeze({ authorized: false, error });
    }
    throw error;
  }
}
