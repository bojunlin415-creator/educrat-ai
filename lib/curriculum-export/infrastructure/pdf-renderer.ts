import {
  type CurriculumExportDocument,
  type CurriculumExportMode,
  type CurriculumExportQuestion,
} from "@/lib/curriculum-export/domain/document";
import { validateCurriculumExportDocument } from "@/lib/curriculum-export/application/validation";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 48;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 52;
const BODY_FONT_SIZE = 11;
const LINE_HEIGHT = 18;
const MAX_BODY_CHARS = 43;

interface PdfPage {
  readonly lines: readonly string[];
}

interface RenderState {
  currentLines: string[];
  cursorY: number;
  pages: PdfPage[];
}

export interface CurriculumPdfRenderResult {
  readonly contentType: "application/pdf";
  readonly data: Uint8Array;
}

function utf16Hex(input: string): string {
  const bytes: string[] = [];
  for (const codeUnit of input.normalize("NFC")) {
    const code = codeUnit.codePointAt(0) ?? 0x20;
    if (code > 0xffff) {
      const value = code - 0x10000;
      const high = 0xd800 + (value >> 10);
      const low = 0xdc00 + (value & 0x3ff);
      bytes.push(high.toString(16).padStart(4, "0"));
      bytes.push(low.toString(16).padStart(4, "0"));
    } else {
      bytes.push(code.toString(16).padStart(4, "0"));
    }
  }
  return bytes.join("").toUpperCase();
}

function textOperator(
  input: string,
  x: number,
  y: number,
  size = BODY_FONT_SIZE,
) {
  return `BT /F1 ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm <FEFF${utf16Hex(input)}> Tj ET`;
}

function wrapText(input: string, maxChars = MAX_BODY_CHARS): readonly string[] {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return Object.freeze([normalized]);
  const lines: string[] = [];
  let current = "";
  for (const char of normalized) {
    if (current.length >= maxChars) {
      lines.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) lines.push(current);
  return Object.freeze(lines);
}

function startPage(state: RenderState) {
  if (state.currentLines.length > 0) {
    state.pages.push(
      Object.freeze({ lines: Object.freeze(state.currentLines) }),
    );
  }
  state.currentLines = [];
  state.cursorY = PAGE_HEIGHT - MARGIN_TOP;
}

function addLine(
  state: RenderState,
  input: string,
  options: { readonly indent?: number; readonly size?: number } = {},
) {
  if (state.cursorY < MARGIN_BOTTOM) startPage(state);
  state.currentLines.push(
    textOperator(
      input,
      MARGIN_X + (options.indent ?? 0),
      state.cursorY,
      options.size,
    ),
  );
  state.cursorY -= LINE_HEIGHT;
}

function addWrappedLine(
  state: RenderState,
  input: string,
  options: { readonly indent?: number; readonly size?: number } = {},
) {
  for (const line of wrapText(input)) addLine(state, line, options);
}

function addSpacer(state: RenderState, lines = 1) {
  state.cursorY -= LINE_HEIGHT * lines;
  if (state.cursorY < MARGIN_BOTTOM) startPage(state);
}

function renderDocumentHeader(
  state: RenderState,
  document: CurriculumExportDocument,
) {
  addWrappedLine(state, document.metadata.title, { size: 18 });
  addWrappedLine(
    state,
    `${document.metadata.organizationName}｜${document.metadata.subject}｜${document.metadata.grade}｜${document.metadata.topic}`,
    { size: 10 },
  );
  addSpacer(state);
}

function renderWorksheetFields(state: RenderState) {
  addLine(
    state,
    "姓名：____________　班級：____________　座號：______　日期：____________　分數：______",
  );
  addSpacer(state);
}

function renderQuestion(
  state: RenderState,
  question: CurriculumExportQuestion,
  mode: Exclude<CurriculumExportMode, "combined">,
) {
  const challengeLabel = question.challenge ? "（挑戰）" : "";
  addWrappedLine(
    state,
    `${question.number}. ${question.prompt}${challengeLabel}`,
  );
  if (mode === "worksheet") {
    addLine(state, "作答：");
    addLine(
      state,
      "____________________________________________________________",
      {
        indent: 18,
      },
    );
    addLine(
      state,
      "____________________________________________________________",
      {
        indent: 18,
      },
    );
  } else if (question.answer) {
    addWrappedLine(state, `答案：${question.answer.value}`, { indent: 18 });
    if (question.answer.explanation) {
      addWrappedLine(state, `解析：${question.answer.explanation}`, {
        indent: 18,
      });
    }
  }
  addSpacer(state);
}

function renderModeContent(
  state: RenderState,
  document: CurriculumExportDocument,
  mode: Exclude<CurriculumExportMode, "combined">,
) {
  renderDocumentHeader(state, document);
  if (mode === "worksheet") renderWorksheetFields(state);
  for (const section of document.sections) {
    if (section.kind !== "questions") {
      if (mode === "answer-sheet" && section.kind !== "objectives") continue;
      addWrappedLine(state, section.heading, { size: 13 });
      for (const item of section.items) addWrappedLine(state, `• ${item}`);
      addSpacer(state);
      continue;
    }
    addWrappedLine(state, mode === "worksheet" ? "練習題" : "解答與解析", {
      size: 13,
    });
    for (const question of section.questions ?? []) {
      renderQuestion(state, question, mode);
    }
  }
}

function createPages(document: CurriculumExportDocument): readonly PdfPage[] {
  const state: RenderState = {
    currentLines: [],
    cursorY: PAGE_HEIGHT - MARGIN_TOP,
    pages: [],
  };
  if (document.mode === "combined") {
    renderModeContent(state, document, "worksheet");
    startPage(state);
    renderModeContent(state, document, "answer-sheet");
  } else {
    renderModeContent(state, document, document.mode);
  }
  startPage(state);
  return Object.freeze(state.pages);
}

function createPageStream(
  page: PdfPage,
  pageNumber: number,
  pageCount: number,
) {
  const footer = textOperator(
    `第 ${pageNumber} / ${pageCount} 頁`,
    PAGE_WIDTH / 2 - 34,
    28,
    9,
  );
  const content = ["q", "0 0 0 rg", ...page.lines, footer, "Q"].join("\n");
  return content;
}

function toPdfBytes(objects: readonly string[]) {
  const pdfHeader = "%PDF-1.7\n";
  const chunks = [pdfHeader];
  const offsets: number[] = [0];
  let length = pdfHeader.length;
  objects.forEach((object, index) => {
    offsets[index + 1] = length;
    const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`;
    chunks.push(chunk);
    length += chunk.length;
  });
  const xrefOffset = length;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets
      .slice(1)
      .map((offset) => `${offset.toString().padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ].join("\n");
  chunks.push(xref);
  return new TextEncoder().encode(chunks.join(""));
}

export function renderCurriculumExportPdf(
  document: CurriculumExportDocument,
): CurriculumPdfRenderResult {
  const validation = validateCurriculumExportDocument(document);
  if (!validation.success) {
    throw new Error(
      `curriculum_export_invalid:${validation.reason ?? "unknown"}`,
    );
  }

  const pages = createPages(document);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages
      .map((_, index) => `${3 + index * 2} 0 R`)
      .join(" ")}] /Count ${pages.length} >>`,
  ];
  pages.forEach((page, index) => {
    const stream = createPageStream(page, index + 1, pages.length);
    const streamObjectNumber = 4 + index * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${streamObjectNumber} 0 R >>`,
    );
    objects.push(
      `<< /Length ${new TextEncoder().encode(stream).byteLength} >>\nstream\n${stream}\nendstream`,
    );
  });
  objects.push(
    "<< /Type /Font /Subtype /Type0 /BaseFont /MHei-Medium /Encoding /UniCNS-UCS2-H /DescendantFonts [<< /Type /Font /Subtype /CIDFontType0 /BaseFont /MHei-Medium /CIDSystemInfo << /Registry (Adobe) /Ordering (CNS1) /Supplement 0 >> >>] >>",
  );

  return Object.freeze({
    contentType: "application/pdf" as const,
    data: toPdfBytes(objects),
  });
}
