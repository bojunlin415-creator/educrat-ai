import type {
  CanonicalEnrollmentRecord,
  LearnerDiscrepancy,
  LearnerDiscrepancyCode,
  LearnerDiscrepancySeverity,
  LearnerParityReport,
  LearnerParitySnapshot,
  LearnerParitySummary,
  StudentAccountLinkRecord,
} from "@/lib/learner-convergence/domain/model";
import { LEARNER_CONVERGENCE_VERSION } from "@/lib/learner-convergence/domain/model";
import { mapLegacyEnrollmentStatus } from "@/lib/learner-convergence/domain/status-compatibility";
import { learnerParitySnapshotSchema } from "@/lib/learner-convergence/application/validation";

type DiscrepancySubjectType = LearnerDiscrepancy["subjectType"];

const severityByCode: Readonly<
  Record<LearnerDiscrepancyCode, LearnerDiscrepancySeverity>
> = Object.freeze({
  ambiguous_account_student_match: "critical",
  canonical_enrollment_without_legacy: "warning",
  canonical_student_without_account_link: "warning",
  cross_tenant_identity_mismatch: "critical",
  enrollment_status_mismatch: "warning",
  legacy_enrollment_without_canonical: "warning",
  managed_student_without_account: "informational",
  orphan_assignment_recipient: "critical",
  orphan_guardian_relationship: "critical",
  orphan_learning_event: "critical",
  orphan_mastery_record: "critical",
  orphan_submission_owner: "critical",
  parent_portal_legacy_identity_dependency: "warning",
  profile_without_canonical_student: "warning",
});

function isEffectiveActiveLink(
  link: StudentAccountLinkRecord,
  asOfMs: number,
): boolean {
  return (
    link.status === "active" &&
    Date.parse(link.validFrom) <= asOfMs &&
    (link.validTo === null || Date.parse(link.validTo) > asOfMs)
  );
}

function freezeDiscrepancy(
  discrepancy: LearnerDiscrepancy,
): LearnerDiscrepancy {
  return Object.freeze({
    ...discrepancy,
    relatedIds: Object.freeze([...discrepancy.relatedIds].sort()),
  });
}

function candidateStudentsByAccount(
  snapshot: LearnerParitySnapshot,
): ReadonlyMap<string, ReadonlySet<string>> {
  const canonicalByClass = new Map<string, Set<string>>();
  for (const membership of snapshot.canonicalEnrollments) {
    if (membership.organizationId !== snapshot.organizationId) continue;
    const students = canonicalByClass.get(membership.classId) ?? new Set();
    students.add(membership.studentId);
    canonicalByClass.set(membership.classId, students);
  }

  const classesByAccount = new Map<string, Set<string>>();
  for (const enrollment of snapshot.legacyEnrollments) {
    if (enrollment.organizationId !== snapshot.organizationId) continue;
    const classes = classesByAccount.get(enrollment.accountId) ?? new Set();
    classes.add(enrollment.classId);
    classesByAccount.set(enrollment.accountId, classes);
  }

  const candidates = new Map<string, ReadonlySet<string>>();
  for (const [accountId, classIds] of classesByAccount) {
    let intersection: Set<string> | null = null;
    for (const classId of classIds) {
      const classCandidates = canonicalByClass.get(classId) ?? new Set();
      if (intersection === null) {
        intersection = new Set(classCandidates);
      } else {
        const previousCandidates: ReadonlySet<string> = intersection;
        intersection = new Set(
          [...previousCandidates].filter((studentId: string) =>
            classCandidates.has(studentId),
          ),
        );
      }
    }
    candidates.set(accountId, intersection ?? new Set());
  }
  return candidates;
}

export function analyzeLearnerEnrollmentParity(
  input: unknown,
): LearnerParityReport {
  const snapshot = learnerParitySnapshotSchema.parse(input);
  const asOfMs = Date.parse(snapshot.asOf);
  const organizationId = snapshot.organizationId;
  const discrepancies: LearnerDiscrepancy[] = [];
  const discrepancyKeys = new Set<string>();

  function add(
    code: LearnerDiscrepancyCode,
    subjectType: DiscrepancySubjectType,
    subjectId: string,
    relatedIds: readonly string[] = [],
  ): void {
    const normalizedRelatedIds = [...new Set(relatedIds)].sort();
    const key = `${code}:${subjectType}:${subjectId}:${normalizedRelatedIds.join(",")}`;
    if (discrepancyKeys.has(key)) return;
    discrepancyKeys.add(key);
    discrepancies.push(
      freezeDiscrepancy({
        code,
        organizationId,
        relatedIds: normalizedRelatedIds,
        severity: severityByCode[code],
        subjectId,
        subjectType,
      }),
    );
  }

  const scopedCanonicalStudents = snapshot.canonicalStudents.filter(
    (student) => student.organizationId === organizationId,
  );
  const canonicalStudentById = new Map(
    scopedCanonicalStudents.map((student) => [student.studentId, student]),
  );
  const scopedLinks = snapshot.accountLinks.filter(
    (link) => link.organizationId === organizationId,
  );
  const activeLinks = scopedLinks.filter((link) =>
    isEffectiveActiveLink(link, asOfMs),
  );
  const activeLinksByAccount = new Map<string, StudentAccountLinkRecord[]>();
  const activeLinksByStudent = new Map<string, StudentAccountLinkRecord[]>();
  for (const link of activeLinks) {
    const byAccount = activeLinksByAccount.get(link.accountId) ?? [];
    byAccount.push(link);
    activeLinksByAccount.set(link.accountId, byAccount);
    const byStudent = activeLinksByStudent.get(link.studentId) ?? [];
    byStudent.push(link);
    activeLinksByStudent.set(link.studentId, byStudent);
    const referencedStudent = canonicalStudentById.get(link.studentId);
    if (!referencedStudent) {
      add("cross_tenant_identity_mismatch", "account", link.accountId, [
        link.linkId,
        link.studentId,
      ]);
    }
  }

  const crossTenantCollections: readonly ReadonlyArray<{
    readonly id: string;
    readonly organizationId: string;
    readonly subjectType: DiscrepancySubjectType;
  }>[] = [
    snapshot.eligibleProfileStudents.map((record) => ({
      id: record.accountId,
      organizationId: record.organizationId,
      subjectType: "account" as const,
    })),
    snapshot.canonicalStudents.map((record) => ({
      id: record.studentId,
      organizationId: record.organizationId,
      subjectType: "student" as const,
    })),
    snapshot.legacyEnrollments.map((record) => ({
      id: record.enrollmentId,
      organizationId: record.organizationId,
      subjectType: "legacy_enrollment" as const,
    })),
    snapshot.canonicalEnrollments.map((record) => ({
      id: record.membershipId,
      organizationId: record.organizationId,
      subjectType: "canonical_enrollment" as const,
    })),
    snapshot.assignmentRecipients.map((record) => ({
      id: `${record.assignmentId}:${record.accountId}`,
      organizationId: record.organizationId,
      subjectType: "assignment_recipient" as const,
    })),
    snapshot.submissions.map((record) => ({
      id: record.submissionId,
      organizationId: record.organizationId,
      subjectType: "submission" as const,
    })),
    snapshot.learningEvents.map((record) => ({
      id: record.eventId,
      organizationId: record.organizationId,
      subjectType: "learning_event" as const,
    })),
    snapshot.masteryRecords.map((record) => ({
      id: record.recordId,
      organizationId: record.organizationId,
      subjectType: "mastery_record" as const,
    })),
    snapshot.guardianRelationships.map((record) => ({
      id: record.relationshipId,
      organizationId: record.organizationId,
      subjectType: "guardian_relationship" as const,
    })),
  ];
  for (const collection of crossTenantCollections) {
    for (const record of collection) {
      if (record.organizationId !== organizationId) {
        add("cross_tenant_identity_mismatch", record.subjectType, record.id, [
          record.organizationId,
        ]);
      }
    }
  }

  for (const [accountId, links] of activeLinksByAccount) {
    if (links.length > 1) {
      add(
        "ambiguous_account_student_match",
        "account",
        accountId,
        links.map((link) => link.studentId),
      );
    }
  }
  for (const [studentId, links] of activeLinksByStudent) {
    if (links.length > 1) {
      add(
        "ambiguous_account_student_match",
        "student",
        studentId,
        links.map((link) => link.accountId),
      );
    }
  }

  const candidatesByAccount = candidateStudentsByAccount(snapshot);
  const candidateAccountsByStudent = new Map<string, Set<string>>();
  for (const [accountId, studentIds] of candidatesByAccount) {
    for (const studentId of studentIds) {
      const accounts = candidateAccountsByStudent.get(studentId) ?? new Set();
      accounts.add(accountId);
      candidateAccountsByStudent.set(studentId, accounts);
    }
    if (studentIds.size > 1) {
      add("ambiguous_account_student_match", "account", accountId, [
        ...studentIds,
      ]);
    }
  }

  const scopedEligibleProfiles = snapshot.eligibleProfileStudents.filter(
    (profile) =>
      profile.organizationId === organizationId && profile.status === "active",
  );
  for (const profile of scopedEligibleProfiles) {
    if ((activeLinksByAccount.get(profile.accountId)?.length ?? 0) !== 1) {
      add("profile_without_canonical_student", "account", profile.accountId, [
        ...(candidatesByAccount.get(profile.accountId) ?? []),
      ]);
    }
  }

  for (const student of scopedCanonicalStudents) {
    if ((activeLinksByStudent.get(student.studentId)?.length ?? 0) === 1) {
      continue;
    }
    const candidateAccounts =
      candidateAccountsByStudent.get(student.studentId) ?? new Set<string>();
    if (
      student.accountAccessMode === "managed_accountless" &&
      candidateAccounts.size === 0
    ) {
      add("managed_student_without_account", "student", student.studentId);
      continue;
    }
    add(
      "canonical_student_without_account_link",
      "student",
      student.studentId,
      [...candidateAccounts],
    );
    if (candidateAccounts.size > 1) {
      add("ambiguous_account_student_match", "student", student.studentId, [
        ...candidateAccounts,
      ]);
    }
  }

  const scopedCanonicalEnrollments = snapshot.canonicalEnrollments.filter(
    (enrollment) => enrollment.organizationId === organizationId,
  );
  const canonicalByPair = new Map<string, CanonicalEnrollmentRecord>();
  for (const enrollment of scopedCanonicalEnrollments) {
    canonicalByPair.set(
      `${enrollment.classId}:${enrollment.studentId}`,
      enrollment,
    );
  }
  const matchedCanonicalMemberships = new Set<string>();
  let equivalentEnrollmentPairs = 0;

  const scopedLegacyEnrollments = snapshot.legacyEnrollments.filter(
    (enrollment) => enrollment.organizationId === organizationId,
  );
  for (const enrollment of scopedLegacyEnrollments) {
    const links = activeLinksByAccount.get(enrollment.accountId) ?? [];
    const canonical =
      links.length === 1
        ? canonicalByPair.get(
            `${enrollment.classId}:${links[0]?.studentId ?? ""}`,
          )
        : undefined;
    if (!canonical) {
      add(
        "legacy_enrollment_without_canonical",
        "legacy_enrollment",
        enrollment.enrollmentId,
        [enrollment.accountId, enrollment.classId],
      );
      continue;
    }
    matchedCanonicalMemberships.add(canonical.membershipId);
    const compatibility = mapLegacyEnrollmentStatus(enrollment.status);
    if (
      !compatibility.compatible ||
      compatibility.canonicalStatus !== canonical.status
    ) {
      add(
        "enrollment_status_mismatch",
        "legacy_enrollment",
        enrollment.enrollmentId,
        [canonical.membershipId],
      );
      continue;
    }
    equivalentEnrollmentPairs += 1;
  }

  for (const enrollment of scopedCanonicalEnrollments) {
    if (!matchedCanonicalMemberships.has(enrollment.membershipId)) {
      add(
        "canonical_enrollment_without_legacy",
        "canonical_enrollment",
        enrollment.membershipId,
        [enrollment.studentId, enrollment.classId],
      );
    }
  }

  function accountHasOneCanonicalLink(accountId: string): boolean {
    return (activeLinksByAccount.get(accountId)?.length ?? 0) === 1;
  }

  for (const recipient of snapshot.assignmentRecipients) {
    if (
      recipient.organizationId === organizationId &&
      !accountHasOneCanonicalLink(recipient.accountId)
    ) {
      add(
        "orphan_assignment_recipient",
        "assignment_recipient",
        `${recipient.assignmentId}:${recipient.accountId}`,
        [recipient.assignmentId, recipient.accountId],
      );
    }
  }
  const assignmentRecipientKeys = new Set(
    snapshot.assignmentRecipients
      .filter((recipient) => recipient.organizationId === organizationId)
      .map((recipient) => `${recipient.assignmentId}:${recipient.accountId}`),
  );
  for (const submission of snapshot.submissions) {
    if (
      submission.organizationId === organizationId &&
      (!accountHasOneCanonicalLink(submission.accountId) ||
        !assignmentRecipientKeys.has(
          `${submission.assignmentId}:${submission.accountId}`,
        ))
    ) {
      add("orphan_submission_owner", "submission", submission.submissionId, [
        submission.assignmentId,
        submission.accountId,
      ]);
    }
  }
  for (const event of snapshot.learningEvents) {
    if (
      event.organizationId === organizationId &&
      !accountHasOneCanonicalLink(event.accountId)
    ) {
      add("orphan_learning_event", "learning_event", event.eventId, [
        event.accountId,
      ]);
    }
  }
  for (const record of snapshot.masteryRecords) {
    if (
      record.organizationId === organizationId &&
      !accountHasOneCanonicalLink(record.accountId)
    ) {
      add("orphan_mastery_record", "mastery_record", record.recordId, [
        record.accountId,
      ]);
    }
  }
  for (const relationship of snapshot.guardianRelationships) {
    if (relationship.organizationId !== organizationId) continue;
    add(
      "parent_portal_legacy_identity_dependency",
      "guardian_relationship",
      relationship.relationshipId,
      [relationship.legacyStudentAccountId],
    );
    if (!accountHasOneCanonicalLink(relationship.legacyStudentAccountId)) {
      add(
        "orphan_guardian_relationship",
        "guardian_relationship",
        relationship.relationshipId,
        [relationship.legacyStudentAccountId],
      );
    }
  }

  discrepancies.sort((left, right) =>
    `${left.code}:${left.subjectType}:${left.subjectId}`.localeCompare(
      `${right.code}:${right.subjectType}:${right.subjectId}`,
    ),
  );

  const enrollmentUnionCount =
    scopedLegacyEnrollments.length +
    scopedCanonicalEnrollments.length -
    equivalentEnrollmentPairs;
  const countCode = (code: LearnerDiscrepancyCode) =>
    discrepancies.filter((item) => item.code === code).length;
  const summary: LearnerParitySummary = Object.freeze({
    ambiguous_links: countCode("ambiguous_account_student_match"),
    canonical_active_enrollments: scopedCanonicalEnrollments.filter(
      (enrollment) => enrollment.status === "active",
    ).length,
    canonical_only_enrollments: countCode(
      "canonical_enrollment_without_legacy",
    ),
    canonical_students: scopedCanonicalStudents.length,
    cross_tenant_mismatch_count: countCode("cross_tenant_identity_mismatch"),
    eligible_profile_students: scopedEligibleProfiles.length,
    enrollment_parity_rate:
      enrollmentUnionCount === 0
        ? 1
        : Number((equivalentEnrollmentPairs / enrollmentUnionCount).toFixed(4)),
    legacy_active_enrollments: scopedLegacyEnrollments.filter(
      (enrollment) => enrollment.status === "active",
    ).length,
    legacy_only_enrollments: countCode("legacy_enrollment_without_canonical"),
    linked_profile_students: new Set(
      activeLinks
        .filter((link) =>
          scopedEligibleProfiles.some(
            (profile) => profile.accountId === link.accountId,
          ),
        )
        .map((link) => link.accountId),
    ).size,
    managed_students_without_account: countCode(
      "managed_student_without_account",
    ),
    orphan_assignment_count: countCode("orphan_assignment_recipient"),
    orphan_guardian_count: countCode("orphan_guardian_relationship"),
    orphan_learning_event_count: countCode("orphan_learning_event"),
    orphan_submission_count: countCode("orphan_submission_owner"),
    status_mismatch_count: countCode("enrollment_status_mismatch"),
  });

  return Object.freeze({
    discrepancies: Object.freeze(discrepancies),
    organizationId,
    summary,
    version: LEARNER_CONVERGENCE_VERSION,
  });
}
