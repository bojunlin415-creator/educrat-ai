import {
  guardianVerificationErrorResponse,
  guardianVerificationSuccess,
  parseGuardianVerificationJson,
} from "@/lib/guardian-verification/api";
import { acceptGuardianInvitation } from "@/lib/guardian-verification/service";
import { acceptGuardianInvitationSchema } from "@/lib/validation/guardian-verification";

export async function POST(request: Request) {
  const parsed = await parseGuardianVerificationJson(
    request,
    acceptGuardianInvitationSchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const result = await acceptGuardianInvitation(parsed.data);
    return Response.json(
      guardianVerificationSuccess("家長關係已啟用。", {
        relationshipId: result.relationshipId,
        redirectTo: "/dashboard/parent",
      }),
    );
  } catch (error: unknown) {
    return guardianVerificationErrorResponse(error);
  }
}
