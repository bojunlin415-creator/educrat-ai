import { z } from "zod";
import { LEARNER_CONVERGENCE_VERSION } from "@/lib/learner-convergence/domain/model";

const uuid = z.string().uuid();
const organizationScoped = { organizationId: uuid } as const;

const eligibleProfileStudentSchema = z
  .object({
    ...organizationScoped,
    accountId: uuid,
    status: z.enum(["active", "invited", "suspended", "removed"]),
  })
  .strict();

const canonicalStudentSchema = z
  .object({
    ...organizationScoped,
    accountAccessMode: z
      .enum(["link_expected", "managed_accountless", "unspecified"])
      .default("unspecified"),
    status: z.enum(["active", "archived"]),
    studentId: uuid,
  })
  .strict();

const accountLinkSchema = z
  .object({
    ...organizationScoped,
    accountId: uuid,
    linkId: uuid,
    status: z.enum(["pending", "active", "revoked", "expired"]),
    studentId: uuid,
    validFrom: z.string().datetime({ offset: true }),
    validTo: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

const legacyEnrollmentSchema = z
  .object({
    ...organizationScoped,
    accountId: uuid,
    classId: uuid,
    enrollmentId: uuid,
    status: z.enum(["active", "inactive", "left"]),
  })
  .strict();

const canonicalEnrollmentSchema = z
  .object({
    ...organizationScoped,
    classId: uuid,
    membershipId: uuid,
    status: z.enum(["active", "left"]),
    studentId: uuid,
  })
  .strict();

const assignmentRecipientSchema = z
  .object({
    ...organizationScoped,
    accountId: uuid,
    assignmentId: uuid,
  })
  .strict();

const submissionOwnerSchema = z
  .object({
    ...organizationScoped,
    accountId: uuid,
    assignmentId: uuid,
    submissionId: uuid,
  })
  .strict();

const learningEventSchema = z
  .object({
    ...organizationScoped,
    accountId: uuid,
    eventId: uuid,
  })
  .strict();

const masteryRecordSchema = z
  .object({
    ...organizationScoped,
    accountId: uuid,
    recordId: uuid,
    recordType: z.enum(["knowledge_mastery", "subject_summary"]),
  })
  .strict();

const guardianRelationshipSchema = z
  .object({
    ...organizationScoped,
    legacyStudentAccountId: uuid,
    relationshipId: uuid,
    status: z.string().trim().min(1).max(48),
  })
  .strict();

export const learnerParitySnapshotSchema = z
  .object({
    accountLinks: z.array(accountLinkSchema).max(100_000),
    assignmentRecipients: z.array(assignmentRecipientSchema).max(100_000),
    asOf: z.string().datetime({ offset: true }),
    canonicalEnrollments: z.array(canonicalEnrollmentSchema).max(100_000),
    canonicalStudents: z.array(canonicalStudentSchema).max(100_000),
    eligibleProfileStudents: z.array(eligibleProfileStudentSchema).max(100_000),
    guardianRelationships: z.array(guardianRelationshipSchema).max(100_000),
    learningEvents: z.array(learningEventSchema).max(100_000),
    legacyEnrollments: z.array(legacyEnrollmentSchema).max(100_000),
    masteryRecords: z.array(masteryRecordSchema).max(100_000),
    organizationId: uuid,
    submissions: z.array(submissionOwnerSchema).max(100_000),
    version: z.literal(LEARNER_CONVERGENCE_VERSION),
  })
  .strict();

export const canonicalStudentResolutionSchema = z.discriminatedUnion(
  "outcome",
  [
    z
      .object({
        linkId: uuid,
        organizationId: uuid,
        outcome: z.literal("linked"),
        studentId: uuid,
      })
      .strict(),
    z
      .object({
        outcome: z.enum([
          "no_link",
          "ambiguous_link",
          "revoked_link",
          "expired_link",
          "wrong_organization",
          "inactive_context",
        ]),
      })
      .strict(),
  ],
);
