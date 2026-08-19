import type { LearnerCutoverControlMode } from "@/lib/learner-convergence/cutover/domain";

export const CLASS_ROSTER_CUTOVER_VERSION = "le-001.class-roster.v1" as const;

export type ClassRosterActorRole =
  | "organization_admin"
  | "organization_owner"
  | "reviewer"
  | "student"
  | "teacher";

export type ClassRosterClassStatus = "active" | "archived" | "inactive";

export interface ClassRosterClassReference {
  readonly classId: string;
  readonly organizationId: string;
  readonly status: ClassRosterClassStatus;
  readonly teacherId: string;
}

export interface ClassRosterActorContext {
  readonly accountId: string;
  readonly activeOrganizationId: string;
  readonly membershipStatus: "active" | "invited" | "removed" | "suspended";
  readonly role: ClassRosterActorRole;
}

export type ClassRosterAccessDecision = Readonly<
  | { allowed: true; reason: "ALLOWED" }
  | {
      allowed: false;
      reason:
        | "CLASS_OUTSIDE_ACTIVE_ORGANIZATION"
        | "MEMBERSHIP_INACTIVE"
        | "ROLE_NOT_ALLOWED"
        | "TEACHER_CLASS_INACTIVE"
        | "TEACHER_NOT_ASSIGNED";
    }
>;

export interface ClassRosterStudentProjection {
  readonly classId: string;
  readonly englishName: string | null;
  readonly grade: string | null;
  readonly joinedAt: string;
  readonly leftAt: string | null;
  readonly membershipId: string;
  readonly membershipStatus: "active";
  readonly name: string | null;
  readonly organizationId: string;
  readonly studentId: string | null;
  readonly studentNo: string | null;
  readonly studentStatus: "active" | "archived" | null;
}

export interface ClassRosterSource {
  loadCanonical(): Promise<readonly ClassRosterStudentProjection[]>;
  loadLegacy(): Promise<readonly ClassRosterStudentProjection[]>;
}

export interface ClassRosterAuthorityEvent {
  readonly actorRole: ClassRosterActorRole;
  readonly canonicalCount: number | null;
  readonly classId: string;
  readonly correlationId: string;
  readonly fallbackReason: "canonical_read_failure" | null;
  readonly fallbackUsed: boolean;
  readonly legacyCount: number | null;
  readonly mode: LearnerCutoverControlMode;
  readonly organizationId: string;
  readonly returnedAuthority: "CANONICAL" | "LEGACY";
  readonly shadowErrorCount: number;
  readonly version: typeof CLASS_ROSTER_CUTOVER_VERSION;
}

export interface ClassRosterAuthorityObserver {
  record(event: ClassRosterAuthorityEvent): void;
}

export interface ClassRosterReadResult {
  readonly authority: "CANONICAL" | "LEGACY";
  readonly canonicalCount: number | null;
  readonly entries: readonly ClassRosterStudentProjection[];
  readonly fallbackUsed: boolean;
  readonly legacyCount: number | null;
  readonly mode: LearnerCutoverControlMode;
  readonly shadowErrorCount: number;
  readonly version: typeof CLASS_ROSTER_CUTOVER_VERSION;
}

export interface ClassRosterParityMetrics {
  readonly canonicalCount: number;
  readonly expectedCanonicalOnlyManagedLearnerCount: number;
  readonly identityConflictCount: number;
  readonly legacyCount: number;
  readonly legacyOnlyCount: number;
  readonly matchCount: number;
  readonly shadowErrorCount: number;
  readonly statusMismatchCount: number;
  readonly tenantMismatchCount: number;
  readonly unexpectedCanonicalOnlyCount: number;
  readonly version: typeof CLASS_ROSTER_CUTOVER_VERSION;
}
