import {
  curriculumErrorResponse,
  curriculumFailure,
  curriculumSuccess,
  parseCurriculumJson,
} from "@/lib/curriculum/api";
import {
  createChapter,
  deleteChapter,
  getChapters,
  reorderChapter,
  updateChapter,
} from "@/lib/curriculum/service";
import {
  chapterPatchSchema,
  createChapterSchema,
  deleteChapterSchema,
  hierarchyListQuerySchema,
} from "@/lib/validation/curriculum-hierarchy";

export async function GET(request: Request) {
  const parsed = hierarchyListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    return Response.json(curriculumFailure("教材識別碼格式不正確。"), {
      status: 422,
    });
  }

  try {
    const hierarchy = await getChapters(parsed.data.curriculumId);
    return Response.json(curriculumSuccess("章節已載入。", { hierarchy }));
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const parsed = await parseCurriculumJson(request, createChapterSchema);
  if (!parsed.success) return parsed.response;

  try {
    const entityId = await createChapter(parsed.data);
    return Response.json(curriculumSuccess("章節已建立。", { entityId }), {
      status: 201,
    });
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const parsed = await parseCurriculumJson(request, chapterPatchSchema);
  if (!parsed.success) return parsed.response;

  try {
    if (parsed.data.action === "reorder") {
      await reorderChapter({
        orderedIds: parsed.data.orderedIds,
        versionId: parsed.data.versionId,
      });
      return Response.json(curriculumSuccess("章節順序已更新。"));
    }

    const entityId = await updateChapter({
      chapterId: parsed.data.chapterId,
      chapterNo: parsed.data.chapterNo,
      description: parsed.data.description,
      status: parsed.data.status,
      title: parsed.data.title,
    });
    return Response.json(curriculumSuccess("章節已更新。", { entityId }));
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const parsed = await parseCurriculumJson(request, deleteChapterSchema);
  if (!parsed.success) return parsed.response;

  try {
    const entityId = await deleteChapter(parsed.data.chapterId);
    return Response.json(
      curriculumSuccess("章節與所屬課次已刪除。", { entityId }),
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}
