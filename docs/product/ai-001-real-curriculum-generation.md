# AI-001：Real Curriculum Generation

狀態：**Implementation Completed — Awaiting Product Review**

AI-001 建立 EduCraft AI 第一個可用的原創教材生成垂直切片：教師、機構管理員與機構擁有者可在建立教材頁輸入學習階段、年級、科目、學習主題、知識點、能力指標、教學目標、教材用途、難易度與題數，呼叫真實 AI provider 生成結構化教材草稿，完成預覽與人工編修後儲存為 Curriculum draft。

## 產品方向

EduCraft AI 在 AI-001 不再採出版社導向輸入。生成依據僅包含：

- 學習階段
- 年級
- 科目
- 學習主題
- 知識點
- 能力指標
- 教學目標
- 教材用途
- 題數
- 難易度
- 是否附解析（目前固定生成解析）

不得輸入或要求 AI 參考出版社名稱、教材版本、課本章節、教師手冊、題庫、課文、插圖、答案或解析。

## Architecture

AI-001 使用既有 BF-001～BF-003 foundation，不重建底層：

1. `lib/ai-generation`：Provider interface、prompt pipeline、structured output schema、generation pipeline、copyright safety validation。
2. `lib/ai-generation/infrastructure/openai-responses-provider.ts`：真實 OpenAI Responses API provider；不使用 OpenAI SDK，不把 API key 傳給 client。
3. `lib/curriculum/ai-generation.ts`：產品 application service，負責 server-side validation、authorization、generation、persistence 與 audit。
4. `/api/curriculums/generate`：生成 preview draft。
5. `/api/curriculums/generate/save`：將人工檢查／編輯後的 draft 儲存為 Curriculum v1 draft。
6. `/curriculums/new`：AI Generate UI、Preview、Editable draft 與 Save Draft。

## Provider

OpenAI provider 使用 `POST https://api.openai.com/v1/responses`，透過 `text.format` 的 strict JSON schema 要求模型輸出固定欄位：

- `title`
- `learningObjectives`
- `summary`
- `examples`
- `questions`
- `challengeQuestions`
- `solutions`
- `teacherNotes`
- `knowledgePoints`

必須設定 server-only：

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5
```

`OPENAI_MODEL` 可由環境調整；預設值為 `gpt-5`。未設定 API key 時 provider health fail closed，API 回傳安全錯誤，不進行 fake generation。

## Authorization

AI-001 不沿用 Sprint 7 手動建立教材的 owner/admin-only path。新增 AI 專用 permission：

- `curriculum.generate`
- `curriculum.create`

這兩個 permission 僅授予 active organization membership 中的：

- `organization_owner`
- `organization_admin`
- `teacher`

`reviewer` 仍不可生成或儲存 AI 教材草稿。

## Persistence

新增 additive migration：

- `supabase/migrations/20260728132000_ai001_create_ai_curriculum_drafts.sql`

新增：

- `curriculum_ai_drafts`：保存 version-level structured AI draft content。
- `create_ai_generated_curriculum_draft()`：受控 RPC，使用 `auth.uid()` 與 active organization context，允許 owner/admin/teacher 原子建立 Curriculum、Version 1、Chapter、Lesson 與 AI Draft record。
- `client_request_id`：由建立頁在每次成功生成後建立，用於同一 save request 的 server/database idempotency；重送同一 request 會回傳既有 draft，不會建立第二份 Curriculum。

完整教材內容存於 `curriculum_ai_drafts.content`。Lesson 僅保存摘要型 `teaching_notes`、learning objectives、difficulty 與 keywords，避免超出既有 lesson 欄位語意與長度。

## Audit

AI-001 擴充 `curriculum_lifecycle_audit_events.action` allowlist：

- `CURRICULUM_AI_GENERATED`
- `CURRICULUM_AI_EDITED`
- `CURRICULUM_AI_SAVED`

Audit adapter 使用 AP-002B `AuditWriter` 建立 receipt/hash chain material，再寫入既有 curriculum lifecycle audit table。Audit metadata 不保存 prompt、完整 provider raw response、API key、token 或學生個資。

AI audit safe metadata 僅保留操作分類、狀態與 `curriculumVersionId` 等必要關聯；不保存 raw prompt、完整 AI output、provider response body、API key、token、HTTP header 或學生個資。

## Live Verification

預設測試不呼叫付費 provider。人工產品驗證需在 Development 環境設定 server-only `OPENAI_API_KEY` 與 `OPENAI_MODEL`，套用 AI-001 migration 後，使用 owner/admin/teacher 帳號執行一次真實生成 → 預覽 → 編輯 → 儲存 → 重新開啟流程。若 key 缺漏或無法確認資料庫不是 Production，驗證必須 fail closed，不得以 mock output 代替真實驗收。

## Copyright Safety

API route 與 application service 都會執行 copyright safety validation。偵測到出版社名稱、publisher/edition/textbook、教師手冊、題庫、課文引用、課本章節或 lesson mapping 語意時 fail closed。

## Known Limitations

- 本 Package 尚未實作 streaming。
- 尚未建立 quota、cost ledger、usage persistence 或 billing integration。
- 尚未建立 AI job queue、background retry、notification 或 teacher review workflow。
- 本機若未設定 `OPENAI_API_KEY`，只能完成結構與 mock provider 測試，不能執行真實 OpenAI call 人工驗收。
- 目前儲存為 draft；publish workflow 仍由後續 Package 定義。
