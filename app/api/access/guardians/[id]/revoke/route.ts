import {
  accessControlErrorResponse,
  accessControlSuccess,
  parseAccessControlJson,
} from "@/lib/access-control/api";
import { revokeAccessGuardianRelationship } from "@/lib/access-control/service";
import { revokeAccessGuardianRelationshipSchema } from "@/lib/validation/access";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsed = await parseAccessControlJson(
    request,
    revokeAccessGuardianRelationshipSchema,
  );
  if (!parsed.success) return parsed.response;
  try {
    const relationship = await revokeAccessGuardianRelationship(
      id,
      parsed.data,
    );
    return Response.json(
      accessControlSuccess("家長關係已撤銷。", { relationship }),
    );
  } catch (error: unknown) {
    return accessControlErrorResponse(error);
  }
}
