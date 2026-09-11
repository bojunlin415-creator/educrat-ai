import "server-only";

import { randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getCurrentUser } from "@/lib/auth/session";
import {
  prepareAssignmentClassExpansion,
  type AssignmentClassExpansionPlan,
} from "@/lib/assignment/class-expansion";
import { AssignmentError } from "@/lib/assignment/errors";
import type { AssignmentClassExpansionActorRole } from "@/lib/learner-convergence/assignment-class-expansion/domain";
import {
  readAssignmentRecipientsByAuthority,
  resolveAssignmentRecipientAuthorityMode,
  resolveAssignmentRecipientWriteAuthority,
} from "@/lib/learner-convergence/assignment-recipient/authority";
import {
  AssignmentRecipientSourceError,
  type AssignmentRecipientAuthorityEvent,
  type AssignmentRecipientAuthorityObserver,
  type AssignmentRecipientProjection,
  type AssignmentRecipientSource,
} from "@/lib/learner-convergence/assignment-recipient/domain";
import {
  readSubmissionSelfRecipients,
  requireCanonicalSubmissionIdentity,
  resolveSubmissionSelfAuthorityMode,
  resolveSubmissionSelfWriteAuthority,
} from "@/lib/learner-convergence/submission-self-resolution/authority";
import {
  SubmissionSelfResolutionError,
  SubmissionSelfSourceError,
  type SubmissionSelfAuthorityEvent,
  type SubmissionSelfAuthorityObserver,
  type SubmissionSelfRecipientSource,
} from "@/lib/learner-convergence/submission-self-resolution/domain";
import type { LearnerCutoverControlMode } from "@/lib/learner-convergence/cutover/domain";
import { getLearnerCutoverControl } from "@/lib/learner-convergence/cutover/feature-controls";
import { resolveCanonicalStudentForAuthenticatedAccount } from "@/lib/learner-convergence/server";
import { createClient } from "@/lib/supabase/server";
import {
  requireOrganizationMembership,
  requireOrganizationRole,
} from "@/lib/organization/service";
import { OrganizationError } from "@/lib/organization/errors";
import {
  assignStudentsSchema,
  assignmentRecipientProjectionListSchema,
  assignmentSubmissionResultSchema,
  assignmentIdSchema,
  createAssignmentSchema,
  saveSubmissionSchema,
  updateAssignmentSchema,
  type AssignStudentsInput,
  type AssignmentSubmissionResult,
  type CreateAssignmentInput,
  type SaveSubmissionInput,
  type UpdateAssignmentInput,
} from "@/lib/validation/assignment";

type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];
type AssignmentStudentRow =
  Database["public"]["Tables"]["assignment_students"]["Row"];
type AssignmentClassRow =
  Database["public"]["Tables"]["assignment_classes"]["Row"];
type CurriculumVersionRow =
  Database["public"]["Tables"]["curriculum_versions"]["Row"];

export interface AssignmentDetail extends AssignmentRow {
  readonly classes: readonly AssignmentClassRow[];
  readonly recipients: readonly AssignmentRecipientProjection[];
}

export class ConsoleAssignmentRecipientAuthorityObserver implements AssignmentRecipientAuthorityObserver {
  record(event: AssignmentRecipientAuthorityEvent): void {
    console.info(
      "[assignment-recipient-authority]",
      JSON.stringify({
        assignment: event.assignmentId,
        canonicalOnlyCount: event.canonicalOnlyCount,
        canonicalRecipientCount: event.canonicalRecipientCount,
        compatibilityMappedCount: event.compatibilityMappedCount,
        correlation: event.correlationId,
        fallbackUsed: event.fallbackUsed,
        identityUnresolvedCount: event.identityUnresolvedCount,
        legacyHistoricalCount: event.legacyHistoricalCount,
        mode: event.mode,
        organization: event.organizationId,
        recipientCount: event.recipientCount,
        returnedAuthority: event.returnedAuthority,
        shadowErrorCount: event.shadowErrorCount,
        version: event.version,
        writeFallbackCount: event.writeFallbackCount,
      }),
    );
  }
}

export class ConsoleSubmissionSelfAuthorityObserver implements SubmissionSelfAuthorityObserver {
  record(event: SubmissionSelfAuthorityEvent): void {
    console.info(
      "[submission-self-resolution]",
      JSON.stringify({
        action: event.action,
        assignment: event.assignmentId,
        canonicalOnlyCount: event.canonicalOnlyCount,
        canonicalSelfResolutionSuccess: event.canonicalSelfResolutionSuccess,
        correlation: event.correlationId,
        fallbackCount: event.fallbackCount,
        legacyOnlyCount: event.legacyOnlyCount,
        legacySelfResolutionSuccess: event.legacySelfResolutionSuccess,
        linkState: event.linkState,
        matchedIdentityCount: event.matchedIdentityCount,
        mode: event.mode,
        organization: event.organizationId,
        recipientFound: event.recipientFound,
        recipientMismatch: event.recipientMismatch,
        returnedAuthority: event.returnedAuthority,
        shadowErrorCount: event.shadowErrorCount,
        tenantMismatch: event.tenantMismatch,
        unexpectedIdentityConflict: event.unexpectedIdentityConflict,
        version: event.version,
        writeFallbackCount: event.writeFallbackCount,
      }),
    );
  }
}

function mapDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return new AssignmentError("service_unavailable");
  const options = { cause: error };
  if (error.message?.includes("assignment_invalid_curriculum_version")) {
    return new AssignmentError("invalid_curriculum_version", options);
  }
  if (error.message?.includes("assignment_due_before_publish")) {
    return new AssignmentError("invalid_input", options);
  }
  if (error.message?.includes("assignment_state_locked")) {
    return new AssignmentError("invalid_assignment_state", options);
  }
  if (error.message?.includes("submission_locked")) {
    return new AssignmentError("submission_locked", options);
  }
  if (error.message?.includes("student_account_link_missing")) {
    return new AssignmentError("student_account_link_missing", options);
  }
  if (error.message?.includes("student_account_link_inactive")) {
    return new AssignmentError("student_account_link_inactive", options);
  }
  if (error.message?.includes("student_account_link_expired")) {
    return new AssignmentError("student_account_link_expired", options);
  }
  if (error.message?.includes("student_identity_conflict")) {
    return new AssignmentError("student_identity_conflict", options);
  }
  if (error.message?.includes("assignment_recipient_not_found")) {
    return new AssignmentError("assignment_recipient_not_found", options);
  }
  if (error.message?.includes("submission_not_allowed")) {
    return new AssignmentError("submission_not_allowed", options);
  }
  if (error.message?.includes("submission_identity_unavailable")) {
    return new AssignmentError("submission_identity_unavailable", options);
  }
  if (error.message?.includes("cross_tenant_forbidden")) {
    return new AssignmentError("cross_tenant_forbidden", options);
  }
  if (error.message?.includes("submission_invalid_input")) {
    return new AssignmentError("invalid_input", options);
  }
  if (error.message?.includes("submission_self_forbidden")) {
    return new AssignmentError("forbidden", options);
  }
  if (error.message?.includes("assignment_invalid_class")) {
    return new AssignmentError("invalid_input", options);
  }
  if (error.message?.includes("assignment_recipient_snapshot_changed")) {
    return new AssignmentError("recipient_snapshot_changed", options);
  }
  if (error.message?.includes("recipient_not_found")) {
    return new AssignmentError("recipient_not_found", options);
  }
  if (error.message?.includes("assignment_recipient_forbidden")) {
    return new AssignmentError("forbidden", options);
  }
  if (
    error.message?.includes("assignment_recipient_invalid_input") ||
    error.message?.includes("assignment_recipient_conflict")
  ) {
    return new AssignmentError("recipient_conflict", options);
  }
  if (error.code === "23505") {
    return new AssignmentError("duplicate_assignment_student", options);
  }
  if (error.code === "22023") {
    return new AssignmentError("invalid_input", options);
  }
  if (error.code === "P0002") {
    return new AssignmentError("not_found", options);
  }
  if (error.code === "42501") {
    if (error.message?.includes("authentication_required")) {
      return new AssignmentError("not_authenticated", options);
    }
    if (error.message?.includes("active_organization_required")) {
      return new AssignmentError("organization_required", options);
    }
    return new AssignmentError("forbidden", options);
  }
  return new AssignmentError("service_unavailable", options);
}

function mapSubmissionSelfResolutionError(
  error: SubmissionSelfResolutionError,
): AssignmentError {
  return new AssignmentError(error.code, { cause: error });
}

function mapSubmissionSelfSourceError(error: {
  readonly code?: string;
  readonly message?: string;
}): SubmissionSelfSourceError {
  if (error.message?.includes("student_identity_conflict")) {
    return new SubmissionSelfSourceError("IDENTITY", { cause: error });
  }
  if (error.code === "42501") {
    return new SubmissionSelfSourceError("SECURITY", { cause: error });
  }
  if (
    error.code === "22023" ||
    error.code === "23503" ||
    error.code === "23505" ||
    error.code === "P0002"
  ) {
    return new SubmissionSelfSourceError("INTEGRITY", { cause: error });
  }
  return new SubmissionSelfSourceError("RUNTIME", { cause: error });
}

function mapRecipientSourceError(error: {
  readonly code?: string;
  readonly message?: string;
}): AssignmentRecipientSourceError {
  if (error.code === "42501") {
    return new AssignmentRecipientSourceError("SECURITY", { cause: error });
  }
  if (
    error.code === "22023" ||
    error.code === "23503" ||
    error.code === "23505" ||
    error.code === "40001" ||
    error.code === "P0002"
  ) {
    return new AssignmentRecipientSourceError("INTEGRITY", { cause: error });
  }
  return new AssignmentRecipientSourceError("RUNTIME", { cause: error });
}

function mapOrganizationError(error: OrganizationError): AssignmentError {
  switch (error.code) {
    case "not_authenticated":
      return new AssignmentError("not_authenticated");
    case "organization_not_found":
    case "not_member":
      return new AssignmentError("organization_required");
    case "forbidden":
      return new AssignmentError("forbidden");
    default:
      return new AssignmentError("service_unavailable");
  }
}

async function requireAssignmentActor(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AssignmentError("not_authenticated");
  return user;
}

async function requireAssignmentMembership(organizationId?: string) {
  try {
    return await requireOrganizationMembership(organizationId);
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

async function requireTeacherManager() {
  try {
    return await requireOrganizationRole([
      "organization_owner",
      "organization_admin",
      "teacher",
    ]);
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

function canManageAll(role: string): boolean {
  return role === "organization_owner" || role === "organization_admin";
}

function isStudent(role: string): boolean {
  return role === "student";
}

function assignmentClassExpansionRole(
  role: string,
): AssignmentClassExpansionActorRole {
  if (
    role === "organization_owner" ||
    role === "organization_admin" ||
    role === "teacher"
  ) {
    return role;
  }
  throw new AssignmentError("forbidden");
}

async function requirePublishedVersion(input: {
  readonly curriculumId: string;
  readonly curriculumVersionId: string;
  readonly organizationId: string;
}): Promise<CurriculumVersionRow> {
  const supabase = await createClient();
  const { data: curriculum, error: curriculumError } = await supabase
    .from("curriculums")
    .select("*")
    .eq("id", input.curriculumId)
    .eq("organization_id", input.organizationId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (curriculumError) throw mapDatabaseError(curriculumError);
  if (!curriculum) throw new AssignmentError("invalid_curriculum_version");

  const { data: version, error: versionError } = await supabase
    .from("curriculum_versions")
    .select("*")
    .eq("id", input.curriculumVersionId)
    .eq("curriculum_id", input.curriculumId)
    .eq("status", "published")
    .maybeSingle();

  if (versionError) throw mapDatabaseError(versionError);
  if (!version) throw new AssignmentError("invalid_curriculum_version");
  return version;
}

async function writeAssignmentAudit(input: {
  readonly action:
    | "ASSIGNMENT_ASSIGNED"
    | "ASSIGNMENT_CREATED"
    | "ASSIGNMENT_SUBMITTED"
    | "ASSIGNMENT_UPDATED";
  readonly assignmentId: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly metadata?: Json;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("assignment_audit_events").insert({
    action: input.action,
    actor_id: input.userId,
    assignment_id: input.assignmentId,
    metadata: input.metadata ?? {},
    organization_id: input.organizationId,
  });
  if (error) throw mapDatabaseError(error);
}

async function persistAssignmentClasses(
  assignmentId: string,
  plan: AssignmentClassExpansionPlan,
): Promise<readonly AssignmentClassRow[]> {
  const supabase = await createClient();
  const rows = plan.classIds.map((classId) => ({
    assignment_id: assignmentId,
    class_id: classId,
    organization_id: plan.organizationId,
  }));
  const { data, error } = await supabase
    .from("assignment_classes")
    .upsert(rows, { onConflict: "assignment_id,class_id" })
    .select("*");
  if (error) throw mapDatabaseError(error);
  return data;
}

async function persistAssignmentStudents(input: {
  readonly assignmentId: string;
  readonly organizationId: string;
  readonly studentIds: readonly string[];
}): Promise<readonly AssignmentStudentRow[]> {
  if (input.studentIds.length === 0) return Object.freeze([]);
  const supabase = await createClient();
  const rows = input.studentIds.map((studentId) => ({
    assignment_id: input.assignmentId,
    organization_id: input.organizationId,
    student_id: studentId,
  }));
  const { data, error } = await supabase
    .from("assignment_students")
    .upsert(rows, { onConflict: "assignment_id,student_id" })
    .select("*");
  if (error) throw mapDatabaseError(error);
  return data;
}

function assignmentRecipientAuthorityMode(): LearnerCutoverControlMode {
  const control = getLearnerCutoverControl(
    "learner_assignment_recipient_canonical_reference",
  );
  return resolveAssignmentRecipientAuthorityMode({
    configuredMode: process.env.LEARNER_ASSIGNMENT_RECIPIENT_AUTHORITY_MODE,
    selectedMode: control.selectedMode,
  });
}

function legacyRecipientProjection(
  row: AssignmentStudentRow,
): AssignmentRecipientProjection {
  return Object.freeze({
    assigned_at: row.assigned_at,
    assignment_id: row.assignment_id,
    canonical_student_id: null,
    identity_authority: "LEGACY_ONLY_HISTORICAL",
    recipient_id: null,
    recipient_status: row.status,
    source_class_ids: Object.freeze([]),
  });
}

function createAssignmentRecipientSource(input: {
  readonly assignmentId: string;
  readonly organizationId: string;
}): AssignmentRecipientSource {
  return Object.freeze({
    async loadCanonical() {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc(
        "get_assignment_recipient_projection",
        { p_assignment_id: input.assignmentId },
      );
      if (error) throw mapRecipientSourceError(error);
      const parsed = assignmentRecipientProjectionListSchema.safeParse(data);
      if (!parsed.success) {
        throw new AssignmentRecipientSourceError("INTEGRITY", {
          cause: parsed.error,
        });
      }
      return Object.freeze(
        parsed.data.map((recipient) =>
          Object.freeze({
            ...recipient,
            source_class_ids: Object.freeze([...recipient.source_class_ids]),
          }),
        ),
      );
    },
    async loadLegacy() {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("assignment_students")
        .select("*")
        .eq("assignment_id", input.assignmentId)
        .eq("organization_id", input.organizationId)
        .order("assigned_at", { ascending: true });
      if (error) throw mapRecipientSourceError(error);
      return Object.freeze(data.map(legacyRecipientProjection));
    },
  });
}

async function loadAssignmentRecipients(input: {
  readonly assignmentId: string;
  readonly organizationId: string;
}): Promise<readonly AssignmentRecipientProjection[]> {
  const result = await readAssignmentRecipientsByAuthority({
    assignmentId: input.assignmentId,
    correlationId: randomUUID(),
    mode: assignmentRecipientAuthorityMode(),
    observer: new ConsoleAssignmentRecipientAuthorityObserver(),
    organizationId: input.organizationId,
    source: createAssignmentRecipientSource(input),
  });
  return result.recipients;
}

function submissionSelfAuthorityMode(): LearnerCutoverControlMode {
  const control = getLearnerCutoverControl("learner_submission_canonical_self");
  return resolveSubmissionSelfAuthorityMode({
    configuredMode: process.env.LEARNER_SUBMISSION_SELF_AUTHORITY_MODE,
    selectedMode: control.selectedMode,
  });
}

function createSubmissionSelfRecipientSource(input: {
  readonly accountId: string;
  readonly assignmentId?: string;
  readonly organizationId: string;
}): SubmissionSelfRecipientSource {
  return Object.freeze({
    async loadCanonical() {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc(
        "get_authenticated_student_assignment_recipients",
        { p_assignment_id: input.assignmentId ?? null },
      );
      if (error) throw mapSubmissionSelfSourceError(error);
      const parsed = assignmentRecipientProjectionListSchema.safeParse(data);
      if (!parsed.success) {
        throw new SubmissionSelfSourceError("INTEGRITY", {
          cause: parsed.error,
        });
      }
      return Object.freeze(
        parsed.data.map((recipient) =>
          Object.freeze({
            ...recipient,
            source_class_ids: Object.freeze([...recipient.source_class_ids]),
          }),
        ),
      );
    },
    async loadLegacy() {
      const supabase = await createClient();
      let query = supabase
        .from("assignment_students")
        .select("*")
        .eq("organization_id", input.organizationId)
        .eq("student_id", input.accountId);
      if (input.assignmentId) {
        query = query.eq("assignment_id", input.assignmentId);
      }
      const { data, error } = await query.order("assigned_at", {
        ascending: false,
      });
      if (error) throw mapSubmissionSelfSourceError(error);
      return Object.freeze(data.map(legacyRecipientProjection));
    },
  });
}

async function loadSubmissionSelfRecipients(input: {
  readonly accountId: string;
  readonly assignmentId?: string;
  readonly organizationId: string;
}): Promise<readonly AssignmentRecipientProjection[]> {
  const result = await readSubmissionSelfRecipients({
    action: "READ",
    assignmentId: input.assignmentId ?? null,
    correlationId: randomUUID(),
    mode: submissionSelfAuthorityMode(),
    observer: new ConsoleSubmissionSelfAuthorityObserver(),
    organizationId: input.organizationId,
    source: createSubmissionSelfRecipientSource(input),
  });
  return result.recipients;
}

function canonicalClassStudentIds(
  plan: AssignmentClassExpansionPlan | null,
): readonly string[] {
  if (!plan) return Object.freeze([]);
  if (plan.result.authority !== "CANONICAL") {
    throw new AssignmentError("recipient_persistence_unavailable");
  }
  return Object.freeze(
    plan.result.candidates.map((candidate) => {
      if (!candidate.canonicalStudentId) {
        throw new AssignmentError("recipient_conflict");
      }
      return candidate.canonicalStudentId;
    }),
  );
}

async function createCanonicalAssignment(input: {
  readonly classExpansion: AssignmentClassExpansionPlan | null;
  readonly directStudentIds: readonly string[];
  readonly parsed: CreateAssignmentInput;
  readonly writeLegacyCompatibility: boolean;
}): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "create_assignment_with_canonical_recipients",
    {
      p_class_ids: [...(input.classExpansion?.classIds ?? [])],
      p_curriculum_id: input.parsed.curriculumId,
      p_curriculum_version_id: input.parsed.curriculumVersionId,
      p_description: input.parsed.description ?? "",
      p_direct_student_ids: [...input.directStudentIds],
      p_due_at: input.parsed.dueAt,
      p_expected_class_student_ids: [
        ...canonicalClassStudentIds(input.classExpansion),
      ],
      p_publish_at: input.parsed.publishAt,
      p_title: input.parsed.title,
      p_write_legacy_compatibility: input.writeLegacyCompatibility,
    },
  );
  if (error) {
    const mapped = mapDatabaseError(error);
    if (mapped.code === "service_unavailable") {
      throw new AssignmentError("recipient_persistence_unavailable", {
        cause: error,
      });
    }
    throw mapped;
  }
  if (!data) throw new AssignmentError("recipient_persistence_unavailable");
  return data;
}

async function addCanonicalAssignmentRecipients(input: {
  readonly assignmentId: string;
  readonly classExpansion: AssignmentClassExpansionPlan | null;
  readonly directStudentIds: readonly string[];
  readonly writeLegacyCompatibility: boolean;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_assignment_canonical_recipients", {
    p_assignment_id: input.assignmentId,
    p_class_ids: [...(input.classExpansion?.classIds ?? [])],
    p_direct_student_ids: [...input.directStudentIds],
    p_expected_class_student_ids: [
      ...canonicalClassStudentIds(input.classExpansion),
    ],
    p_write_legacy_compatibility: input.writeLegacyCompatibility,
  });
  if (error) {
    const mapped = mapDatabaseError(error);
    if (mapped.code === "service_unavailable") {
      throw new AssignmentError("recipient_persistence_unavailable", {
        cause: error,
      });
    }
    throw mapped;
  }
}

export async function createAssignment(
  input: CreateAssignmentInput,
): Promise<AssignmentDetail> {
  const parsed = createAssignmentSchema.safeParse(input);
  if (!parsed.success) throw new AssignmentError("invalid_input");
  const context = await requireTeacherManager();
  const user = await requireAssignmentActor();
  await requirePublishedVersion({
    curriculumId: parsed.data.curriculumId,
    curriculumVersionId: parsed.data.curriculumVersionId,
    organizationId: context.organization.id,
  });
  const recipientMode = assignmentRecipientAuthorityMode();
  const writeAuthority =
    resolveAssignmentRecipientWriteAuthority(recipientMode);
  const classExpansion = parsed.data.classIds?.length
    ? await prepareAssignmentClassExpansion({
        actorId: user.id,
        actorRole: assignmentClassExpansionRole(context.membership.role),
        assignmentId: null,
        classIds: parsed.data.classIds,
        modeOverride: writeAuthority === "LEGACY" ? "LEGACY_ONLY" : undefined,
        organizationId: context.organization.id,
      })
    : null;

  if (writeAuthority !== "LEGACY") {
    const assignmentId = await createCanonicalAssignment({
      classExpansion,
      directStudentIds: parsed.data.studentIds ?? [],
      parsed: parsed.data,
      writeLegacyCompatibility:
        writeAuthority === "CANONICAL_WITH_VERIFIED_LEGACY_PROJECTION",
    });
    return getAssignment(assignmentId);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      assigned_by: user.id,
      curriculum_id: parsed.data.curriculumId,
      curriculum_version_id: parsed.data.curriculumVersionId,
      description: parsed.data.description || null,
      due_at: parsed.data.dueAt,
      organization_id: context.organization.id,
      publish_at: parsed.data.publishAt,
      status: "scheduled",
      title: parsed.data.title,
    })
    .select("*")
    .single();
  if (error) throw mapDatabaseError(error);

  if (classExpansion) await persistAssignmentClasses(data.id, classExpansion);
  const recipientIds = [
    ...(classExpansion?.result.legacyRecipientIds ?? []),
    ...(parsed.data.studentIds ?? []),
  ];
  const uniqueRecipientIds = [...new Set(recipientIds)];
  if (uniqueRecipientIds.length > 0) {
    await persistAssignmentStudents({
      assignmentId: data.id,
      organizationId: context.organization.id,
      studentIds: uniqueRecipientIds,
    });
    await writeAssignmentAudit({
      action: "ASSIGNMENT_ASSIGNED",
      assignmentId: data.id,
      metadata: { studentCount: uniqueRecipientIds.length },
      organizationId: context.organization.id,
      userId: user.id,
    });
  }
  await writeAssignmentAudit({
    action: "ASSIGNMENT_CREATED",
    assignmentId: data.id,
    metadata: {
      curriculumId: data.curriculum_id,
      curriculumVersionId: data.curriculum_version_id,
    },
    organizationId: data.organization_id,
    userId: user.id,
  });
  return getAssignment(data.id);
}

export async function updateAssignment(
  id: string,
  input: UpdateAssignmentInput,
): Promise<AssignmentDetail> {
  const parsedId = assignmentIdSchema.safeParse(id);
  const parsed = updateAssignmentSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    throw new AssignmentError("invalid_input");
  }
  const context = await requireTeacherManager();
  const user = await requireAssignmentActor();
  const current = await getAssignment(parsedId.data);
  if (
    !canManageAll(context.membership.role) &&
    current.assigned_by !== user.id
  ) {
    throw new AssignmentError("forbidden");
  }
  if (current.status === "cancelled" || current.status === "closed") {
    throw new AssignmentError("invalid_assignment_state");
  }
  const publishAt = parsed.data.publishAt ?? current.publish_at;
  const dueAt = parsed.data.dueAt ?? current.due_at;
  if (Date.parse(dueAt) < Date.parse(publishAt)) {
    throw new AssignmentError("invalid_input");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .update({
      description:
        parsed.data.description === undefined
          ? current.description
          : parsed.data.description || null,
      due_at: dueAt,
      publish_at: publishAt,
      status: parsed.data.status ?? current.status,
      title: parsed.data.title ?? current.title,
    })
    .eq("id", parsedId.data)
    .eq("organization_id", context.organization.id);
  if (error) throw mapDatabaseError(error);

  await writeAssignmentAudit({
    action: "ASSIGNMENT_UPDATED",
    assignmentId: parsedId.data,
    organizationId: context.organization.id,
    userId: user.id,
  });
  return getAssignment(parsedId.data);
}

export async function getAssignment(id: string): Promise<AssignmentDetail> {
  const parsedId = assignmentIdSchema.safeParse(id);
  if (!parsedId.success) throw new AssignmentError("not_found");
  const context = await requireAssignmentMembership();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", parsedId.data)
    .eq("organization_id", context.organization.id)
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new AssignmentError("not_found");
  const { data: classes, error: classesError } = await supabase
    .from("assignment_classes")
    .select("*")
    .eq("assignment_id", data.id)
    .eq("organization_id", context.organization.id)
    .order("assigned_at", { ascending: true });
  if (classesError) throw mapDatabaseError(classesError);
  if (isStudent(context.membership.role)) {
    const recipients = await loadSubmissionSelfRecipients({
      accountId: context.membership.user_id,
      assignmentId: data.id,
      organizationId: context.organization.id,
    });
    if (recipients.length === 0) throw new AssignmentError("not_found");
    return {
      ...data,
      classes,
      recipients,
    };
  }
  return {
    ...data,
    classes,
    recipients: await loadAssignmentRecipients({
      assignmentId: data.id,
      organizationId: context.organization.id,
    }),
  };
}

export async function listAssignments(): Promise<readonly AssignmentRow[]> {
  const context = await requireAssignmentMembership();
  const supabase = await createClient();
  let query = supabase
    .from("assignments")
    .select("*")
    .eq("organization_id", context.organization.id)
    .order("publish_at", { ascending: false });
  if (context.membership.role === "teacher") {
    query = query.eq("assigned_by", context.membership.user_id);
  }
  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  if (isStudent(context.membership.role)) {
    const studentAssignments = await listStudentAssignments();
    const ids = new Set(studentAssignments.map((item) => item.assignment_id));
    return data.filter((assignment) => ids.has(assignment.id));
  }
  return data;
}

export async function listStudentAssignments(): Promise<
  readonly AssignmentRecipientProjection[]
> {
  const context = await requireAssignmentMembership();
  if (isStudent(context.membership.role)) {
    return loadSubmissionSelfRecipients({
      accountId: context.membership.user_id,
      organizationId: context.organization.id,
    });
  }
  const supabase = await createClient();
  const query = supabase
    .from("assignment_students")
    .select("*")
    .eq("organization_id", context.organization.id)
    .order("assigned_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return Object.freeze(data.map(legacyRecipientProjection));
}

export async function assignStudents(
  assignmentId: string,
  input: AssignStudentsInput,
): Promise<readonly AssignmentRecipientProjection[]> {
  const parsedId = assignmentIdSchema.safeParse(assignmentId);
  const parsed = assignStudentsSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    throw new AssignmentError("invalid_input");
  }
  const context = await requireTeacherManager();
  const user = await requireAssignmentActor();
  const assignment = await getAssignment(parsedId.data);
  if (
    !canManageAll(context.membership.role) &&
    assignment.assigned_by !== user.id
  ) {
    throw new AssignmentError("forbidden");
  }
  if (assignment.status === "cancelled" || assignment.status === "closed") {
    throw new AssignmentError("invalid_assignment_state");
  }
  const recipientMode = assignmentRecipientAuthorityMode();
  const writeAuthority =
    resolveAssignmentRecipientWriteAuthority(recipientMode);
  const classExpansion = parsed.data.classIds?.length
    ? await prepareAssignmentClassExpansion({
        actorId: user.id,
        actorRole: assignmentClassExpansionRole(context.membership.role),
        assignmentId: parsedId.data,
        classIds: parsed.data.classIds,
        modeOverride: writeAuthority === "LEGACY" ? "LEGACY_ONLY" : undefined,
        organizationId: context.organization.id,
      })
    : null;

  if (writeAuthority !== "LEGACY") {
    await addCanonicalAssignmentRecipients({
      assignmentId: parsedId.data,
      classExpansion,
      directStudentIds: parsed.data.studentIds ?? [],
      writeLegacyCompatibility:
        writeAuthority === "CANONICAL_WITH_VERIFIED_LEGACY_PROJECTION",
    });
    return getAssignment(parsedId.data).then((detail) => detail.recipients);
  }

  const studentIds = [
    ...(classExpansion?.result.legacyRecipientIds ?? []),
    ...(parsed.data.studentIds ?? []),
  ];
  const uniqueStudentIds = [...new Set(studentIds)];
  if (classExpansion) {
    await persistAssignmentClasses(parsedId.data, classExpansion);
  }
  if (uniqueStudentIds.length === 0) {
    return getAssignment(parsedId.data).then((detail) => detail.recipients);
  }
  await persistAssignmentStudents({
    assignmentId: parsedId.data,
    organizationId: context.organization.id,
    studentIds: uniqueStudentIds,
  });
  await writeAssignmentAudit({
    action: "ASSIGNMENT_ASSIGNED",
    assignmentId: parsedId.data,
    metadata: { studentCount: uniqueStudentIds.length },
    organizationId: context.organization.id,
    userId: user.id,
  });
  return getAssignment(parsedId.data).then((detail) => detail.recipients);
}

export async function saveSubmission(
  assignmentId: string,
  input: SaveSubmissionInput,
): Promise<AssignmentSubmissionResult> {
  return persistStudentSubmission(assignmentId, input, false);
}

async function persistStudentSubmission(
  assignmentId: string,
  input: SaveSubmissionInput,
  submit: boolean,
): Promise<AssignmentSubmissionResult> {
  const parsedId = assignmentIdSchema.safeParse(assignmentId);
  const parsed = saveSubmissionSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    throw new AssignmentError("invalid_input");
  }
  const context = await requireAssignmentMembership();
  if (!isStudent(context.membership.role)) {
    throw new AssignmentError("forbidden");
  }
  const mode = submissionSelfAuthorityMode();
  const writeAuthority = resolveSubmissionSelfWriteAuthority(mode);
  let linkState: SubmissionSelfAuthorityEvent["linkState"] = "UNKNOWN";

  if (writeAuthority === "CANONICAL") {
    try {
      const resolution = await resolveCanonicalStudentForAuthenticatedAccount();
      requireCanonicalSubmissionIdentity({
        activeOrganizationId: context.organization.id,
        resolution,
      });
      linkState = "ACTIVE";
    } catch (error: unknown) {
      if (error instanceof SubmissionSelfResolutionError) {
        if (error.code === "student_account_link_expired") {
          linkState = "EXPIRED";
        } else if (error.code === "student_account_link_inactive") {
          linkState = "INACTIVE";
        } else if (error.code === "student_account_link_missing") {
          linkState = "MISSING";
        }
        throw mapSubmissionSelfResolutionError(error);
      }
      throw new AssignmentError("submission_identity_unavailable", {
        cause: error,
      });
    }
  }

  const supabase = await createClient();
  const rpcName =
    writeAuthority === "CANONICAL"
      ? "save_authenticated_student_submission"
      : "save_legacy_authenticated_student_submission";
  const { data, error } = await supabase.rpc(rpcName, {
    p_assignment_id: parsedId.data,
    p_content: parsed.data.content as Json,
    p_submit: submit,
  });
  if (error) throw mapDatabaseError(error);
  const result = assignmentSubmissionResultSchema.safeParse(data);
  if (!result.success) {
    throw new AssignmentError("submission_identity_unavailable", {
      cause: result.error,
    });
  }

  new ConsoleSubmissionSelfAuthorityObserver().record(
    Object.freeze({
      action: submit ? "SUBMIT" : "SAVE",
      assignmentId: parsedId.data,
      canonicalOnlyCount: 0,
      canonicalSelfResolutionSuccess:
        result.data.identity_authority === "CANONICAL" ? 1 : 0,
      correlationId: randomUUID(),
      fallbackCount: 0,
      legacyOnlyCount: 0,
      legacySelfResolutionSuccess: 0,
      linkState,
      matchedIdentityCount: 0,
      mode,
      organizationId: context.organization.id,
      recipientFound: true,
      recipientMismatch: 0,
      returnedAuthority:
        result.data.identity_authority === "CANONICAL" ? "CANONICAL" : "LEGACY",
      shadowErrorCount: 0,
      tenantMismatch: 0,
      unexpectedIdentityConflict: 0,
      version: "le-001.submission-self-resolution.v1",
      writeFallbackCount: 0,
    }),
  );
  return Object.freeze({ ...result.data });
}

export async function submitAssignment(
  assignmentId: string,
  input: SaveSubmissionInput,
): Promise<AssignmentSubmissionResult> {
  return persistStudentSubmission(assignmentId, input, true);
}
