import type { CurriculumExportDocument } from "@/lib/curriculum-export/domain/document";
import { getCurriculumExportModeLabel } from "@/lib/curriculum-export/application/export-mode";

const MAX_FILENAME_LENGTH = 140;
const ILLEGAL_FILENAME_CHARS = /[\u0000-\u001f<>:"/\\|?*\u007f]/g;

export function createSafeCurriculumExportFilename(
  document: CurriculumExportDocument,
): string {
  const metadata = document.metadata;
  const base = [
    metadata.grade,
    metadata.subject,
    metadata.topic || metadata.title,
    getCurriculumExportModeLabel(document.mode),
  ]
    .map((part) =>
      part
        .replaceAll("..", "")
        .replace(ILLEGAL_FILENAME_CHARS, "")
        .replace(/\s+/g, "")
        .trim(),
    )
    .filter(Boolean)
    .join("-");
  const normalized = (base || "教材匯出").slice(0, MAX_FILENAME_LENGTH);
  return `${normalized}.pdf`;
}
