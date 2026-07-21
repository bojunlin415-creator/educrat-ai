import { AuthorizationError } from "@/lib/authorization/domain/error";

declare const permissionKeyBrand: unique symbol;
declare const permissionExpressionBrand: unique symbol;

export type PermissionKey = string & {
  readonly [permissionKeyBrand]: "PermissionKey";
};

/**
 * Runtime-only policy expression. Wildcards never become catalog permissions
 * and are never stored in AuthorizationContext.permissions.
 */
export type PermissionExpression = string & {
  readonly [permissionExpressionBrand]: "PermissionExpression";
};

export const PERMISSION_KEY_PATTERN =
  /^[a-z][a-z0-9_]{0,62}\.[a-z][a-z0-9_]{0,62}$/;
export const RESOURCE_PERMISSION_WILDCARD_PATTERN =
  /^[a-z][a-z0-9_]{0,62}\.\*$/;

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && PERMISSION_KEY_PATTERN.test(value);
}

export function parsePermissionKey(value: unknown): PermissionKey {
  if (!isPermissionKey(value)) {
    throw new AuthorizationError("INVALID_PERMISSION_KEY");
  }

  return value;
}

export function isPermissionExpression(
  value: unknown,
): value is PermissionExpression {
  return (
    value === "*" ||
    isPermissionKey(value) ||
    (typeof value === "string" &&
      RESOURCE_PERMISSION_WILDCARD_PATTERN.test(value))
  );
}

export function parsePermissionExpression(
  value: unknown,
): PermissionExpression {
  if (!isPermissionExpression(value)) {
    throw new AuthorizationError("INVALID_PERMISSION_EXPRESSION");
  }

  return value;
}

export function matchesPermissionExpression(
  expression: PermissionExpression,
  requestedPermission: PermissionKey,
): boolean {
  if (expression === "*") return true;
  if ((expression as string) === (requestedPermission as string)) return true;
  if (!expression.endsWith(".*")) return false;

  const requestedResource = requestedPermission.slice(
    0,
    requestedPermission.indexOf("."),
  );
  return expression.slice(0, -2) === requestedResource;
}
