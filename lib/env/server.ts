import "server-only";

import { z } from "zod";

const optionalServerSecretsSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(20).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(20).optional(),
});

export type OptionalServerSecrets = z.infer<typeof optionalServerSecretsSchema>;

/**
 * Only call this from a server-only module that genuinely needs these secrets.
 * Sprint 3 does not use either value for ordinary application requests.
 */
export function getOptionalServerSecrets(): OptionalServerSecrets {
  return optionalServerSecretsSchema.parse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
  });
}
