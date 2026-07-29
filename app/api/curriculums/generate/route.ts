import { z } from "zod";
import {
  curriculumErrorResponse,
  curriculumFailure,
  curriculumSuccess,
} from "@/lib/curriculum/api";
import { generateAICurriculumDraft } from "@/lib/curriculum/ai-generation";
import { CurriculumError } from "@/lib/curriculum/errors";
import { validateCopyrightSafetyText } from "@/lib/ai-generation";
import { aiCurriculumGenerationRequestSchema } from "@/lib/validation/ai-curriculum-generation";

const MAX_AI_BODY_BYTES = 128 * 1024;

async function parseJson<T>(request: Request, schema: z.ZodType<T>) {
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  ) {
    return {
      response: Response.json(
        curriculumFailure("請使用 JSON 格式送出 AI 教材需求。"),
        { status: 415 },
      ),
      success: false as const,
    };
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_AI_BODY_BYTES) {
    return {
      response: Response.json(curriculumFailure("送出的 AI 教材需求過大。"), {
        status: 413,
      }),
      success: false as const,
    };
  }

  try {
    const result = schema.safeParse(JSON.parse(rawBody) as unknown);
    if (!result.success) {
      return {
        response: Response.json(
          curriculumFailure(
            "請修正標示的 AI 教材欄位。",
            result.error.flatten().fieldErrors,
          ),
          { status: 422 },
        ),
        success: false as const,
      };
    }
    return { data: result.data, success: true as const };
  } catch {
    return {
      response: Response.json(curriculumFailure("JSON 資料格式不正確。"), {
        status: 400,
      }),
      success: false as const,
    };
  }
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, aiCurriculumGenerationRequestSchema);
  if (!parsed.success) return parsed.response;

  try {
    if (!validateCopyrightSafetyText(JSON.stringify(parsed.data)).safe) {
      throw new CurriculumError("copyright_blocked");
    }
    const result = await generateAICurriculumDraft(parsed.data);
    return Response.json(
      curriculumSuccess("AI 原創教材已生成，請檢查後再儲存。", {
        draft: result.draft,
        metadata: result.metadata,
      }),
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}
