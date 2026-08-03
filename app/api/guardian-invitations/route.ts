import {
  guardianVerificationErrorResponse,
  guardianVerificationSuccess,
  parseGuardianVerificationJson,
} from "@/lib/guardian-verification/api";
import { createGuardianInvitation } from "@/lib/guardian-verification/service";
import { createGuardianInvitationSchema } from "@/lib/validation/guardian-verification";

export async function POST(request: Request) {
  const parsed = await parseGuardianVerificationJson(
    request,
    createGuardianInvitationSchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const invitation = await createGuardianInvitation(parsed.data);
    return Response.json(
      guardianVerificationSuccess("家長邀請已建立。", { invitation }),
      { status: 201 },
    );
  } catch (error: unknown) {
    return guardianVerificationErrorResponse(error);
  }
}
