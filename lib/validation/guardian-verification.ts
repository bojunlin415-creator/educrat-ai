import { z } from "zod";
import { GUARDIAN_CONSENT_VERSION } from "@/lib/guardian-verification/domain";

export const guardianEmailSchema = z.email().trim().toLowerCase().max(254);
export const guardianRelationshipTypeSchema = z.enum([
  "parent",
  "legal_guardian",
  "authorized_caregiver",
  "other_verified_guardian",
]);
export const guardianInvitationTokenSchema = z
  .string()
  .trim()
  .min(32)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/);
export const guardianConsentVersionSchema = z.literal(GUARDIAN_CONSENT_VERSION);

export const createGuardianInvitationSchema = z
  .object({
    expiresAt: z.iso.datetime().optional(),
    guardianEmail: guardianEmailSchema,
    relationshipType: guardianRelationshipTypeSchema,
    studentId: z.uuid(),
  })
  .strict();

export const acceptGuardianInvitationSchema = z
  .object({
    consentVersion: guardianConsentVersionSchema,
    token: guardianInvitationTokenSchema,
  })
  .strict();

export const previewGuardianInvitationSchema = z.object({
  token: guardianInvitationTokenSchema,
});

export const revokeGuardianRelationshipSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3)
      .max(240)
      .regex(/^[\p{L}\p{N}\p{P}\p{Zs}]+$/u),
    relationshipId: z.uuid(),
  })
  .strict();

export type AcceptGuardianInvitationInput = z.infer<
  typeof acceptGuardianInvitationSchema
>;
export type CreateGuardianInvitationInput = z.infer<
  typeof createGuardianInvitationSchema
>;
export type PreviewGuardianInvitationInput = z.infer<
  typeof previewGuardianInvitationSchema
>;
export type RevokeGuardianRelationshipInput = z.infer<
  typeof revokeGuardianRelationshipSchema
>;
