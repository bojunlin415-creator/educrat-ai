import type { AuthorizationContextInput } from "@/lib/authorization/domain/context";
import type {
  IdentityProvider,
  MembershipProvider,
  PermissionGrantProvider,
  PersonaProvider,
  RoleProvider,
} from "@/lib/authorization/interfaces/authorization-context-sources";
import {
  InvalidAuthorizationContextError,
  UnauthenticatedError,
} from "@/lib/authorization/application/errors/application-authorization-errors";
import {
  validateTrustedContextSources,
  validateTrustedIdentity,
  validateTrustedMembership,
} from "@/lib/authorization/application/context/trusted-context-validation";

const TRUSTED_CONTEXT_ENVELOPE = Symbol("TRUSTED_CONTEXT_ENVELOPE");

export interface TrustedAuthorizationContextEnvelope {
  readonly context: AuthorizationContextInput;
}

interface IssuedTrustedAuthorizationContextEnvelope extends TrustedAuthorizationContextEnvelope {
  readonly [TRUSTED_CONTEXT_ENVELOPE]: true;
}

export interface AuthorizationContextProvider {
  provide(): Promise<TrustedAuthorizationContextEnvelope>;
}

export interface AuthorizationContextProviderDependencies {
  readonly identityProvider: IdentityProvider;
  readonly membershipProvider: MembershipProvider;
  readonly permissionGrantProvider: PermissionGrantProvider;
  readonly personaProvider: PersonaProvider;
  readonly roleProvider: RoleProvider;
}

export function isTrustedAuthorizationContextEnvelope(
  value: unknown,
): value is IssuedTrustedAuthorizationContextEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    TRUSTED_CONTEXT_ENVELOPE in value &&
    (value as Readonly<Record<PropertyKey, unknown>>)[
      TRUSTED_CONTEXT_ENVELOPE
    ] === true
  );
}

export class DefaultAuthorizationContextProvider implements AuthorizationContextProvider {
  readonly #dependencies: AuthorizationContextProviderDependencies;

  constructor(dependencies: AuthorizationContextProviderDependencies) {
    this.#dependencies = Object.freeze({
      identityProvider: dependencies.identityProvider,
      membershipProvider: dependencies.membershipProvider,
      permissionGrantProvider: dependencies.permissionGrantProvider,
      personaProvider: dependencies.personaProvider,
      roleProvider: dependencies.roleProvider,
    });
  }

  async provide(): Promise<TrustedAuthorizationContextEnvelope> {
    const identityCandidate =
      await this.#dependencies.identityProvider.getIdentity();
    if (identityCandidate === null) throw new UnauthenticatedError();
    const identity = validateTrustedIdentity(identityCandidate);

    const membershipCandidate =
      await this.#dependencies.membershipProvider.getMemberships(identity);
    if (membershipCandidate === null) {
      throw new InvalidAuthorizationContextError();
    }
    const membership = validateTrustedMembership(membershipCandidate, identity);

    const activeOrganizationId = membership.activeOrganizationId;
    const [personas, roles, permissionGrants] = await Promise.all([
      this.#dependencies.personaProvider.getPersonas(
        identity,
        activeOrganizationId,
      ),
      this.#dependencies.roleProvider.getRoles(identity, activeOrganizationId),
      this.#dependencies.permissionGrantProvider.getPermissionGrants(
        identity,
        activeOrganizationId,
      ),
    ]);
    const context = validateTrustedContextSources({
      identity,
      membership,
      permissionGrants,
      personas,
      roles,
    });

    return Object.freeze({
      [TRUSTED_CONTEXT_ENVELOPE]: true,
      context,
    });
  }
}
