import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateCurriculumExportDocument } from "@/lib/curriculum-export/application/validation";
import {
  type CurriculumExportDocument,
  type CurriculumExportMode,
  type CurriculumExportQuestion,
} from "@/lib/curriculum-export/domain/document";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 48;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 52;
const BODY_FONT_SIZE = 11;
const LINE_HEIGHT = 18;
const MAX_BODY_CHARS = 43;
const FONT_FILE_PATH = join(
  process.cwd(),
  "assets/fonts/NotoSansCJKtc-Regular.otf",
);
const PDF_FONT_NAME = "NotoSansCJKtc-Regular";

interface PdfPage {
  readonly lines: readonly string[];
}

interface CmapGroup {
  readonly endCodePoint: number;
  readonly startCodePoint: number;
  readonly startGlyphId: number;
}

interface FontCmap {
  readonly groups: readonly CmapGroup[];
}

interface FontMetrics {
  readonly advanceWidths: readonly number[];
  readonly defaultWidth: number;
  readonly unitsPerEm: number;
}

interface EmbeddedFont {
  readonly cmap: FontCmap;
  readonly data: Uint8Array;
  readonly metrics: FontMetrics;
}

interface RenderState {
  currentLines: string[];
  cursorY: number;
  fontCmap: FontCmap;
  pages: PdfPage[];
  usedGlyphs: Map<number, number>;
}

type PdfObject =
  string | { readonly dictionary: string; readonly stream: Uint8Array };

let embeddedFontCache: EmbeddedFont | undefined;

export interface CurriculumPdfRenderResult {
  readonly contentType: "application/pdf";
  readonly data: Uint8Array;
}

function normalizePdfText(input: string): string {
  return input
    .normalize("NFC")
    .replaceAll("\u2022", "●")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n");
}

function normalizeBulletItem(input: string): string {
  return normalizePdfText(input)
    .replace(/^[\s●•-]+/u, "")
    .trim();
}

function uint16(view: DataView, offset: number): number {
  return view.getUint16(offset, false);
}

function uint32(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function tableTag(data: Uint8Array, offset: number): string {
  return String.fromCharCode(
    data[offset] ?? 0,
    data[offset + 1] ?? 0,
    data[offset + 2] ?? 0,
    data[offset + 3] ?? 0,
  );
}

function findSfntTable(data: Uint8Array, tag: string): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tableCount = uint16(view, 4);
  for (let index = 0; index < tableCount; index += 1) {
    const offset = 12 + index * 16;
    if (tableTag(data, offset) === tag) return uint32(view, offset + 8);
  }
  throw new Error(`curriculum_export_font_missing_table:${tag}`);
}

function parseFormat12Cmap(
  data: Uint8Array,
  tableOffset: number,
  subtableOffset: number,
): FontCmap {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const start = tableOffset + subtableOffset;
  const groupCount = uint32(view, start + 12);
  const groups: CmapGroup[] = [];
  for (let index = 0; index < groupCount; index += 1) {
    const offset = start + 16 + index * 12;
    groups.push(
      Object.freeze({
        endCodePoint: uint32(view, offset + 4),
        startCodePoint: uint32(view, offset),
        startGlyphId: uint32(view, offset + 8),
      }),
    );
  }
  return Object.freeze({ groups: Object.freeze(groups) });
}

function parseFontCmap(data: Uint8Array): FontCmap {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tableOffset = findSfntTable(data, "cmap");
  const subtableCount = uint16(view, tableOffset + 2);
  let fallbackOffset: number | undefined;

  for (let index = 0; index < subtableCount; index += 1) {
    const recordOffset = tableOffset + 4 + index * 8;
    const platformId = uint16(view, recordOffset);
    const encodingId = uint16(view, recordOffset + 2);
    const subtableOffset = uint32(view, recordOffset + 4);
    const format = uint16(view, tableOffset + subtableOffset);

    if (format === 12 && platformId === 3 && encodingId === 10) {
      return parseFormat12Cmap(data, tableOffset, subtableOffset);
    }
    if (format === 12 && fallbackOffset === undefined) {
      fallbackOffset = subtableOffset;
    }
  }

  if (fallbackOffset !== undefined) {
    return parseFormat12Cmap(data, tableOffset, fallbackOffset);
  }
  throw new Error("curriculum_export_font_missing_unicode_cmap");
}

function parseFontMetrics(data: Uint8Array): FontMetrics {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const headOffset = findSfntTable(data, "head");
  const hheaOffset = findSfntTable(data, "hhea");
  const hmtxOffset = findSfntTable(data, "hmtx");
  const maxpOffset = findSfntTable(data, "maxp");
  const unitsPerEm = uint16(view, headOffset + 18);
  const hMetricCount = uint16(view, hheaOffset + 34);
  const glyphCount = uint16(view, maxpOffset + 4);
  const advanceWidths: number[] = [];
  const lastMetricOffset = hmtxOffset + Math.max(hMetricCount - 1, 0) * 4;
  const lastAdvanceWidth = uint16(view, lastMetricOffset);

  for (let glyphId = 0; glyphId < glyphCount; glyphId += 1) {
    const advanceWidth =
      glyphId < hMetricCount
        ? uint16(view, hmtxOffset + glyphId * 4)
        : lastAdvanceWidth;
    advanceWidths.push(Math.round((advanceWidth / unitsPerEm) * 1000));
  }

  return Object.freeze({
    advanceWidths: Object.freeze(advanceWidths),
    defaultWidth: 1000,
    unitsPerEm,
  });
}

function loadEmbeddedFont(): EmbeddedFont {
  if (embeddedFontCache) return embeddedFontCache;
  const data = readFileSync(FONT_FILE_PATH);
  embeddedFontCache = Object.freeze({
    cmap: parseFontCmap(data),
    data,
    metrics: parseFontMetrics(data),
  });
  return embeddedFontCache;
}

function glyphIdForCodePoint(cmap: FontCmap, codePoint: number): number {
  for (const group of cmap.groups) {
    if (codePoint >= group.startCodePoint && codePoint <= group.endCodePoint) {
      return group.startGlyphId + codePoint - group.startCodePoint;
    }
  }
  return 0;
}

function unicodeHex(codePoint: number): string {
  if (codePoint <= 0xffff) return codePoint.toString(16).padStart(4, "0");
  const value = codePoint - 0x10000;
  const high = 0xd800 + (value >> 10);
  const low = 0xdc00 + (value & 0x3ff);
  return `${high.toString(16).padStart(4, "0")}${low
    .toString(16)
    .padStart(4, "0")}`;
}

function glyphHex(
  input: string,
  cmap: FontCmap,
  usedGlyphs: Map<number, number>,
): string {
  const bytes: string[] = [];
  for (const codeUnit of normalizePdfText(input)) {
    const codePoint = codeUnit.codePointAt(0) ?? 0x20;
    const glyphId = glyphIdForCodePoint(cmap, codePoint);
    if (!usedGlyphs.has(glyphId)) usedGlyphs.set(glyphId, codePoint);
    bytes.push(glyphId.toString(16).padStart(4, "0"));
  }
  return bytes.join("").toUpperCase();
}

function textOperator(
  input: string,
  state: Pick<RenderState, "fontCmap" | "usedGlyphs">,
  x: number,
  y: number,
  size = BODY_FONT_SIZE,
) {
  return `BT /F1 ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm <${glyphHex(input, state.fontCmap, state.usedGlyphs)}> Tj ET`;
}

function wrapText(input: string, maxChars = MAX_BODY_CHARS): readonly string[] {
  const normalized = normalizePdfText(input).replace(/\s+/g, " ").trim();
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
      state,
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
      for (const item of section.items) {
        addWrappedLine(state, `● ${normalizeBulletItem(item)}`);
      }
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

function createPages(
  document: CurriculumExportDocument,
  fontCmap: FontCmap,
  usedGlyphs: Map<number, number>,
): readonly PdfPage[] {
  const state: RenderState = {
    currentLines: [],
    cursorY: PAGE_HEIGHT - MARGIN_TOP,
    fontCmap,
    pages: [],
    usedGlyphs,
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
  fontCmap: FontCmap,
  usedGlyphs: Map<number, number>,
) {
  const footer = textOperator(
    `第 ${pageNumber} / ${pageCount} 頁`,
    { fontCmap, usedGlyphs },
    PAGE_WIDTH / 2 - 34,
    28,
    9,
  );
  const content = ["q", "0 0 0 rg", ...page.lines, footer, "Q"].join("\n");
  return content;
}

function encodeAscii(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function pdfObjectBytes(object: PdfObject, objectNumber: number): Uint8Array {
  const header = encodeAscii(`${objectNumber} 0 obj\n`);
  const footer = encodeAscii("\nendobj\n");
  if (typeof object === "string") {
    return concatBytes([header, encodeAscii(object), footer]);
  }

  return concatBytes([
    header,
    encodeAscii(
      `${object.dictionary.replace(
        "<<",
        `<< /Length ${object.stream.byteLength}`,
      )}\nstream\n`,
    ),
    object.stream,
    encodeAscii("\nendstream"),
    footer,
  ]);
}

function toPdfBytes(objects: readonly PdfObject[]) {
  const pdfHeader = encodeAscii("%PDF-1.7\n");
  const chunks = [pdfHeader];
  const offsets: number[] = [0];
  let length = pdfHeader.byteLength;
  objects.forEach((object, index) => {
    offsets[index + 1] = length;
    const chunk = pdfObjectBytes(object, index + 1);
    chunks.push(chunk);
    length += chunk.byteLength;
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
  chunks.push(encodeAscii(xref));
  return concatBytes(chunks);
}

function createToUnicodeCMap(usedGlyphs: Map<number, number>): string {
  const entries = [...usedGlyphs.entries()]
    .filter(([glyphId]) => glyphId > 0)
    .sort(([left], [right]) => left - right)
    .map(
      ([glyphId, codePoint]) =>
        `<${glyphId.toString(16).padStart(4, "0").toUpperCase()}> <${unicodeHex(
          codePoint,
        ).toUpperCase()}>`,
    );
  const chunks: string[] = [];
  for (let index = 0; index < entries.length; index += 100) {
    const chunk = entries.slice(index, index + 100);
    chunks.push(`${chunk.length} beginbfchar\n${chunk.join("\n")}\nendbfchar`);
  }

  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> def",
    `/${PDF_FONT_NAME}-ToUnicode /CMapName def`,
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<0000> <FFFF>",
    "endcodespacerange",
    ...chunks,
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join("\n");
}

function createWidthArray(
  usedGlyphs: Map<number, number>,
  metrics: FontMetrics,
): string {
  return [...usedGlyphs.keys()]
    .filter((glyphId) => glyphId > 0)
    .sort((left, right) => left - right)
    .map((glyphId) => {
      const width = metrics.advanceWidths[glyphId] ?? metrics.defaultWidth;
      return `${glyphId} [${width}]`;
    })
    .join(" ");
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

  const embeddedFont = loadEmbeddedFont();
  const usedGlyphs = new Map<number, number>();
  const pages = createPages(document, embeddedFont.cmap, usedGlyphs);
  const fontObjectNumber = 3 + pages.length * 2;
  const fontDescriptorObjectNumber = fontObjectNumber + 1;
  const fontFileObjectNumber = fontObjectNumber + 2;
  const toUnicodeObjectNumber = fontObjectNumber + 3;
  const objects: PdfObject[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages
      .map((_, index) => `${3 + index * 2} 0 R`)
      .join(" ")}] /Count ${pages.length} >>`,
  ];

  pages.forEach((page, index) => {
    const stream = createPageStream(
      page,
      index + 1,
      pages.length,
      embeddedFont.cmap,
      usedGlyphs,
    );
    const streamObjectNumber = 4 + index * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${streamObjectNumber} 0 R >>`,
    );
    objects.push(
      `<< /Length ${encodeAscii(stream).byteLength} >>\nstream\n${stream}\nendstream`,
    );
  });

  objects.push(
    `<< /Type /Font /Subtype /Type0 /BaseFont /${PDF_FONT_NAME} /Encoding /Identity-H /DescendantFonts [<< /Type /Font /Subtype /CIDFontType0 /BaseFont /${PDF_FONT_NAME} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${fontDescriptorObjectNumber} 0 R /DW ${embeddedFont.metrics.defaultWidth} /W [${createWidthArray(
      usedGlyphs,
      embeddedFont.metrics,
    )}] >>] /ToUnicode ${toUnicodeObjectNumber} 0 R >>`,
  );
  objects.push(
    `<< /Type /FontDescriptor /FontName /${PDF_FONT_NAME} /Flags 4 /FontBBox [-1000 -1048 2928 1808] /ItalicAngle 0 /Ascent 1160 /Descent -288 /CapHeight 733 /StemV 80 /FontFile3 ${fontFileObjectNumber} 0 R >>`,
  );
  objects.push({
    dictionary: "<< /Subtype /OpenType >>",
    stream: embeddedFont.data,
  });
  objects.push({
    dictionary: "<< >>",
    stream: encodeAscii(createToUnicodeCMap(usedGlyphs)),
  });

  return Object.freeze({
    contentType: "application/pdf" as const,
    data: toPdfBytes(objects),
  });
}
