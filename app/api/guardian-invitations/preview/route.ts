import {
  guardianVerificationErrorResponse,
  guardianVerificationSuccess,
} from "@/lib/guardian-verification/api";
import { previewGuardianInvitation } from "@/lib/guardian-verification/service";
import { previewGuardianInvitationSchema } from "@/lib/validation/guardian-verification";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const parsed = previewGuardianInvitationSchema.safeParse({ token });
  if (!parsed.success) {
    return Response.json(
      {
        code: "invalid_input",
        message: "家長邀請連結格式不正確。",
        success: false,
      },
      { status: 422 },
    );
  }

  try {
    const invitation = await previewGuardianInvitation(parsed.data);
    return Response.json(
      guardianVerificationSuccess("家長邀請已載入。", { invitation }),
    );
  } catch (error: unknown) {
    return guardianVerificationErrorResponse(error);
  }
}
