import {
  accessControlErrorResponse,
  accessControlSuccess,
  parseAccessControlJson,
} from "@/lib/access-control/api";
import { enableAccessMember } from "@/lib/access-control/service";
import { memberStatusChangeSchema } from "@/lib/validation/access";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsed = await parseAccessControlJson(
    request,
    memberStatusChangeSchema.omit({ membershipId: true }),
  );
  if (!parsed.success) return parsed.response;
  try {
    const membershipId = await enableAccessMember({
      membershipId: id,
      reason: parsed.data.reason,
    });
    return Response.json(
      accessControlSuccess("成員已重新啟用。", { membershipId }),
    );
  } catch (error: unknown) {
    return accessControlErrorResponse(error);
  }
}
