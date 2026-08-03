import {
  guardianVerificationErrorResponse,
  guardianVerificationSuccess,
  parseGuardianVerificationJson,
} from "@/lib/guardian-verification/api";
import { revokeGuardianRelationship } from "@/lib/guardian-verification/service";
import { revokeGuardianRelationshipSchema } from "@/lib/validation/guardian-verification";

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly relationshipId: string }> },
) {
  const { relationshipId } = await context.params;
  const parsed = await parseGuardianVerificationJson(
    request,
    revokeGuardianRelationshipSchema.omit({ relationshipId: true }),
  );
  if (!parsed.success) return parsed.response;

  try {
    const result = await revokeGuardianRelationship({
      reason: parsed.data.reason,
      relationshipId,
    });
    return Response.json(
      guardianVerificationSuccess("家長關係已撤銷。", {
        relationshipId: result.relationshipId,
      }),
    );
  } catch (error: unknown) {
    return guardianVerificationErrorResponse(error);
  }
}
