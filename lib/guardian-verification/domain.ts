export const GUARDIAN_INVITATION_STATUSES = [
  "pending",
  "accepted",
  "expired",
  "revoked",
] as const;

export const GUARDIAN_RELATIONSHIP_TYPES = [
  "parent",
  "legal_guardian",
  "authorized_caregiver",
  "other_verified_guardian",
] as const;

export const GUARDIAN_RELATIONSHIP_STATUSES = [
  "pending",
  "verified",
  "active",
  "revoked",
] as const;

export const GUARDIAN_CONSENT_VERSION = "guardian-consent-v1";

export type GuardianInvitationStatus =
  (typeof GUARDIAN_INVITATION_STATUSES)[number];
export type GuardianRelationshipType =
  (typeof GUARDIAN_RELATIONSHIP_TYPES)[number];
export type GuardianRelationshipStatus =
  (typeof GUARDIAN_RELATIONSHIP_STATUSES)[number];

export interface GuardianInvitationPreview {
  readonly expiresAt: string;
  readonly invitationId: string;
  readonly organizationId: string;
  readonly relationshipType: GuardianRelationshipType;
  readonly studentDisplayName: string;
  readonly studentId: string;
}

export interface GuardianInvitationCreated {
  readonly expiresAt: string;
  readonly invitationId: string;
  readonly invitationUrl: string;
  readonly rawToken: string;
}

export interface GuardianInvitationAccepted {
  readonly relationshipId: string;
}

export interface GuardianRelationshipRevoked {
  readonly relationshipId: string;
}
