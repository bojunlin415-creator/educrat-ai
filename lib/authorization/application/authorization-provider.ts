import type {
  AuthorizationContext,
  AuthorizationContextInput,
} from "@/lib/authorization/domain/context";
import type { PermissionResolver } from "@/lib/authorization/interfaces/permission-resolver";
import type { PolicyResolver } from "@/lib/authorization/interfaces/policy-resolver";

export interface AuthorizationProviderDependencies {
  readonly permissionResolver: PermissionResolver;
  readonly policyResolver: PolicyResolver;
}

export interface AuthorizationProvider {
  readonly permissionResolver: PermissionResolver;
  readonly policyResolver: PolicyResolver;

  createContext(input: AuthorizationContextInput): AuthorizationContext;
}

function freezeRecords<RecordType extends object>(
  records: readonly RecordType[],
): readonly Readonly<RecordType>[] {
  return Object.freeze(records.map((record) => Object.freeze({ ...record })));
}

export class DefaultAuthorizationProvider implements AuthorizationProvider {
  readonly permissionResolver: PermissionResolver;
  readonly policyResolver: PolicyResolver;

  constructor(dependencies: AuthorizationProviderDependencies) {
    this.permissionResolver = dependencies.permissionResolver;
    this.policyResolver = dependencies.policyResolver;
  }

  createContext(input: AuthorizationContextInput): AuthorizationContext {
    return Object.freeze({
      identity: Object.freeze({ ...input.identity }),
      memberships: freezeRecords(input.memberships),
      metadata: input.metadata
        ? Object.freeze({ ...input.metadata })
        : undefined,
      permissions: Object.freeze([...input.permissions]),
      personas: freezeRecords(input.personas),
      roles: freezeRecords(input.roles),
      scopes: freezeRecords(input.scopes),
    });
  }
}
