import { z } from "zod";
import {
  curriculumErrorResponse,
  curriculumFailure,
  curriculumSuccess,
} from "@/lib/curriculum/api";
import { saveAICurriculumDraft } from "@/lib/curriculum/ai-generation";
import { CurriculumError } from "@/lib/curriculum/errors";
import { validateCopyrightSafetyText } from "@/lib/ai-generation";
import {
  SUBJECT_CAPABILITY_HTTP_STATUS,
  SubjectCapabilityError,
  subjectCapabilityFailure,
} from "@/lib/subjects";
import { aiCurriculumSaveDraftSchema } from "@/lib/validation/ai-curriculum-generation";

const MAX_AI_SAVE_BODY_BYTES = 256 * 1024;

async function parseJson<T>(request: Request, schema: z.ZodType<T>) {
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  ) {
    return {
      response: Response.json(
        curriculumFailure("請使用 JSON 格式送出 AI 教材草稿。"),
        { status: 415 },
      ),
      success: false as const,
    };
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_AI_SAVE_BODY_BYTES) {
    return {
      response: Response.json(curriculumFailure("送出的 AI 教材草稿過大。"), {
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
            "請修正標示的 AI 教材草稿欄位。",
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
  const parsed = await parseJson(request, aiCurriculumSaveDraftSchema);
  if (!parsed.success) return parsed.response;

  try {
    if (!validateCopyrightSafetyText(JSON.stringify(parsed.data)).safe) {
      throw new CurriculumError("copyright_blocked");
    }
    const curriculum = await saveAICurriculumDraft(parsed.data);
    return Response.json(
      curriculumSuccess("AI 原創教材草稿已儲存。", {
        curriculum: { id: curriculum.id, name: curriculum.name },
        redirectTo: `/curriculums/${curriculum.id}`,
      }),
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof SubjectCapabilityError) {
      return Response.json(subjectCapabilityFailure(error), {
        status: SUBJECT_CAPABILITY_HTTP_STATUS,
      });
    }
    return curriculumErrorResponse(error);
  }
}
