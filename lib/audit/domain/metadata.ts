export const AUDIT_METADATA_KEYS = [
  "approvalReference",
  "caseReference",
  "curriculumId",
  "curriculumVersionId",
  "dependencyDecision",
  "failureClass",
  "impactCount",
  "operationClass",
  "outputFormat",
  "policyVersion",
  "purposeCode",
  "exportMode",
  "redactionStatus",
  "stateAfter",
  "stateBefore",
] as const;

export type AuditMetadataKey = (typeof AUDIT_METADATA_KEYS)[number];
export type AuditMetadataValue = string | number;
export type AuditMetadata = Readonly<
  Partial<Record<AuditMetadataKey, AuditMetadataValue>>
>;
