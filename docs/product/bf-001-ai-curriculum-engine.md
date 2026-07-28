# BF-001：AI Curriculum Engine MVP

狀態：Implementation Completed — Awaiting Product Review

BF-001 建立 EduCraft AI 第一版 AI Curriculum Engine 產品基礎。它提供原創教材生成所需的輸入模型、知識點模型、Prompt Builder、教材模板、列印版面描述、教材驗證與預覽資料結構。

本 Package 不呼叫 OpenAI 或任何外部模型，不建立資料庫表格，不保存 Prompt／Generation metadata，不建立正式 UI、API、Server Action、Learning Analytics、題庫、試卷、商業流程或背景工作。

## Product Goal

EduCraft AI 的 AI 能力以「原創教材生成」為核心，而不是單純 AI 出題。MVP foundation 支援教師依據台灣 108 課綱、年級、科目、單元、知識點、難易度、題數與是否附解析，建立可預覽、可列印、可驗證的教材結構。

## Input Model

`CurriculumGenerationInput` 包含：

- `grade`：國小 1–6 年級。
- `subject`：科目文字。
- `legacyPublisherReference`：legacy compatibility input，只能被轉換成中性 Curriculum Reference label。
- `book`：冊次。
- `unit`：單元。
- `knowledgePoints`：至少一個 Knowledge Point。
- `difficulty`：`EASY`／`MEDIUM`／`HARD`。
- `questionCount`：1–50 題。
- `includeExplanations`：是否要求解析。

## Curriculum Reference Boundary

使用者可能仍以既有「教材版本」語言輸入需求，但 BF-001 不將出版社身份交給 AI context。

Legacy input 只在 application boundary 轉成：

- 課綱通用版
- 教學進度模板 1
- 教學進度模板 2
- 教學進度模板 3

Prompt Builder 不輸出出版社名稱、代碼或可辨識 mapping details，符合 AR-001 與 AI Reference Policy。

## Knowledge Point Model

`KnowledgePoint` 至少包含 `id`、`code`、`title`、`description` 與 `competencyIndicator`。

每一道教材題目都必須對應至少一個 `knowledgePointId`。Validator 會拒絕未映射知識點或指向未知知識點的題目。

## Curriculum Structure

`GeneratedCurriculum` 包含標題、教學目標、重點整理、範例、練習題、挑戰題、解答與教師提醒。

目前的資料結構只代表模型回應通過 schema 之後的目標形狀，不代表已接入真實 AI provider。

## Prompt Builder

`buildCurriculumPrompt()` 產生 framework-neutral Prompt Contract。

系統訊息明確要求：

- 原創生成。
- 不複製、改寫、引用或重製出版社內容。
- 不使用 OCR。
- 不使用教師手冊、題庫、插圖、答案或解析。
- 依據公開課綱、能力指標與知識點生成。
- 每一道題必須標示 Knowledge Point ID。

## Print Layout Engine

`buildPrintableLayout()` 產生 PDF-ready layout descriptor：

- A4。
- PDF export target。
- 頁首。
- 頁尾。
- 題號。
- 作答留白行數。
- 固定教材章節順序。

本 Package 不產生實際 PDF 檔案，也不接 `lib/exports/`。

## Validation

`validateGenerationInput()` 驗證必填欄位、年級、難易度、題數與 Knowledge Point 存在。

`validateGeneratedCurriculum()` 驗證必填教材段落、題數、題目知識點映射、題目難易度、A4／PDF-ready 版面完整與題目作答空間。

## Preview

`createCurriculumPreview()` 建立教師預覽資料，包含教學目標、重點整理、練習題、挑戰題、教師提醒與 Printable Layout。

這不是正式 UI，只是後續 UI／Server Action 可使用的 preview contract。

## Testing

新增測試涵蓋 Curriculum model immutability、Prompt Builder 原創性與品牌去識別化、Validation success／failure、A4 PDF-ready print layout、Canonical serialization 與 Import boundary。

## Boundaries

本 Package 未實作 AI provider 呼叫、AI 自動分析、Learning History、BI、家長端、金流、訂閱、加盟、CRM、Database、Migration、API、Server Action、正式 UI 或 PDF binary generation。

## Future Integration Points

後續產品化至少需要 AI Provider Adapter 與模型輸出 schema、Server Action／API authorization、Audit receipt、Knowledge Graph persistence、Teacher review workflow、PDF/DOCX export provider、Usage／cost tracking、Quality gate 與內容安全檢查。
