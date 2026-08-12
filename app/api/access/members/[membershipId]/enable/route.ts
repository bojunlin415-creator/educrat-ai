import {
  accessControlErrorResponse,
  accessControlSuccess,
  logAccessApi,
  parseAccessControlJson,
} from "@/lib/access-control/api";
import { enableAccessMember } from "@/lib/access-control/service";
import { memberStatusChangeSchema } from "@/lib/validation/access";

const route = "/api/access/members/[membershipId]/enable";

export async function POST(
  request: Request,
  context: { params: Promise<{ membershipId: string }> },
) {
  const { membershipId: rawMembershipId } = await context.params;
  const parsed = await parseAccessControlJson(
    request,
    memberStatusChangeSchema.omit({ membershipId: true }),
  );
  const membershipId = memberStatusChangeSchema.shape.membershipId.safeParse(
    rawMembershipId,
  );
  if (!parsed.success) {
    logAccessApi({
      payload: parsed.body,
      response: { status: parsed.responseStatus },
      route,
      service: null,
      validation: {
        errors: parsed.validationErrors,
        membershipId: rawMembershipId,
        source: parsed.failureSource,
        success: false,
      },
    });
    return parsed.response;
  }
  if (!membershipId.success) {
    const response = Response.json(
      {
        details: membershipId.error.flatten(),
        error: "請修正標示的存取管理欄位。",
        code: "invalid_input",
        message: "請修正標示的存取管理欄位。",
        success: false,
      },
      { status: 400 },
    );
    logAccessApi({
      payload: parsed.body,
      response: { status: response.status },
      route,
      service: null,
      validation: {
        errors: membershipId.error.flatten(),
        membershipId: rawMembershipId,
        source: "membershipId_param",
        success: false,
      },
    });
    return response;
  }
  try {
    const serviceInput = {
      membershipId: membershipId.data,
      reason: parsed.data.reason,
    };
    const updatedMembershipId = await enableAccessMember(serviceInput);
    logAccessApi({
      payload: parsed.body,
      response: { membershipId: updatedMembershipId, status: 200 },
      route,
      service: { input: serviceInput, output: { updatedMembershipId } },
      validation: {
        membershipId: membershipId.data,
        payload: parsed.data,
        success: true,
      },
    });
    return Response.json(
      accessControlSuccess("成員已重新啟用。", {
        membershipId: updatedMembershipId,
      }),
    );
  } catch (error: unknown) {
    const response = accessControlErrorResponse(error);
    logAccessApi({
      payload: parsed.body,
      response: { status: response.status },
      route,
      service: {
        exception: error instanceof Error ? error.message : error,
        input: { membershipId: membershipId.data, reason: parsed.data.reason },
      },
      validation: {
        membershipId: membershipId.data,
        payload: parsed.data,
        success: true,
      },
    });
    return response;
  }
}
