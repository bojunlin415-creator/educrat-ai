import {
  curriculumErrorResponse,
  curriculumFailure,
  curriculumSuccess,
  parseCurriculumJson,
} from "@/lib/curriculum/api";
import {
  createLesson,
  deleteLesson,
  getLessons,
  reorderLesson,
  updateLesson,
} from "@/lib/curriculum/service";
import {
  createLessonSchema,
  deleteLessonSchema,
  lessonListQuerySchema,
  lessonPatchSchema,
} from "@/lib/validation/curriculum-hierarchy";

export async function GET(request: Request) {
  const parsed = lessonListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    return Response.json(curriculumFailure("章節識別碼格式不正確。"), {
      status: 422,
    });
  }

  try {
    const lessons = await getLessons(parsed.data.chapterId);
    return Response.json(curriculumSuccess("課次已載入。", { lessons }));
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const parsed = await parseCurriculumJson(request, createLessonSchema);
  if (!parsed.success) return parsed.response;

  try {
    const entityId = await createLesson(parsed.data);
    return Response.json(curriculumSuccess("課次已建立。", { entityId }), {
      status: 201,
    });
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const parsed = await parseCurriculumJson(request, lessonPatchSchema);
  if (!parsed.success) return parsed.response;

  try {
    if (parsed.data.action === "reorder") {
      await reorderLesson({
        chapterId: parsed.data.chapterId,
        orderedIds: parsed.data.orderedIds,
      });
      return Response.json(curriculumSuccess("課次順序已更新。"));
    }

    const entityId = await updateLesson({
      estimatedMinutes: parsed.data.estimatedMinutes,
      learningObjectives: parsed.data.learningObjectives,
      lessonId: parsed.data.lessonId,
      lessonNo: parsed.data.lessonNo,
      status: parsed.data.status,
      teachingNotes: parsed.data.teachingNotes,
      title: parsed.data.title,
    });
    return Response.json(curriculumSuccess("課次已更新。", { entityId }));
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const parsed = await parseCurriculumJson(request, deleteLessonSchema);
  if (!parsed.success) return parsed.response;

  try {
    const entityId = await deleteLesson(parsed.data.lessonId);
    return Response.json(curriculumSuccess("課次已刪除。", { entityId }));
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}
