import type {
  DecisionReason,
  DecisionResult,
} from "@/lib/authorization/domain/decision";
import { AuthorizationError } from "@/lib/authorization/domain/error";

export class ForbiddenError extends AuthorizationError {
  readonly reason: DecisionReason;

  constructor(decision: Extract<DecisionResult, { decision: "DENY" }>) {
    super("FORBIDDEN");
    this.name = "ForbiddenError";
    this.reason = decision.reason;
  }
}

export class UnauthenticatedError extends AuthorizationError {
  readonly reason = "MISSING_CONTEXT" as const;

  constructor() {
    super("UNAUTHENTICATED");
    this.name = "UnauthenticatedError";
  }
}

export class InvalidAuthorizationContextError extends AuthorizationError {
  readonly reason = "MISSING_CONTEXT" as const;

  constructor() {
    super("INVALID_AUTHORIZATION_CONTEXT");
    this.name = "InvalidAuthorizationContextError";
  }
}

export function authorizationErrorFromDecision(
  decision: Extract<DecisionResult, { decision: "DENY" }>,
): ForbiddenError {
  return new ForbiddenError(decision);
}
