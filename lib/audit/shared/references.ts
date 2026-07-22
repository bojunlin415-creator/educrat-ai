export type AuditIdentifier = string;
export type AuditTimestamp = string;

declare const auditHashBrand: unique symbol;
export type AuditHash = string & { readonly [auditHashBrand]: true };

declare const canonicalAuditPayloadBrand: unique symbol;
export type CanonicalAuditPayload = string & {
  readonly [canonicalAuditPayloadBrand]: true;
};
