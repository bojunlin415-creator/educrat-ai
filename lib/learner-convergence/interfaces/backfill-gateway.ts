import type {
  AccountLinkBackfillResult,
  ActiveLearnerLink,
} from "@/lib/learner-convergence/domain/phase-3";
import type { CanonicalEnrollmentStatus } from "@/lib/learner-convergence/domain/model";

export interface CreatedLearnerAccountLink {
  readonly accountId: string;
  readonly auditAction: "STUDENT_ACCOUNT_LINK_CREATED";
  readonly auditCorrelationId: string;
  readonly correlationId: string;
  readonly linkId: string;
  readonly linkType: "migration_verified";
  readonly organizationId: string;
  readonly studentId: string;
}

export interface LearnerAccountLinkBackfillGateway {
  createMigrationVerifiedLink(input: {
    readonly accountId: string;
    readonly correlationId: string;
    readonly organizationId: string;
    readonly studentId: string;
  }): Promise<CreatedLearnerAccountLink>;
  loadActiveLinks(input: {
    readonly accountId: string;
    readonly organizationId: string;
    readonly studentId: string;
  }): Promise<readonly ActiveLearnerLink[]>;
}

export interface CanonicalEnrollmentBackfillGateway {
  createCanonicalEnrollment(input: {
    readonly accountId: string;
    readonly classId: string;
    readonly correlationId: string;
    readonly joinedAt: string;
    readonly legacyEnrollmentId: string;
    readonly organizationId: string;
    readonly status: CanonicalEnrollmentStatus;
    readonly studentId: string;
  }): Promise<{
    readonly canonicalMembershipId: string;
    readonly correlationId: string;
  }>;
  loadCanonicalEnrollments(input: {
    readonly classId: string;
    readonly organizationId: string;
    readonly studentId: string;
  }): Promise<
    readonly {
      readonly membershipId: string;
      readonly organizationId: string;
      readonly status: CanonicalEnrollmentStatus;
      readonly studentId: string;
    }[]
  >;
}

export type LearnerBackfillExecutionSummary = Readonly<{
  results: readonly AccountLinkBackfillResult[];
}>;
