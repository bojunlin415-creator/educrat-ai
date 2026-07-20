import type { AuthorizationIdentifier } from "@/lib/authorization/shared/references";

export const RESOURCE_SCOPE_TYPES = [
  "PLATFORM",
  "ORGANIZATION",
  "CAMPUS",
  "SCHOOL",
  "GRADE",
  "CLASS",
  "COURSE",
  "CURRICULUM",
  "CHAPTER",
  "LESSON",
  "WORKSHEET",
  "ASSESSMENT",
  "STUDENT",
  "GUARDIAN",
  "REPORT",
  "AUDIT",
  "NOTIFICATION",
] as const;

export type ResourceScopeType = (typeof RESOURCE_SCOPE_TYPES)[number];

export interface ResourceScope {
  readonly organizationId?: AuthorizationIdentifier;
  readonly resourceId?: AuthorizationIdentifier;
  readonly scopeId?: AuthorizationIdentifier;
  readonly type: ResourceScopeType;
}
