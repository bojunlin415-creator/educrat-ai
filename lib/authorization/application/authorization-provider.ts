import type { AuthorizationContext } from "@/lib/authorization/domain/context";
import {
  DefaultAuthorizationContextFactory,
  type AuthorizationContextFactory,
} from "@/lib/authorization/application/context/authorization-context-factory";
import type { AuthorizationContextProvider } from "@/lib/authorization/application/context/authorization-context-provider";
import type { PermissionResolver } from "@/lib/authorization/interfaces/permission-resolver";
import type { PolicyResolver } from "@/lib/authorization/interfaces/policy-resolver";

export interface AuthorizationProviderDependencies {
  readonly contextFactory?: AuthorizationContextFactory;
  readonly permissionResolver: PermissionResolver;
  readonly policyResolver: PolicyResolver;
}

export interface AuthorizationProvider {
  readonly permissionResolver: PermissionResolver;
  readonly policyResolver: PolicyResolver;

  createContext(
    provider: AuthorizationContextProvider,
  ): Promise<AuthorizationContext>;
}

export class DefaultAuthorizationProvider implements AuthorizationProvider {
  readonly permissionResolver: PermissionResolver;
  readonly policyResolver: PolicyResolver;
  readonly #contextFactory: AuthorizationContextFactory;

  constructor(dependencies: AuthorizationProviderDependencies) {
    this.permissionResolver = dependencies.permissionResolver;
    this.policyResolver = dependencies.policyResolver;
    this.#contextFactory =
      dependencies.contextFactory ?? new DefaultAuthorizationContextFactory();
  }

  createContext(
    provider: AuthorizationContextProvider,
  ): Promise<AuthorizationContext> {
    return this.#contextFactory.create(provider);
  }
}
