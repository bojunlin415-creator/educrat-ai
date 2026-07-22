import {
  createAuthorizationEngine,
  type AuthorizationEvaluationRequest,
} from "@/lib/authorization/application/authorization-engine";
import {
  DefaultAuthorizationContextFactory,
  type AuthorizationContextFactory,
} from "@/lib/authorization/application/context/authorization-context-factory";
import type { AuthorizationContextProvider } from "@/lib/authorization/application/context/authorization-context-provider";
import type { DecisionResult } from "@/lib/authorization/domain/decision";

export type AuthorizeRequest = Omit<AuthorizationEvaluationRequest, "context">;

export interface AuthorizationDecisionEvaluator {
  evaluate(request: AuthorizationEvaluationRequest): Promise<DecisionResult>;
}

export interface AuthorizeDependencies {
  readonly contextFactory?: AuthorizationContextFactory;
  readonly contextProvider: AuthorizationContextProvider;
  readonly evaluator?: AuthorizationDecisionEvaluator;
}

/**
 * Canonical application entry point for the pure authorization runtime.
 * Context acquisition is delegated to a trusted provider. Product business
 * rules and resource acquisition remain outside this module.
 */
export async function authorize(
  request: AuthorizeRequest,
  dependencies: AuthorizeDependencies,
): Promise<DecisionResult> {
  const evaluator = dependencies.evaluator ?? createAuthorizationEngine();
  const contextFactory =
    dependencies.contextFactory ?? new DefaultAuthorizationContextFactory();
  const context = await contextFactory.create(dependencies.contextProvider);
  return evaluator.evaluate(Object.freeze({ ...request, context }));
}
