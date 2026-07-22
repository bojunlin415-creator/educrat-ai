import { InvalidAuthorizationContextError } from "@/lib/authorization/application/errors/application-authorization-errors";
import type { AuthorizationContextProvider } from "@/lib/authorization/application/context/authorization-context-provider";
import {
  isAuthorizationContext,
  type AuthorizationContext,
} from "@/lib/authorization/domain/context";

export interface AuthorizationContextFactory {
  create(provider: AuthorizationContextProvider): Promise<AuthorizationContext>;
}

function hasValidMetadata(context: AuthorizationContext): boolean {
  if (context.metadata === undefined) return true;

  return Object.values(context.metadata).every(
    (value) => value === undefined || typeof value === "string",
  );
}

function createImmutableAuthorizationContext(
  input: unknown,
): AuthorizationContext {
  if (!isAuthorizationContext(input) || !hasValidMetadata(input)) {
    throw new InvalidAuthorizationContextError();
  }

  return Object.freeze({
    identity: Object.freeze({
      id: input.identity.id,
      personId: input.identity.personId,
      type: input.identity.type,
    }),
    memberships: Object.freeze(
      input.memberships.map((membership) =>
        Object.freeze({
          id: membership.id,
          organizationId: membership.organizationId,
          status: membership.status,
        }),
      ),
    ),
    metadata: input.metadata
      ? Object.freeze({
          correlationId: input.metadata.correlationId,
          requestId: input.metadata.requestId,
          source: input.metadata.source,
        })
      : undefined,
    permissions: Object.freeze([...input.permissions]),
    personas: Object.freeze(
      input.personas.map((persona) =>
        Object.freeze({
          id: persona.id,
          organizationId: persona.organizationId,
          status: persona.status,
          type: persona.type,
        }),
      ),
    ),
    roles: Object.freeze(
      input.roles.map((role) =>
        Object.freeze({
          assignmentId: role.assignmentId,
          key: role.key,
          status: role.status,
          version: role.version,
        }),
      ),
    ),
    scopes: Object.freeze(
      input.scopes.map((scope) =>
        Object.freeze({
          organizationId: scope.organizationId,
          resourceId: scope.resourceId,
          scopeId: scope.scopeId,
          type: scope.type,
        }),
      ),
    ),
  });
}

export class DefaultAuthorizationContextFactory implements AuthorizationContextFactory {
  async create(
    provider: AuthorizationContextProvider,
  ): Promise<AuthorizationContext> {
    return createImmutableAuthorizationContext(await provider.provide());
  }
}
