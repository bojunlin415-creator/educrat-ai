import { curriculumErrorResponse } from "@/lib/curriculum/api";
import { exportCurriculumVersionPdf } from "@/lib/curriculum/export";
import {
  SUBJECT_CAPABILITY_HTTP_STATUS,
  SubjectCapabilityError,
  subjectCapabilityFailure,
} from "@/lib/subjects";

interface CurriculumExportRouteContext {
  params: Promise<{ curriculumId: string; versionId: string }>;
}

function contentDisposition(filename: string) {
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  request: Request,
  context: CurriculumExportRouteContext,
) {
  try {
    const { curriculumId, versionId } = await context.params;
    const { searchParams } = new URL(request.url);
    const result = await exportCurriculumVersionPdf({
      curriculumId,
      mode: searchParams.get("mode"),
      versionId,
    });

    const body = result.data.buffer.slice(
      result.data.byteOffset,
      result.data.byteOffset + result.data.byteLength,
    ) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": contentDisposition(result.filename),
        "Content-Type": "application/pdf",
      },
      status: 200,
    });
  } catch (error: unknown) {
    if (error instanceof SubjectCapabilityError) {
      return Response.json(subjectCapabilityFailure(error), {
        status: SUBJECT_CAPABILITY_HTTP_STATUS,
      });
    }
    return curriculumErrorResponse(error);
  }
}
