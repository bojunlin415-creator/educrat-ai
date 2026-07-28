# BF-002：AI Generation Engine

狀態：Implementation Completed — Awaiting Product Review

BF-002 建立 EduCraft AI 第一個可測試的 AI 教材生成引擎 foundation。它專注於 provider abstraction、structured output、prompt pipeline、generation pipeline、validation pipeline、retry decision 與 usage model。

本 Package 不建立 UI、API、Database、Migration、Server Action 或真實 OpenAI 呼叫，也不保存 API key。

## Architecture

新增 `lib/ai-generation/`，維持 framework-neutral、interface-first、fail-closed 與 multi-provider-ready。

目錄責任：

- `shared/`：contract version、difficulty、provider status 與 branded references。
- `domain/`：GenerationRequest、GenerationContext、GenerationResult、Metadata、Usage、Error、Prompt、Retry、Structured Output 與 canonical serialization。
- `interfaces/`：`AIProvider` 與 OpenAI adapter boundary types。
- `application/`：request validation、prompt assembler、output validator、generation pipeline、retry decision、OpenAI boundary mapper／translator。

## Provider Design

`AIProvider` interface 支援：

- `generate()`
- `health()`
- `providerName()`
- `modelName()`

它不依賴 OpenAI SDK、HTTP、Next.js、Supabase 或任何 vendor-specific runtime。

## OpenAI Adapter Boundary

BF-002 只建立 OpenAI adapter boundary：

- Prompt mapper。
- Response translator。
- Error translator。

未建立 API key、SDK client、HTTP call、streaming 或 retry executor。

## Structured Output

`CurriculumGenerationSchema` 要求固定 JSON，至少包含：

- `title`
- `learningObjectives`
- `summary`
- `examples`
- `questions`
- `challengeQuestions`
- `solutions`
- `teacherNotes`
- `knowledgePoints`

自由文字、Markdown、缺少必要欄位或額外未知欄位均不接受。

## Prompt Pipeline

Prompt pipeline 包含：

- `PromptTemplate`
- `buildSystemPrompt()`
- `buildUserPrompt()`
- `assemblePrompt()`

Prompt 支援年級、科目、單元、知識點、難易度、題數與是否附解析。

Prompt 明確禁止直接引用、複製、改寫或重製出版社教材、課文、教師手冊、題庫、插圖、答案或解析，也不得要求模型模仿出版社版面、語氣或品牌可辨識內容。

## Generation Pipeline

`generateCurriculum()` 流程：

1. Input Validation
2. Prompt Build
3. Provider Health Check
4. Provider Generate
5. Structured Output Validation
6. Knowledge Mapping Validation
7. Domain Result

所有 invalid request、provider unavailable、provider exception、invalid structured output 與 invalid knowledge mapping 都 fail closed。

## Validation

Validation 分層：

- Request validator：年級、科目、單元、題數、難易度、knowledge points。
- Schema validator：固定 JSON schema。
- Knowledge mapping validator：每一道題必須映射到 request 中的 known Knowledge Point。

## Retry Policy

建立 `RetryDecision` 與 `decideRetry()`。

目前只產生 decision，不執行真正 retry、不 sleep、不排程、不呼叫 provider。

## Usage Model

`GenerationUsage` 包含：

- provider
- model
- inputTokens
- outputTokens
- estimatedCost
- latencyMs

## Testing

新增測試涵蓋：

- Prompt pipeline
- Structured output validation
- Knowledge mapping validation
- Generation pipeline
- OpenAI adapter boundary
- Retry decision
- Canonical serialization
- Architecture/import boundary

## Boundaries

未實作：

- UI
- API
- Database
- Migration
- Server Action
- React component
- Supabase
- OpenAI SDK
- real HTTP call
- API key
- background job
- persistence
- production provider configuration

## Future Integration

後續產品化需要獨立核准：

1. Concrete provider adapter。
2. Server-side API／Server Action composition root。
3. Authorization integration。
4. Audit receipt。
5. Generation persistence。
6. Cost／quota tracking。
7. Teacher review workflow。
8. Export pipeline。
