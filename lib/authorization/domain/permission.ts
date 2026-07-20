import { AuthorizationError } from "@/lib/authorization/domain/error";

declare const permissionKeyBrand: unique symbol;

export type PermissionKey = string & {
  readonly [permissionKeyBrand]: "PermissionKey";
};

export const PERMISSION_KEY_PATTERN =
  /^[a-z][a-z0-9_]{0,62}\.[a-z][a-z0-9_]{0,62}$/;

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && PERMISSION_KEY_PATTERN.test(value);
}

export function parsePermissionKey(value: unknown): PermissionKey {
  if (!isPermissionKey(value)) {
    throw new AuthorizationError("INVALID_PERMISSION_KEY");
  }

  return value;
}
