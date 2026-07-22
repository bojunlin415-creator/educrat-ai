export const AUDIT_METADATA_KEYS = [
  "approvalReference",
  "caseReference",
  "dependencyDecision",
  "failureClass",
  "impactCount",
  "operationClass",
  "policyVersion",
  "purposeCode",
  "redactionStatus",
  "stateAfter",
  "stateBefore",
] as const;

export type AuditMetadataKey = (typeof AUDIT_METADATA_KEYS)[number];
export type AuditMetadataValue = string | number;
export type AuditMetadata = Readonly<
  Partial<Record<AuditMetadataKey, AuditMetadataValue>>
>;
