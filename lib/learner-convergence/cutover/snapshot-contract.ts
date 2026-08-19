import type { LearnerCutoverConsumer } from "@/lib/learner-convergence/cutover/domain";

declare const trustedSnapshotScopeBrand: unique symbol;

export interface TrustedLearnerSnapshotScope {
  readonly actorAccountId: string;
  readonly consumer: LearnerCutoverConsumer;
  readonly organizationId: string;
  readonly [trustedSnapshotScopeBrand]: true;
}

export interface TeacherLearnerProjection {
  readonly classId: string;
  readonly enrollmentId: string;
  readonly enrollmentStatus: "active" | "left";
  readonly organizationId: string;
  readonly studentId: string;
  readonly studentStatus: "active" | "archived";
}

export interface StudentSelfLearnerProjection {
  readonly accountLinkId: string;
  readonly accountLinkStatus: "active";
  readonly assignmentRecipientIds: readonly string[];
  readonly organizationId: string;
  readonly studentId: string;
  readonly studentStatus: "active" | "archived";
}

export interface GuardianLearnerProjection {
  readonly childStudentId: string;
  readonly consentStatus: "granted";
  readonly organizationId: string;
  readonly relationshipId: string;
  readonly relationshipStatus: "active";
  readonly verificationStatus: "verified";
}

export interface OwnerAdminLearnerProjection {
  readonly accountLinkReferences: readonly {
    readonly linkId: string;
    readonly status: "active" | "expired" | "pending" | "revoked";
    readonly studentId: string;
  }[];
  readonly enrollmentReferences: readonly {
    readonly classId: string;
    readonly enrollmentId: string;
    readonly status: "active" | "left";
    readonly studentId: string;
  }[];
  readonly organizationId: string;
}

export interface LearnerCutoverSnapshotProvider {
  loadGuardianProjection(
    scope: TrustedLearnerSnapshotScope,
  ): Promise<readonly GuardianLearnerProjection[]>;
  loadOwnerAdminProjection(
    scope: TrustedLearnerSnapshotScope,
  ): Promise<OwnerAdminLearnerProjection>;
  loadStudentSelfProjection(
    scope: TrustedLearnerSnapshotScope,
  ): Promise<StudentSelfLearnerProjection | null>;
  loadTeacherProjection(
    scope: TrustedLearnerSnapshotScope,
  ): Promise<readonly TeacherLearnerProjection[]>;
}
