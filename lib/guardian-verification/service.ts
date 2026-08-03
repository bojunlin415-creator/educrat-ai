import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getCurrentUser } from "@/lib/auth/session";
import {
  GUARDIAN_CONSENT_VERSION,
  type GuardianInvitationAccepted,
  type GuardianInvitationCreated,
  type GuardianInvitationPreview,
  type GuardianRelationshipRevoked,
} from "@/lib/guardian-verification/domain";
import { GuardianVerificationError } from "@/lib/guardian-verification/errors";
import { OrganizationError } from "@/lib/organization/errors";
import { requireOrganizationRole } from "@/lib/organization/service";
import { createClient } from "@/lib/supabase/server";
import {
  acceptGuardianInvitationSchema,
  createGuardianInvitationSchema,
  guardianInvitationTokenSchema,
  previewGuardianInvitationSchema,
  revokeGuardianRelationshipSchema,
  type AcceptGuardianInvitationInput,
  type CreateGuardianInvitationInput,
  type PreviewGuardianInvitationInput,
  type RevokeGuardianRelationshipInput,
} from "@/lib/validation/guardian-verification";

type GuardianInvitationRow =
  Database["public"]["Tables"]["guardian_invitations"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function mapDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return new GuardianVerificationError("service_unavailable");
  if (error.message?.includes("guardian_invalid_invitation")) {
    return new GuardianVerificationError("invalid_input");
  }
  if (error.message?.includes("guardian_invalid_consent")) {
    return new GuardianVerificationError("invalid_consent");
  }
  if (error.message?.includes("guardian_invitation_not_found")) {
    return new GuardianVerificationError("not_found");
  }
  if (error.message?.includes("guardian_invitation_not_available")) {
    return new GuardianVerificationError("expired");
  }
  if (error.message?.includes("guardian_email_mismatch")) {
    return new GuardianVerificationError("email_mismatch");
  }
  if (error.message?.includes("guardian_verified_email_required")) {
    return new GuardianVerificationError("forbidden");
  }
  if (error.message?.includes("guardian_existing_membership_role_conflict")) {
    return new GuardianVerificationError("role_conflict");
  }
  if (error.message?.includes("guardian_relationship_not_found")) {
    return new GuardianVerificationError("not_found");
  }
  if (error.message?.includes("guardian_relationship_not_active")) {
    return new GuardianVerificationError("forbidden");
  }
  if (error.message?.includes("guardian_invalid_revocation_reason")) {
    return new GuardianVerificationError("invalid_input");
  }
  if (error.code === "23505") {
    return new GuardianVerificationError("invalid_input");
  }
  if (error.code === "22023") {
    return new GuardianVerificationError("invalid_input");
  }
  if (error.code === "P0002") {
    return new GuardianVerificationError("not_found");
  }
  if (error.code === "42501") {
    if (error.message?.includes("authentication_required")) {
      return new GuardianVerificationError("not_authenticated");
    }
    return new GuardianVerificationError("forbidden");
  }
  return new GuardianVerificationError("service_unavailable");
}

function mapOrganizationError(
  error: OrganizationError,
): GuardianVerificationError {
  switch (error.code) {
    case "not_authenticated":
      return new GuardianVerificationError("not_authenticated");
    case "organization_not_found":
    case "not_member":
      return new GuardianVerificationError("organization_required");
    case "forbidden":
      return new GuardianVerificationError("forbidden");
    default:
      return new GuardianVerificationError("service_unavailable");
  }
}

async function requireActor(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new GuardianVerificationError("not_authenticated");
  return user;
}

async function requireGuardianInvitationIssuer() {
  try {
    return await requireOrganizationRole([
      "organization_owner",
      "organization_admin",
    ]);
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

export function hashGuardianInvitationToken(rawToken: string): string {
  const parsed = guardianInvitationTokenSchema.safeParse(rawToken);
  if (!parsed.success) throw new GuardianVerificationError("invalid_input");
  return createHash("sha256").update(parsed.data).digest("hex");
}

function createRawInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

function normalizeInvitationUrl(rawToken: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/guardian-invitations/accept?token=${rawToken}`;
}

function defaultExpiresAt(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

async function requireStudentProfile(input: {
  readonly organizationId: string;
  readonly studentId: string;
}): Promise<ProfileRow> {
  const supabase = await createClient();
  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.studentId)
    .eq("role", "student")
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) throw mapDatabaseError(membershipError);
  if (!membership) throw new GuardianVerificationError("not_found");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", input.studentId)
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!profile) throw new GuardianVerificationError("not_found");
  return profile;
}

async function writeGuardianAudit(input: {
  readonly action: "GUARDIAN_INVITATION_CREATED";
  readonly actorId: string;
  readonly metadata?: Json;
  readonly organizationId: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("parent_portal_audit_events").insert({
    action: input.action,
    actor_id: input.actorId,
    metadata: input.metadata ?? {},
    organization_id: input.organizationId,
  });
  if (error) throw mapDatabaseError(error);
}

export async function createGuardianInvitation(
  input: CreateGuardianInvitationInput,
): Promise<GuardianInvitationCreated> {
  const parsed = createGuardianInvitationSchema.safeParse(input);
  if (!parsed.success) throw new GuardianVerificationError("invalid_input");
  const context = await requireGuardianInvitationIssuer();
  const actor = await requireActor();
  await requireStudentProfile({
    organizationId: context.organization.id,
    studentId: parsed.data.studentId,
  });

  const rawToken = createRawInvitationToken();
  const tokenHash = hashGuardianInvitationToken(rawToken);
  const expiresAt = parsed.data.expiresAt ?? defaultExpiresAt();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guardian_invitations")
    .insert({
      created_by: actor.id,
      expires_at: expiresAt,
      guardian_email_normalized: parsed.data.guardianEmail,
      organization_id: context.organization.id,
      relationship_type: parsed.data.relationshipType,
      status: "pending",
      student_id: parsed.data.studentId,
      token_hash: tokenHash,
    })
    .select("*")
    .single();
  if (error) throw mapDatabaseError(error);

  await writeGuardianAudit({
    action: "GUARDIAN_INVITATION_CREATED",
    actorId: actor.id,
    metadata: { invitationId: data.id, studentId: data.student_id },
    organizationId: context.organization.id,
  });
  return Object.freeze({
    expiresAt: data.expires_at,
    invitationId: data.id,
    invitationUrl: normalizeInvitationUrl(rawToken),
    rawToken,
  });
}

function invitationIsUsable(row: GuardianInvitationRow): boolean {
  return row.status === "pending" && Date.parse(row.expires_at) > Date.now();
}

export async function previewGuardianInvitation(
  input: PreviewGuardianInvitationInput,
): Promise<GuardianInvitationPreview> {
  const parsed = previewGuardianInvitationSchema.safeParse(input);
  if (!parsed.success) throw new GuardianVerificationError("invalid_input");
  const actor = await requireActor();
  const email = actor.email?.trim().toLowerCase();
  if (!email) throw new GuardianVerificationError("forbidden");
  const tokenHash = hashGuardianInvitationToken(parsed.data.token);
  const supabase = await createClient();
  const { data: invitation, error } = await supabase
    .from("guardian_invitations")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("guardian_email_normalized", email)
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!invitation) throw new GuardianVerificationError("not_found");
  if (!invitationIsUsable(invitation)) {
    throw new GuardianVerificationError("expired");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", invitation.student_id)
    .maybeSingle();
  if (profileError) throw mapDatabaseError(profileError);
  if (!profile) throw new GuardianVerificationError("not_found");
  return Object.freeze({
    expiresAt: invitation.expires_at,
    invitationId: invitation.id,
    organizationId: invitation.organization_id,
    relationshipType: invitation.relationship_type,
    studentDisplayName:
      profile.display_name ?? `學生 ${profile.id.slice(0, 8)}`,
    studentId: invitation.student_id,
  });
}

export async function acceptGuardianInvitation(
  input: AcceptGuardianInvitationInput,
): Promise<GuardianInvitationAccepted> {
  const parsed = acceptGuardianInvitationSchema.safeParse(input);
  if (!parsed.success) throw new GuardianVerificationError("invalid_input");
  await requireActor();
  const tokenHash = hashGuardianInvitationToken(parsed.data.token);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_guardian_invitation", {
    p_consent_version: parsed.data.consentVersion,
    p_token_hash: tokenHash,
  });
  if (error) throw mapDatabaseError(error);
  if (!data) throw new GuardianVerificationError("service_unavailable");
  return Object.freeze({ relationshipId: data });
}

export async function revokeGuardianRelationship(
  input: RevokeGuardianRelationshipInput,
): Promise<GuardianRelationshipRevoked> {
  const parsed = revokeGuardianRelationshipSchema.safeParse(input);
  if (!parsed.success) throw new GuardianVerificationError("invalid_input");
  await requireGuardianInvitationIssuer();
  await requireActor();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_guardian_relationship", {
    p_reason: parsed.data.reason,
    p_relationship_id: parsed.data.relationshipId,
  });
  if (error) throw mapDatabaseError(error);
  if (!data) throw new GuardianVerificationError("service_unavailable");
  return Object.freeze({ relationshipId: data });
}

export { GUARDIAN_CONSENT_VERSION };
