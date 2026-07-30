# Changelog

## 2026-07-30 — RP-001：Reporting Foundation（Awaiting Product Review）

### Reporting foundation

- 新增 `lib/reporting/`，包含 Student／Teacher／Organization report view model、mastery summary aggregation、average calculation 與 PDF／Excel／CSV export contract foundation。
- 新增 `report_audit_events` 與 optional `report_cache` additive migration；Reporting 不新增新的 analytics source table，也不修改 AN-001 Learning tables。
- 新增 `/api/reports/student`、`/api/reports/teacher`、`/api/reports/organization` 與 `/api/reports/export-options` server-side API。
- Dashboard 與未來 report consumer 必須透過 Reporting Service，不得直接查詢 Learning Analytics tables。
- 新增 `REPORT_VIEWED` 與 `REPORT_EXPORTED` audit event vocabulary；目前 view endpoints 寫入 `REPORT_VIEWED`，真正 export execution 留待後續 package。

### Boundaries

- 未建立 Teacher Dashboard UI、Parent Dashboard UI、Organization Dashboard UI、Charts、real PDF／Excel／CSV renderer、Scheduled Reports、Email Reports、Notification、cache invalidation job 或 Production migration。
- 未修改 AI-001、EX-001、PB-001、AS-001、CL-001、AN-001 或 AI-002 既有流程；未 commit、push、deploy 或操作 Production。

## 2026-07-30 — AI-002：Adaptive Learning Engine（Completed and Git Sealed）

### Adaptive learning foundation

- 新增 `lib/adaptive-learning/`，包含 Weak Knowledge Detection、Knowledge Gap Analysis、Adaptive Difficulty、Learning Recommendation、Learning Path Recommendation、AI-001 handoff interface 與 server-side recommendation service。
- 新增 `learning_recommendations`、`learning_paths` 與 `learning_recommendation_audit_events` additive migration。
- 新增 `/api/recommendations/student`、`/api/recommendations/path`、`/api/recommendations/weak-knowledge` 與 `/api/recommendations/difficulty` server-side API。
- Recommendation 依 AN-001 Learning Analytics 產生；本 Sprint 不直接呼叫 AI-001 或 OpenAI，不生成教材。
- 新增 `LEARNING_RECOMMENDATION_CREATED` 與 `LEARNING_PATH_VIEWED` audit events。

### Boundaries

- 未建立 Dashboard、Charts、Parent Report、Teacher Dashboard、Organization Dashboard、Notification、Background Scheduler、AI provider call、教材自動生成或完整 Knowledge Graph prerequisite engine。
- 未修改 AI-001、EX-001、PB-001、AS-001、CL-001 或 AN-001 既有流程；已 Git Sealed；未 deploy 或操作 Production。

## 2026-07-30 — AN-001：Student Learning Analytics Foundation（Completed and Git Sealed）

### Learning analytics foundation

- 新增 `lib/learning-analytics/`，包含 Learning Event domain、Knowledge Mastery、Subject Summary、Teacher Class Summary、validation、aggregation service 與 safe API response boundary。
- 新增 `learning_events`、`student_knowledge_mastery`、`student_subject_summary`、`teacher_class_summary` 與 `learning_audit_events` additive migration。
- 新增 `/api/learning/events`、`/api/learning/student/summary`、`/api/learning/student/timeline`、`/api/learning/knowledge`、`/api/learning/teacher/classes/[classId]/summary` 與 `/api/learning/teacher/classes/[classId]/weak-knowledge` server-side API。
- Learning Event 為 immutable append-only event；Knowledge Mastery、Subject Summary 與 Teacher Class Summary 為可重建 projection。
- 新增 `LEARNING_EVENT_CREATED` 與 `LEARNING_SUMMARY_VIEWED` audit events。

### Boundaries

- 未建立 AI Recommendation、Dashboard、Charts、Parent Report、Teacher Dashboard、Organization Dashboard、Adaptive Learning、background aggregation job 或 Production migration。
- 未修改 AI-001、EX-001、PB-001、AS-001 或 CL-001 既有流程；未 commit、push、deploy 或操作 Production。

## 2026-07-30 — CL-001：Class & Enrollment Foundation（Awaiting Product Review）

### Class and enrollment foundation

- 新增 `lib/classroom/`，包含 Class domain、Enrollment domain、validation、service 與 safe API response boundary。
- 新增 `classes`、`class_enrollments`、`assignment_classes` 與 `classroom_audit_events` additive migration。
- 新增 `/api/classes`、`/api/classes/[id]`、`/api/classes/[id]/enrollments`、`/api/classes/[id]/enrollments/[studentId]`、`/api/classes/teacher` 與 `/api/classes/student` server-side API。
- Assignment integration 新增 `classIds` target，班級派發會 materialize active class enrollments 到 `assignment_students`；Assignment 仍固定綁定 published Curriculum Version。
- 新增 `CLASS_CREATED`、`CLASS_UPDATED`、`CLASS_ARCHIVED`、`ENROLLMENT_CREATED` 與 `ENROLLMENT_REMOVED` audit events。

### Boundaries

- 未建立 Attendance、Timetable、Learning Analytics、Dashboard、Parent Portal、AI Recommendation、Assistant Teacher、批改或報表流程。
- 未修改 AI-001、EX-001、PB-001 既有流程；AS-001 僅做 class target integration；已 Git Seal，未 deploy 或操作 Production。

## 2026-07-29 — AS-001：Assignment Foundation（Awaiting Product Review）

### Assignment foundation

- 新增 `lib/assignment/`，包含 Assignment domain、Student Assignment status、Submission foundation、validation、service 與 safe API response boundary。
- 新增 `assignments`、`assignment_students`、`assignment_submissions` 與 `assignment_audit_events` additive migration。
- Assignment 固定綁定 published `curriculum_version_id`，不得引用 `latest`。
- 新增 `/api/assignments`、`/api/assignments/[id]`、`/api/assignments/[id]/students`、`/api/assignments/student` 與 `/api/assignments/[id]/submission` server-side API。
- 新增 `ASSIGNMENT_CREATED`、`ASSIGNMENT_UPDATED`、`ASSIGNMENT_ASSIGNED` 與 `ASSIGNMENT_SUBMITTED` audit events。

### Boundaries

- 未建立 AI 分析、Learning Analytics、家長報表、Dashboard、AI 推薦、Class／Enrollment persistence、通知、批改或分數報表。
- 未修改 AI-001、EX-001 或 PB-001 既有流程；已 Git Seal，未 deploy 或操作 Production。

## 2026-07-29 — PB-001：Curriculum Publish Foundation（Awaiting Product Review）

### Curriculum publish workflow

- 新增正式 Curriculum lifecycle：`draft`／`in_review`／`published`／`archived`，不使用 `published=true` boolean。
- 新增 server-side Submit Review、Review／Approve、Publish、Reopen Draft、Create New Version routes。
- 新增 publish validation：title、learning objectives、question count、question numbering、answer mapping、knowledge point mapping、metadata、version 與 tenant 檢查。
- 新增 version lock：Review／Published／Archived 唯讀，Published／Archived 修改需建立下一個 draft version。
- 新增教材詳細頁 status badge 與 publish workflow actions。
- 新增 `CURRICULUM_SUBMITTED`、`CURRICULUM_REVIEWED`、`CURRICULUM_PUBLISHED` audit action support。

### Boundaries

- Teacher 可送審；Reviewer 可審閱；Organization Owner/Admin 可發布、封存與建立新版本。
- 不允許 client 以表單直接切換 publish status；狀態轉換走 server-side lifecycle routes。
- 未開始 AI-002、通知、Queue、Background Job、Platform review 或跨 Entity publish orchestration。
- 未 commit、push、deploy 或操作 Production。

## 2026-07-29 — EX-001：Curriculum Export Foundation（Awaiting Product Review）

### Curriculum export

- 新增 framework-neutral `lib/curriculum-export/`，包含 `CurriculumExportDocument`、metadata、section、question、answer、mode、validation、deterministic serialization 與 safe filename helper。
- 新增第一版 runtime PDF renderer，支援 A4 portrait、黑白列印友善、頁首、頁碼、worksheet 作答欄位、answer sheet 與 combined page break。
- 新增 `GET /api/curricula/{curriculumId}/versions/{versionId}/export?mode=worksheet|answer-sheet|combined`，成功回傳 `application/pdf` 與安全檔名。
- 新增 Browser Print Preview，使用同一份 `CurriculumExportDocument`，不另外維護 print-only data source。
- 匯出只讀取已儲存 Curriculum Version；AI draft export 讀取 `curriculum_ai_drafts.content`，不輸出未儲存 preview、AI raw response、prompt 或 provider metadata。
- 新增 `curriculum.export` authorization permission，owner/admin/teacher 可匯出；cross-tenant 與 missing version fail closed。
- 新增 `CURRICULUM_EXPORTED` audit action，metadata 僅保存 curriculumId、curriculumVersionId、exportMode 與 outputFormat，不保存 PDF binary、完整教材內容或答案。

### Boundaries

- 未修改 AI-001 prompt、provider、validator 或 generation flow。
- 未建立 public storage、永久 PDF、background job、DOCX、AI-002、deploy 或 Production 操作。

## 2026-07-28 — AI-001：Real Curriculum Generation（Awaiting Product Review）

### Real AI curriculum generation

- 新增真實 OpenAI Responses provider，使用 strict JSON schema 輸出原創教材草稿，不依賴 OpenAI SDK，也不將 API key 暴露到 client。
- 新增 `POST /api/curriculums/generate`，支援 learning stage、grade、subject、curriculum topic、knowledge points、competency indicators、learning objectives、purpose、difficulty、question count 與 language。
- 新增 `POST /api/curriculums/generate/save`，將教師審閱／編輯後的草稿儲存為 Curriculum draft、Version 1、Chapter、Lesson 與 version-level `curriculum_ai_drafts`。
- 新增 `/curriculums/new` 的 AI Generate／Preview／Editable Draft／Save Draft flow。Owner/admin 仍可手動建立空白教材；teacher 可使用 AI 生成與儲存草稿；reviewer 不可生成或儲存。
- 新增 additive migration `20260728132000_ai001_create_ai_curriculum_drafts.sql`，建立 `curriculum_ai_drafts`、同一 save request 的 `client_request_id` idempotency、受控 `create_ai_generated_curriculum_draft()` RPC，以及 AI audit action allowlist。
- 新增 `CURRICULUM_AI_GENERATED`、`CURRICULUM_AI_EDITED`、`CURRICULUM_AI_SAVED` audit event；Audit metadata 僅保存 safe relationship metadata（例如 curriculum version id），不保存 prompt、provider raw response、API key、token 或完整學生資料。
- 新增 AI-001 API、provider、UI 與 migration tests。

### Boundaries

- 未修改歷史 Migration；未使用 Service Role；未放寬既有手動 Curriculum create/edit RPC。
- 未加入出版社資料、教材版本 mapping、課本章節、OCR、教師手冊、題庫或出版社導向 prompt。
- 未建立 streaming、AI job queue、background retry、usage/cost persistence、billing、PDF export、publish workflow、worksheet/assessment generation 或 learning analytics。
- 狀態為 **Implementation Completed — Awaiting Product Review**；未 commit、push、deploy 或操作 Production。

## 2026-07-28 — PI-001：Curriculum Delete & Recycle Bin Integration（Awaiting Product Review）

### Curriculum lifecycle product integration

- 新增 Curriculum-only soft delete 欄位、回收桶索引與受控 fixed-search-path lifecycle RPC。
- 新增 append-only `curriculum_lifecycle_audit_events`，並透過 AP-002B `AuditWriter` adapter 產生 lifecycle audit receipt 與 hash chain material。
- 新增 Curriculum product authorization adapter，使用 server-resolved authenticated account、active organization membership 與 role 建立 trusted authorization context，再檢查 `curriculum.archive`、`curriculum.delete`、`curriculum.restore`、`curriculum.permanently_delete` 與 `recycle_bin.read`。
- 新增 AP-002F product adapter，將 deleted curriculum row 映射為 `RecycleEntry`，並使用 restore／permanent deletion evaluator fail closed。
- 新增教材詳細頁 Danger Zone、教材列表 lifecycle actions、`/curriculums/recycle-bin` 回收桶頁，以及 archive／restore／delete／permanent-delete API routes。
- 一般教材列表、詳細頁與既有 GET API 排除 `deleted_at is not null` 的教材；回收桶頁僅顯示目前 active organization 的 deleted curricula。
- 新增 forward-only partial unique index migration，讓 deleted curriculum 不再占用同 organization 內的 active curriculum name；restore 若遇同名 active curriculum，回傳安全 `restore_name_conflict` domain error。
- 新增 lifecycle RPC role-check follow-up migration，讓 archive／restore／soft delete／permanent delete RPC 使用 caller-bound `auth.uid()` 直接驗證 active owner/admin membership，避免 lifecycle write 在 RPC chaining 情境 fail closed。

### Boundaries

- 未修改歷史 Migration；新增 migration 為 additive。
- 未開始 Lesson、Worksheet、Assessment、Student、Class、Organization Closing、Account Deletion、AI、Background Job、Platform Admin Console 或 platform-wide recycle bin。
- 未建立 Service Role cleanup、未放寬 RLS、未加入出版社資料或 AI provider。
- 狀態為 **Implementation Completed — Awaiting Product Review**；未 commit、push、deploy 或操作 Production。

## 2026-07-28 — BF-003：Original Curriculum Generation（Awaiting Product Review）

### Original curriculum direction

- AI 產品 foundation 正式移除教材版本、出版社進度參考、冊次、Lesson Mapping 與 Unit Mapping 語意。
- BF-001 generation input 改為 learning stage、grade、subject、curriculum topic、unit、competency indicators、learning objectives、purpose、knowledge points、difficulty、question count與include explanations。
- BF-002 generation context 與 prompt pipeline 改用 Curriculum Topic、Knowledge Point、Competency Indicator、Learning Objective 與教材用途。
- 新增 Curriculum Topic／Competency Indicator／Learning Objective／Topic Hierarchy domain model。
- 新增 `generateOriginalCurriculum()` 語意入口，並在 provider call 前執行 prompt copyright safety validation。
- 新增 Copyright Safety Validation，偵測出版社名稱、教師手冊、題庫、課文引用、課本章節或 mapping 語意時 fail closed。

### Boundaries

- 未新增出版社 mapping、教材比對、OCR、課本章節、Lesson Code、Unit Mapping、真實 AI provider call、API、UI、Database、Migration、Audit 或 Authorization product integration。
- 狀態為 **Implementation Completed — Awaiting Product Review**；未 commit、push、deploy 或操作 Production。

## 2026-07-28 — BF-002：AI Generation Engine（Awaiting Product Review）

### AI generation foundation

- 新增 framework-neutral `lib/ai-generation/`，包含 GenerationRequest／Context／Result／Metadata／Usage／Error domain model。
- 新增 `AIProvider` interface，支援 `generate()`、`health()`、`providerName()` 與 `modelName()`，不依賴 OpenAI SDK 或 HTTP。
- 新增 OpenAI adapter boundary mapper／response translator／error translator；未建立 API key、SDK client 或真實 API call。
- 新增固定 JSON `CurriculumGenerationSchema`，要求 title、learningObjectives、summary、examples、questions、challengeQuestions、solutions、teacherNotes、knowledgePoints。
- 新增 Prompt Pipeline、Generation Pipeline、Output Validator、Knowledge Mapping Validator、Retry Decision 與 Usage model。
- 新增 Prompt、Structured Output、Generation Pipeline、OpenAI Boundary、Retry、Serialization 與 Architecture/import boundary tests。

### Boundaries

- 未新增 UI、API、Database、Migration、Server Action、React component、Supabase、OpenAI SDK、HTTP call、API key、background job、persistence 或 production provider configuration。
- 狀態為 **Implementation Completed — Awaiting Product Review**；未 commit、push、deploy 或操作 Production。

## 2026-07-27 — BF-001：AI Curriculum Engine MVP（Awaiting Product Review）

### AI curriculum foundation

- 新增 framework-neutral `lib/ai-curriculum/`，包含 generation input、Knowledge Point、Generated Curriculum、Prompt、Printable Layout、Validation 與 Preview contract。
- 新增 Prompt Builder，明確要求依公開課綱、能力指標與知識點原創生成，禁止複製、改寫、引用或重製出版社課文、教師手冊、題庫、插圖、答案或解析。
- Legacy 教材版本 input 僅轉為中性「課綱通用版／教學進度模板 1～3」label；AI Prompt 不輸出出版社名稱、code 或 mapping details。
- 新增 Curriculum Template、A4／PDF-ready Print Layout descriptor、Curriculum Validator 與 canonical serializer。
- 新增 Curriculum model、Prompt Builder、Validation、Print Layout、Serialization 與 import boundary tests。

### Boundaries

- 未新增 AI provider call、Database、Migration、Supabase、RLS、API、Server Action、正式 UI、PDF binary export、Learning History、BI、家長端、金流、訂閱、加盟或 CRM。
- 狀態為 **Implementation Completed — Awaiting Product Review**；未 commit、push、deploy 或操作 Production。

## 2026-07-27 — AP-002F：Recycle Bin Foundation（Awaiting Architecture Review）

### Recycle bin foundation

- 新增framework-neutral `lib/recycle-bin/`，包含versioned Recycle Entry、Restore Request、Permanent Deletion Request、Purge Eligibility、Restore／PermanentDeletion Decision與machine-readable error。
- 新增construction-only Registry、interface-only pure Recycle Bin Policy port，以及固定執行validation → recycle entry → retention/dependency/hold gate → policy → decision的fail-closed Evaluator。
- 新增unknown resource/transition/version/field、invalid entry/lifecycle state/request/policy output、duplicate vocabulary與payload-shaped extra field驗證。
- 新增依object key穩定排序的canonical Recycle Bin serializer；不計算hash、不保存payload。
- 新增Model、Registry、Validation、Serialization、Evaluator integration、immutability、architecture/import boundary與module circular dependency tests。

### Boundaries

- 未新增Database、Migration、Repository、Supabase、RLS、API、UI、Server Action、actual restore、soft delete、hard delete、storage deletion、background job、notification、queue或產品Business Rule。
- ALLOWED只代表Recycle Bin Foundation Policy通過，不代表restore/delete/purge已執行，或Authorization／Lifecycle／Dependency／Retention／Legal Hold／Re-auth／Audit／Approval／transaction門檻已完成。
- 狀態為 **Implementation Completed — Awaiting Architecture Review**；未commit、push、deploy、操作Production、開始BF-003或任何後續產品Package。

## 2026-07-23 — AP-002E：Re-authentication Boundary Foundation（Accepted and Git Sealed）

### Re-authentication boundary foundation

- 新增framework-neutral `lib/re-authentication/`，包含versioned Re-authentication Requirement、Risk Level、Challenge Reference、Check Request／Decision與machine-readable error。
- 新增construction-only Registry、interface-only pure Re-authentication Policy port，以及固定執行validation → requirement resolution → challenge validation → policy → decision的fail-closed Evaluator。
- Missing required challenge只回傳machine-readable `challengeRequired`；Foundation不驗證credential、不讀session、不刷新session。
- 新增unknown action/challenge type/version/field、invalid requirement/risk level/metadata/challenge/policy output、duplicate vocabulary/requirement、wrong challenge type與credential-shaped payload驗證。
- 新增依object key穩定排序的canonical Re-authentication serializer；不計算hash、不保存payload。
- 新增Model、Registry、Validation、Serialization、Evaluator integration、immutability、architecture/import boundary與module circular dependency tests。

### Boundaries

- 未新增Login、MFA、OTP、Password verification、WebAuthn、Session refresh、Credential verifier、Clock、receipt repository、Database schema、Migration、RLS、API、UI、Server Action、Purge、Archive、Restore、Delete、Recycle Bin、Audit write或產品Business Rule。
- ALLOWED只代表Re-authentication Boundary Policy通過，不代表credential已驗證、freshness window已滿足、Lifecycle write已授權，或Authorization／Dependency／Retention／Legal Hold／Audit／Approval／transaction門檻已完成。
- 狀態為 **Accepted and Git Sealed**；已建立 Git Seal commit 並 push 至 `origin/develop`。未deploy、操作Production、開始BF-003或任何後續產品Package。

## 2026-07-23 — AP-002D：Retention & Legal Hold Foundation（Accepted and Git Sealed）

### Retention runtime foundation

- 新增framework-neutral `lib/retention/`，包含versioned Retention Definition／Rule、bounded Period、safe Metadata、Legal Hold Reference、Check Request／Decision與machine-readable error。
- 新增construction-only Registry、interface-only pure Retention Policy port，以及固定執行validation → rule resolution → legal hold gate → policy → decision的fail-closed Evaluator。
- Active Legal Hold在Policy前直接拒絕；新增unknown resource/category/transition/version/field、invalid rule/period/metadata/hold/policy output、duplicate vocabulary/resource/hold與cross-resource hold驗證。
- 新增依Rule、metadata與Hold穩定排序的canonical Retention Snapshot serializer；不計算hash、不保存payload。
- 新增Model、Registry、Validation、Serialization、Evaluator integration、immutability、architecture/import boundary與module circular dependency tests。

### Boundaries

- 未新增法定期限、jurisdiction／plan／產品Retention Rule、Clock／retention anchor、Legal Hold repository、Database schema、Migration、RLS、API、UI、Purge、Archive、Restore、Delete、Recycle Bin、Audit write或產品Business Rule。
- ALLOWED只代表Retention／Hold Policy通過，不代表期間已屆滿、Lifecycle write已授權，或Authorization／Dependency／Audit／Re-auth／Approval／transaction門檻已完成。
- 狀態為 **Accepted and Git Sealed**；已建立 Git Seal commit 並 push 至 `origin/develop`。未deploy、操作Production、開始BF-003或任何後續產品Package。

## 2026-07-23 — AP-002C：Dependency Protection Foundation（Accepted and Git Sealed）

### Dependency runtime foundation

- 新增framework-neutral `lib/dependency/`，包含versioned vocabulary、immutable directed Dependency Reference、Check Request／Result／Evaluation與machine-readable error。
- 新增construction-only Registry、interface-only async Dependency Graph／pure Policy ports，以及固定執行validation → graph → policy → decision的fail-closed Evaluator。
- 新增unknown resource/dependency/transition/version／field、duplicate normalized edge、direct/indirect cycle、disconnected fragment與invalid provider output驗證。
- 新增依有向edge穩定排序的canonical Dependency Snapshot serializer；不計算hash、不保存payload。
- 新增Model、Registry、Validation、Serialization、Evaluator integration、immutability、architecture/import boundary與module circular dependency tests。

### Boundaries

- 未新增產品vocabulary／policy、concrete Graph adapter、Database schema、Migration、RLS、API、UI、Server Action、Archive、Restore、Delete、Recycle Bin、Audit write或產品Business Rule。
- ALLOWED只代表Dependency Policy通過，不代表Lifecycle、Authorization、Audit、Retention、Legal Hold、Re-auth、Approval、transaction或write門檻已完成。
- 狀態為 **Accepted and Git Sealed**；未deploy、操作Production、開始BF-003或任何下一個Package。

## 2026-07-22 — AP-002A：Lifecycle Schema Foundation（Accepted and Git Sealed）

### Lifecycle runtime foundation

- 新增framework-neutral `lib/lifecycle/`，包含versioned State、explicit Transition、Requirements、immutable Decision、Definition與machine-readable error。
- 新增interface-only Lifecycle Definition Provider／Policy ports、immutable Static Provider snapshot、construction-only Registry與fail-closed Evaluator。
- 建立Draft、Published、Archived、Trashed、Deleted核心vocabulary及六個顯式transition；禁止wildcard、implicit jump、duplicate route與terminal outgoing。
- 新增exact-key validation與canonical Lifecycle Definition serializer；unknown field/state/transition/intent/version、invalid requirement／policy result與accessor一律fail closed。
- 新增State、Transition、Registry、Decision、Validation、Serialization、Evaluator integration、immutability、architecture/import boundary與circular dependency tests。

### Boundaries

- Requirements只描述Audit、Authorization、Dependency、Re-authentication、Retention與Legal Hold門檻，不執行任何外部能力或產品write。
- 未新增Database schema、Migration、RLS、RPC、API、UI、Server Action、Archive、Restore、Delete、Recycle Bin、Dependency Protection或產品Business Rule。
- 未接入Audit persistence、Authorization product enforcement、Curriculum/Lesson或BF-003；未deploy或操作Production。
- 狀態為 **Accepted and Git Sealed**；AP-002C、BF-003與後續Package未開始。

## 2026-07-22 — AP-002B：Immutable Audit Foundation（Accepted and Git Sealed）

### Audit runtime foundation

- 新增framework-neutral `lib/audit/`，包含immutable Audit Event／Receipt、machine-readable error、metadata allowlist、fail-closed validation與canonical serializer。
- 新增interface-only Clock、Event ID、Hash Chain與Audit Repository ports；沒有Database、Supabase或external storage implementation。
- 新增Audit Writer，固定執行validation、chain-head verification、canonical hash material、hash validation、frozen event、atomic append expectation與minimal receipt。
- Repository append contract要求expected previous hash，以便未來persistence adapter用compare-and-set阻止parallel chain fork。
- 新增hash determinism、receipt、validation、serialization、immutability、writer failure、architecture/import boundary與circular dependency tests。

### Boundaries

- 未新增Database schema、Migration、RLS、API、UI、Server Action、Middleware、Curriculum/Lesson功能或任何Archive／Delete／Restore產品流程。
- 未建立production crypto/persistence adapter、transaction/outbox、Retention、Legal Hold、external archive或Audit Console；BF-003仍未開始。
- 架構已核准並完成Git Seal；未deploy或操作Production。

## 2026-07-21 — AP-004C-B：Trusted Authorization Context Adapter（Accepted and Git Sealed）

### Trusted context boundary

- 移除 `AuthorizeRequest.context`，`authorize()`、Server helper 與 API helper 改由必要的 `AuthorizationContextProvider` 取得 context。
- 新增 interface-only Identity、Membership、Persona、Role 與 Permission Grant authority ports；沒有 Session、Supabase 或 Database concrete adapter。
- 新增 cross-source validation、provider-issued trusted envelope、whitelist copy 與 immutable context，拒絕 caller 直接注入 role、permission、organization 或 grant scope。
- 新增 forged Identity／Membership／Organization／Permission／Permission authority／Scope、missing Identity／Membership 及 forged envelope fail-closed 測試。

### Boundaries

- 未新增 Database schema、Migration、RLS、API route、middleware、React hook、UI、Audit、Lifecycle 或產品 business rule；未操作 Production。
- 架構已核准並完成Git Seal；未deploy、操作Production或開始Curriculum lifecycle。

## 2026-07-21 — AP-004C-A：Minimal Authorization Adapter（Accepted and Git Sealed）

### Application integration

- 新增唯一 `authorize()` Application entry，委派既有 AP-004B engine，不重複 Permission／Scope／Policy decision logic。
- 新增 AuthorizationContext Factory 與既有 Provider 共用的 immutable context assembly；其 caller-supplied contract 已由 AP-004C-B 收斂為 trusted provider contract。
- 新增 framework-neutral `authorizeServerAction()` 與 `authorizeApiRequest()`，以及 machine-readable Forbidden／Unauthenticated／Invalid Context errors。
- 新增 Unit／Integration／Architecture tests，驗證 allow／deny、context 錯誤、evaluator 單次呼叫、import boundary、layer direction、無循環依賴及 Adapter 不繞過 `authorize()`。

### Boundaries

- 未建立真正 Server Action、API Route、middleware、React hook、Session／Cookie adapter、Supabase／Database query、RLS integration、Audit、Catalog adapter、產品 business rule 或 Curriculum Delete。
- 沒有 Database schema 或 Migration 變更，未操作 Production；架構已核准並完成Git Seal，未開始BF-003。

## 2026-07-20 — AP-004B：Permission Resolver & Policy Engine（Accepted and Git Sealed）

### Runtime implementation

- 新增純函式 Permission Resolver、17 類 Scope Compatibility Evaluator、immutable Policy／Condition model、Policy Resolver 與 Authorization Decision Engine。
- 正式 PermissionKey 與 224-key Catalog 不變；`resource.*`／`*` 僅為獨立 runtime policy expression，且不能在缺少 exact context grant 時自行授權。
- 實作 active tenant Membership、organization isolation、explicit lineage、Person／Profile／Persona／Own／Managed relationship evidence、default deny、fail closed 與 deterministic DENY override。
- Condition 僅允許 equals／notEquals／includes／exists／all／any；不執行 JavaScript、SQL、網路、檔案或任何動態程式。

### Boundaries

- 未新增 Catalog adapter、Membership／Role／Persona query、API／middleware／Server Action／UI guard、Audit persistence、Database、Migration、Supabase、RLS、JWT、Session 或 OAuth 整合。
- 既有 Server authorization 與 RLS 仍是現行 authority；AP-004B 已完成架構核准與 Git Seal，未 deploy、操作 Production 或開始 AP-004C。

## 2026-07-17 — AP-004A：Authorization Runtime Foundation（Accepted）

### Runtime contracts

- 新增 framework-neutral `lib/authorization/`，包含 AuthorizationContext、machine-readable Decision／Reason／Result／Error、branded `resource.action` PermissionKey 與 17 類 ResourceScope vocabulary。
- 新增 PermissionResolver／PolicyResolver interfaces 及 constructor-injected AuthorizationProvider；provider 只建立不可變 context，不查資料、不呼叫 resolver，也不判斷 ALLOW／DENY。
- 新增單元與架構測試，驗證 permission 格式、decision vocabulary、scope 清單、context isolation、禁止依賴與循環依賴。

### Boundaries

- AP-003B 已是核准的 Architecture baseline；AP-004A 不內建 224-key Catalog，不建立 role assignment、Policy Engine、Scope Resolver、API／middleware enforcement、Audit runtime、Database、Migration、RLS、UI、JWT、Session 或 OAuth 變更。
- 現有 server authorization 與 RLS 繼續生效；AP-004B 未開始，Production 未操作。

## 2026-07-17 — AP-003B：Authorization Architecture Baseline（Proposed）

### Architecture

- 建立人類 Platform／Organization／Academic／Student／Family role templates，並將 AI execution profiles 與 Service Principal workload roles隔離。
- 建立 224 個受控 `resource.action` Permission Catalog，不使用 `isAdmin`、`isOwner` 或其他 Boolean permission。
- 定義 Platform、Organization、Campus、School、Grade、Class、Course及教材／學生／報表等 Resource Scope ownership、inheritance與租戶隔離。
- 定義 `Request → Identity → Membership → Persona → Role → Permission → Scope → Business Rule → Decision → Audit` 的 fail-closed Policy Decision 與 Allow／Deny／Conflict／Fallback規則。
- 建立 least privilege、explicit grant、delegation、temporary access、re-auth、CASE、break-glass、AI authorization及 Entitlement boundary安全契約。
- 提出 versioned hybrid、legacy role backfill、shadow evaluation、dual-write、RLS與 forward-only correction Migration Design；沒有建立 Migration 或 schema。

### Documents and limits

- 新增 AP-003B 與 ADR-010～013、Permission Catalog、Authorization Security Model及 Authorization Migration Design。
- 更新 README、產品、系統、資料庫、測試、Capability Map、Event Catalog與Architecture Backlog。
- 狀態為 **Proposed — Awaiting Architecture Approval**；沒有修改 Production code、UI、test、OAuth、Session、JWT、Database、RLS、API或Migration，未開始 AP-004或Sprint 9。

## 2026-07-17 — EP-001：Development E2E Test Isolation

### Testing

- Curriculum E2E 改用 timestamp、worker、process 與 Node `randomUUID()` 組成的 run-scoped identifier，不再重用固定 Email 衍生的教材名稱。
- 重複名稱案例由當次測試自行建立兩份教材並驗證正式 HTTP 409；正常更新另使用唯一名稱，且重新整理後資料仍存在。
- 採「唯一命名、不清理」策略；未使用 Service Role、bypass RLS、資料庫清空、真實資料刪除或 timeout 放寬。
- Final validation：Curriculum 單項 1/1、完整 Playwright 連續兩次 4/4、單執行緒 Unit／Integration 182 項，以及 Typecheck、Lint、Build、Prettier、安全與 Migration 檢查均通過。

## 2026-07-16 — AP-003A Final Architecture Approval & Git Seal

### Approval

- AP-003A 狀態更新為 **Accepted — Architecture Approved**；ADR-008 與 ADR-009 更新為 **Accepted**。
- Identity Security、Privacy、Migration Design 與 UX 成為 **Approved Architecture Baseline — Not Implemented**。
- 核准 Account／Person／Profile／Membership／Persona分離、受控 linking／merge、Managed Student／Guardian無 Account、Platform/Organization authority隔離與 additive migration策略。

### Architecture

- 定義 Authentication Account、Auth Identity、canonical Person、Profile、Organization Membership、Domain Persona、Guardian Relationship、Platform Role Assignment 與 Service Principal 邊界。
- 推薦預設一 Account 對一 Person、例外受控 linking／merge；Email 不作 Person ID，Managed Student／Guardian 可以沒有 Account。
- 定義 Account／Person／Profile／Membership／Persona／Auth Identity lifecycle、匿名化、tombstone、資料 ownership、未成年與跨機構隱私規則。
- 建立 Identity API／Service contract、Account／Persona／Student claim／Guardian／elevated identity wireframe，以及 additive/backfill/dual-read/dual-write Migration Design。
- Account hard delete保持關閉是正式安全政策；Person link、dependency inventory、tombstone、Audit、Retention/Hold、ownership reassignment、anonymization與background job均為前置門檻。
- Curriculum Delete確認尚未實作；其 Role/Permission、Audit、Lifecycle、Dependency、Recycle Bin與background deletion分別交由 AP-003B、AP-002B/A/C/F與AP-004。

### 文件

- 新增 AP-003A、ADR-008～009、Identity Security、Identity Privacy、Identity UX 與 Identity Migration Design。
- 更新 README、產品、系統、資料庫、測試、Capability Map、Event Catalog 與 Architecture Backlog，標示核准但未實作的邊界。

### 限制

- 沒有修改程式、UI、測試、OAuth、Database schema 或 Migration；沒有建立 Person／Persona／Account Link runtime、RLS／RPC／API、Invite、Student／Parent、RBAC／Permission、Audit writer、Event Bus、Queue、Platform Console、AI 或 Knowledge Graph。
- 本次 Git seal 不包含程式、UI、測試、Database或Migration；未 deploy、merge main、建立 PR、開始 AP-003B、AP-002A/B/C、AP-004或Sprint 9。

## 2026-07-16 — AP-002 Final Architecture Approval & Git Seal

### Approval

- AP-002、ADR-004、ADR-005、ADR-006 與 ADR-007 狀態統一為 **Accepted — Architecture Approved**。
- Capability Map 成為 **Approved Product Capability Baseline**。
- Event Catalog 成為 **Approved Contract Baseline — Not Implemented**。
- 核准只涵蓋架構、產品、資料、UX 與未來 Migration contract；Identity／RBAC、Audit、Lifecycle、Event Bus、Queue、Notification、Platform Admin Console、Migration、API 與 UI 均未因本次封板而實作。

### Implementation Order

1. AP-003 Identity, RBAC & Permission Framework
2. AP-002B Immutable Audit Foundation
3. AP-002A Lifecycle Schema Foundation
4. AP-002C Dependency Protection
5. AP-004 Background Job, Event & Notification Foundation
6. AP-002D Organization Closing
7. AP-002E Account Privacy／Deletion
8. AP-002F Recycle Bin
9. AP-002G Platform Admin Console

上述 Package 與 Sprint 9 均未開始。

### Development OAuth Verification Record

- Development Supabase Google Provider 已由環境管理者啟用。
- Google Cloud Web OAuth Client 已設定 Supabase callback URL。
- Development Supabase Site URL 與 Redirect URLs 已驗證。
- Google OAuth 登入已由產品負責人完成一次人工成功驗收。
- 文件未保存 Client ID、Client Secret、Key、Token 或測試帳號；本次未修改 OAuth 程式、callback、Proxy、`.env.local`、`config.toml`、Database 或 Migration。

### Scope

- 本次只變更 README 與 `docs/`，未修改程式、UI、測試、generated type 或 Migration。
- 未操作 Production，未開始 AP-003、AP-002A～G、AP-004 或 Sprint 9。

## 2026-07-16 — AP-002 Amendment：Identity、Domain、Capability、Event（Final Review Pending）

### Architecture

- 新增 ADR-007，正式區分 Authentication Account、Person Profile、Organization Membership、Teacher／Student／Parent／Reviewer Persona 與 Platform Role Assignment，支援同一人跨機構、多角色及多 Persona。
- 定義 15 個 Domain 的 purpose、owner、authority data、primary entities、RACI、allowed/forbidden dependencies、published/consumed contracts、event/data ownership，以及 Lifecycle／Audit／Analytics／AI 責任。
- 新增 Capability Map，將 Platform、Organization、Teacher、Reviewer、Student、Parent、Knowledge、AI、Analytics、Governance 能力對應 Primary User、owning/supporting Domains、產品價值、North Star E/L/C/D、狀態與 Roadmap gate。
- 新增 Event Catalog，涵蓋 Organization、Membership、Curriculum、Knowledge、Teaching、Assessment、Learning、AI、Communication、Billing，定義 envelope、version、payload allowlist、scope、correlation、idempotency、PII、Audit、retry、ordering 與 failure semantics。

### Amendment Decisions

- Audit foundation 必須先於任何新的 lifecycle write flow。
- AP-003 Identity／RBAC 阻擋 Platform role、高風險跨租戶 access、Account lifecycle、ownership override 與 Platform Console mutation。
- Background Job 架構阻擋 permanent deletion、不可逆 anonymization、大型 inventory/export 與 retention cleanup。
- Platform Console 的 permanent delete、force close、irreversible anonymize、ownership override、hold release、break-glass content access、Platform role mutation 與 unrestricted Audit export 延後。

### 限制

- 本 Amendment 只修改文件，沒有建立 Identity Framework、Persona、RBAC、Event Bus、Queue、Outbox、Consumer、Migration、API 或 UI。
- 本階段當時未 commit、push、deploy、merge、建立 PR、開始 AP-003 或 Sprint 9；其待核准狀態已由本文件最上方的 Final Architecture Approval 紀錄取代。

## 2026-07-16 — AP-002：Platform Governance Foundation（歷史 Proposed 階段）

### Architecture

- 新增 Platform、Organization、Workspace、Data/AI 四層治理與 Platform role／Organization Membership 分離契約。
- 定義 Organization、Account、Membership 與 30+ Entity 的生命週期、Dependency Protection、Recycle Bin、Retention、Hold、不可變 Audit 與 permission responsibility matrix。
- 新增 Organization Closing、Account Deletion、Danger Zone、Recycle Bin 與 Platform Admin Console 的產品流程與文字 wireframe。
- 新增 ADR-004（state machines）、ADR-005（Platform vs Organization Admin）與 ADR-006（Deletion/Retention/Audit）。
- 提出 Hybrid additive Migration Design、backfill、dual-read/write、feature flag rollout、forward-only correction 與 Sprint 8 delete RPC 退場策略。

### 文件

- 新增 `docs/architecture/ap-002-platform-governance.md`、三份 ADR、Lifecycle UX、Platform Admin Governance、Retention/Deletion Policy 與完整 Entity Lifecycle Matrix。
- 更新 README、產品、系統、資料庫、測試計畫與 Architecture Backlog，只標記 Proposed 狀態，不宣稱功能已實作。

### 限制

- 本段記錄當時的 **Proposed** 階段；目前狀態已由最上方的 **Accepted — Architecture Approved** 紀錄取代。
- 未新增或修改程式、Database schema、Migration、API、UI、Platform role、RBAC、Audit、Retention、Recycle Bin 或刪除功能。
- 未操作 Production，未 commit、push、deploy、merge、建立 PR 或開始 Sprint 9。

## 2026-07-15 — AR-001：Curriculum Reference Abstraction（有條件核准修正完成）

### Architecture

- 新增 ADR-003，確立 `Education Knowledge Graph → Curriculum Reference → Curriculum → Version → Chapter → Lesson` 的依賴方向。
- Publisher 從新 Domain Model 移除，只保留 `publishers`、`publisher_id`、舊 RPC 與舊 API 作 legacy compatibility。
- 新增 AI Reference Policy 與 Legal Reference Policy；AI 禁止依賴 publisher identity，Reference 只能 Mapping Knowledge Point，不得直接 Mapping Lesson。
- 完成 `curriculum_references`、`knowledge_sources`、`curriculum_reference_mappings`、新 FK、backfill、dual-write 與 forward-only rollback 的 Migration Design；本次未建立 Migration。

### Compatibility Adapter

- 新增 server-side Reference Display Adapter，將 legacy rows 轉為中性的 `CurriculumReferenceDisplay`。
- Curriculum UI 改用「教材進度架構」與教學進度模板 1／2／3，不接收原始來源名稱，也不建立對外品牌對照。
- 新 request 使用 `curriculumReferenceId`；舊 `publisherId` 仍可由 API 正規化。舊 response 保留欄位形狀，但只回傳中性 compatibility value。

### 限制

- 未新增、修改或套用 Migration，未改動 Development／Production schema 或資料。
- CORE、CUSTOM、SYSTEM reference 尚未寫入資料庫；後續須以獨立 forward-only Migration 工作實作。
- 未 commit、push、deploy、merge、建立 PR 或開始 Sprint 9。

### Architecture Backlog

- 新增 AR-002：Data Lifecycle & Audit Architecture Backlog，只記錄 Archive、Restore、Soft Delete、Recycle Bin、Permanent Delete、依賴保護、保留政策、角色權限與稽核需求。
- AR-002 明定 Knowledge Point 原則上只能停用或版本化、歷程資料不可由一般使用者刪除，以及已有下游學習紀錄的 Lesson 不得直接硬刪除。
- AR-002 不屬於 AR-001，本次未建立 Migration、API、UI 或刪除流程。

## 2026-07-15 — Sprint 8：Curriculum Editor（自動化驗收完成）

### 新增

- 建立 `/curriculums/[id]/editor` 雙欄教材編輯器、章課 Tree、麵包屑、工具列、章／課表單與唯讀模式。
- 建立 Chapter／Lesson GET、POST、PATCH、DELETE API 與 server-only data layer；所有輸入皆經 Zod 驗證。
- 完成章節與課次新增、修改、刪除、草稿／發布狀態、教學備註，以及拖曳和鍵盤按鈕排序。
- Dashboard 新增章節數、課次數、最近修改教材與最近課次；教材結構維持批次查詢，沒有 N+1。

### Migration 與安全

- 新增 `20260715160000_s08_extend_curriculum_editor.sql`；只 additive 增加 `chapters.status`、`lessons.teaching_notes` 與八個受控 RPC，沒有修改 Sprint 1～7 migration、DROP、TRUNCATE、新核心 table、Storage、AI、題庫或試卷。
- 新增 `20260715183000_s08_add_lesson_ai_ready_fields.sql`；以 nullable difficulty 與安全預設 keywords 預留 Sprint 12 結構化輸入，不建立 Prompt、Embedding、生成 metadata 或 review workflow。
- RPC 固定空 search path，只使用 `auth.uid()` 與 active organization context，要求 owner/admin 並驗證 version 1 及 hierarchy；public、anon、service_role execute 均撤銷。
- Teacher/reviewer 維持 read-only，direct table write 維持拒絕；完整排序陣列由 server/database 驗證並在 parent lock 下原子更新。
- 兩筆 Sprint 8 Migration 已套用至 `educrat-development`；local／remote history 均包含 `20260715160000`、`20260715183000`，Production 未套用。

### 驗收狀態

- Typecheck、Lint、Prettier、production build、Vitest 30 個測試檔／176 項與 Playwright 4 項均通過；E2E 涵蓋真實 Development 章課 CRUD／排序／刪除、未登入拒絕、手機 viewport 與 Sprint 1～7 regression。
- 隔離本機四角色 rollback RLS 驗收通過：Owner／Admin 可變更，Teacher／Reviewer 唯讀，跨租戶與匿名不可見／不可寫，direct insert 被拒絕。
- 人工桌面／手機／鍵盤與拖曳驗收尚未執行，不標記為人工驗收完成。
- 未執行 commit、push、deploy、PR、main merge 或 Sprint 9。

### 已知限制

- 版本 1 在本 Sprint 唯讀；版本 2、發布稽核、還原與跨版本複製尚未實作。
- Difficulty／keywords 已完成資料層預留，但尚未加入 Editor 表單或任何 AI 流程。
- 章刪除會一併刪除其課次，UI 已二次確認；尚未建立回收桶或 undo。
- `supabase test db --linked` 的 Docker-to-remote runner 曾在連線階段逾時；相同 migration 已在本機隔離 DB 通過四角色 SQL，遠端 RPC 由真實 E2E 驗證。

## 2026-07-15 — Sprint 7：Curriculum Foundation（自動化驗收完成）

### 新增

- 建立 `subjects`、`grades`、`publishers`、`curriculums`、`curriculum_versions`、`chapters`、`lessons`，初始科目為國語／英文／數學／自然／社會／生活，年級為一至六年級，出版社進度參考為南一／康軒／翰林。
- 建立 organization-scoped 教材名稱、科目、年級、進度參考、學年度、學期與狀態；建立教材時原子新增版本 1，舊版本不可被唯一鍵覆蓋。
- 建立 server-only Curriculum data layer、Zod validation、領域錯誤與 collection/detail Route Handlers；沒有 DELETE endpoint。
- 建立教材列表、建立、詳細、編輯頁及 CurriculumForm、Card、Table、EmptyState、Header；Dashboard 新增教材總數、最近教材與可用的建立入口。
- 新增 Curriculum validation、form、API、Migration static、Development RLS 與 Playwright E2E 規格。

### Migration 與安全

- 新增 `20260715090000_s07_create_curriculum_foundation.sql`；沒有修改 Sprint 1～6 Migration，沒有 DROP、TRUNCATE、DELETE、既有 table ALTER、Storage、AI、題庫或試卷物件。
- 七張表均 enable/force RLS。教材階層只允許目前 active organization 的 member 讀取；owner/admin 可更新明列欄位，teacher/reviewer 唯讀。
- `create_curriculum_with_initial_version()` 固定空 search path，只取 `auth.uid()` 與 active organization，不接受 caller 指定 organization／created-by；原子建立教材與初始版本。
- Linked push 已將 Sprint 7 Migration 套用至 `educrat-development`；local／remote history 均包含 `20260715090000`。遠端 table inventory 已確認七張教材表存在。

### 已知限制

- 本 Sprint 只建立教材結構與基本資料 CRUD；章／課編輯、版本發布、AI、題庫、試卷與 Storage 不在範圍。
- Teacher/reviewer 唯讀與 owner/admin 寫入已由 server/API unit、SQL contract、Development 兩帳號 RLS E2E 與隔離本機四角色 rollback transaction 驗證；未使用 Service Role 通過受測操作，也未在遠端留下不受控 membership。
- 教材 E2E fixture 不硬刪除；無 DELETE 流程前使用 deterministic 名稱重用。

### 驗收狀態

- `pnpm run typecheck`、`pnpm run lint`、`pnpm run test`、Prettier 與修改後 `pnpm run build` 已通過；Vitest 共 24 個測試檔、147 項測試通過。
- `pnpm run test:e2e` 共 4 項全部通過，涵蓋既有 regression、Curriculum UI、手機 viewport 與 Development 兩帳號真實 RLS。
- 隔離本機 RLS acceptance 驗證七張表 enable/force RLS、八個 policies、Owner／Admin 寫入、Teacher／Reviewer 唯讀、跨租戶全階層隱藏與匿名拒絕；最後完整 rollback。
- Sprint 7 自動化整合驗收完成；人工 UI／手機版驗收延後至 Milestone 2，在實際執行前不標記為人工驗收通過。
- 未執行 deploy、PR、main merge 或 Sprint 8。

## 2026-07-14 — Sprint 6：機構與補習班多租戶基礎

### 新增

- 建立 `organizations`、`organization_members`、`user_preferences`，以獨立 preference 保存 active organization，不變更既有 profiles schema。
- 建立原子 `create_organization_with_owner()`：只使用 `auth.uid()`，確認 Profile onboarding，並在同一 transaction 建立機構、owner membership 與 active preference。
- 建立受控 `switch_active_organization()`、active context fallback、最後一位 owner 保護及失效 preference 清除流程。
- 建立 Organization onboarding、settings、switcher、active organization Dashboard context 與統一 workspace route guard。
- 建立 server-only organization data layer、Zod API boundary、領域錯誤與 owner/admin server role check。
- 新增 validation、表單、switcher、route precedence、Migration 安全契約及真實 Development RLS／UI E2E 測試。

### Migration 與安全

- 新增 `20260714180000_s06_create_organizations.sql`，三張新表均啟用並強制 RLS；沒有 DROP、TRUNCATE、DELETE、profiles ALTER 或 Storage 變更。
- 新增 `20260714232000_s06_revoke_internal_function_access.sql`，修正 Supabase 預設 function ACL，四個 Trigger-only SECURITY DEFINER functions 對 public、anon、authenticated、service_role 均不可直接執行。
- 兩筆 Migration 均先 dry-run，再套用至 `educrat-development`；production 未執行。local／remote history 均為 `20260713160000`、`20260714150000`、`20260714180000`、`20260714232000`。
- 真實 RLS 測試以兩個一般 authenticated 帳號與 publishable key 驗證跨租戶隔離、匿名拒絕、直接寫入拒絕、自我升權拒絕、合法／非法切換與 duplicate rollback；未使用 Secret／Service Role Key。
- 遠端 catalog 已確認三張表 RLS／FORCE RLS、四個 policies、triggers、functions、indexes 及 `database_health() = true`。

### 已知限制

- Sprint 6 只建立第一位 owner；分校、成員邀請與細緻 RBAC 留待後續明確授權的 Sprint，不提前放寬 membership write。
- Organization Logo 只預留 `logo_path`，獨立 private bucket 與 Storage RLS 延後至 Sprint 10 評估。
- Development RLS E2E 重用固定雜湊 slug 的虛構 fixture，避免每次測試持續新增；完整安全成員清理流程待後續成員管理 Sprint 補齊。
- Security Advisor 仍列出刻意開放 authenticated 的 create／switch／context RPC，以及既存 `rls_auto_enable()` ACL 與 leaked-password protection 未啟用；後兩項需由環境管理者另行審核。
- 既有 Sprint 4 Google OAuth 與 password recovery session 綁定限制不屬本 Sprint，狀態不變。

### 驗收

- `pnpm run typecheck`、`pnpm run lint`、`pnpm run test`、`pnpm run build`、Prettier 與 `git diff --check` 已通過；Vitest 共 19 個測試檔、104 項測試通過。
- 真實 Development 多租戶 RLS 與完整 `pnpm run test:e2e` 已於 Sprint 7 技術封板重新執行，4 項全部通過，涵蓋 Organization、Profile、Avatar、Curriculum、桌面與手機 viewport regression。
- Sprint 6 資料庫已重新確認 local／remote migration history 一致，並由真實 Development RLS 與隔離本機角色測試複驗租戶邊界。
- Sprint 6 自動化整合驗收完成；人工 UI／手機版驗收延後至 Milestone 2，在實際執行前不標記為人工驗收通過。
- 未執行 deploy、PR 或 main merge。

## 2026-07-14 — Sprint 5：使用者個人資料

### 新增

- 建立首次登入 onboarding、個人資料設定頁、受保護導向與工作台顯示名稱。
- 建立 authenticated `GET／PUT /api/profile`，使用者 ID 只取自 server session，所有欄位以 Zod 驗證。
- 建立 Avatar 上傳與移除 API，檢查 2 MB 上限、MIME allowlist 與 JPEG／PNG／WebP 實際檔頭。
- 建立 private `avatars` bucket、user-folder Storage RLS 與短效 signed URL 顯示流程。
- 新增 profile、Avatar、表單、Proxy、Migration 與真實 Playwright E2E 測試。

### Migration 與安全

- 新增 `20260714150000_s05_create_avatar_storage.sql`，已套用至 `educrat-development`；production 未執行。
- 本機與遠端 migration history 均為 `20260713160000`、`20260714150000`。
- own 物件讀寫成功，跨使用者讀寫與匿名讀取遭拒絕，錯誤 MIME 與超過 2 MB 物件遭拒絕；測試物件已清除。
- Profile API 採 select 後分離 insert／update，維持 Sprint 3 欄位級 grant，不放寬整表 UPDATE。
- 未使用 Supabase Secret／Service Role Key，未輸出或提交 `.env.local`。

### 已知限制

- 既有 Sprint 4 password recovery session 綁定仍需高優先修正；本 Sprint 未擴張處理。
- Auth rate limit 仍是單程序記憶體實作，production 前須換為共享 provider。
- 語言與時區先使用受控選項，未實作完整國際化。
- Supabase CLI 套用後的 pg-delta catalog cache 需要本機 Docker；migration 本身與遠端 history 已成功。

### 驗收

- `pnpm run typecheck`、`pnpm run lint`、`pnpm run test`、`pnpm run build` 全部通過。
- Vitest：11 個測試檔、49 項測試通過。
- Playwright：共 3 項 E2E 全部通過；真實個人資料流程在同一登入 session 驗證桌面與手機 viewport，公開頁面另以桌面／手機 smoke test 驗證，沒有跳過案例。

## 2026-07-13 — 維護：統一 Supabase CLI Migration 結構

### 更新

- 建立 `supabase/config.toml` 與 CLI 專用忽略規則。
- 將 Sprint 3 Migration 原封不動移至 `supabase/migrations/`。
- 更新 Migration 安全契約測試、README、系統設計及資料庫文件的路徑。

### Migration 與環境

- 未新增、刪除或修改 Migration SQL；僅調整為 Supabase CLI 標準路徑。
- `supabase/.temp` 連結資訊維持不追蹤，避免提交環境識別資訊。
- `supabase migration list --linked` 已確認本機與 `educrat-development` 均為版本 `20260713160000`。
- 已以唯讀 catalog 與全回滾交易驗證 schema、RLS、跨使用者隔離、匿名拒絕及 trigger，未留下測試資料。
- 不自行對 production 執行 Migration。

## 2026-07-13 — Sprint 4 後整合驗收（部分完成）

### 已通過

- 首頁、登入頁與未登入 Dashboard 導向的桌面／手機 Playwright smoke 測試。
- 註冊與忘記密碼頁可開啟，受保護的 Dashboard／重設密碼頁會將未登入者導向登入。
- Auth callback 的外部 `next` 目的地會被拒絕，不會形成 open redirect。
- `profiles` 實際 schema、RLS、own 權限、跨使用者隔離、匿名拒絕、trigger 與 `database_health()`。
- Email 註冊／callback、登入、登入後 Dashboard、session refresh 與登出已在 development 流程驗證。

### 當時尚未通過

- Google OAuth 當時仍需以實際 provider 完成人工驗收；此項已於 2026-07-16 由產品負責人完成並記錄於本文件最上方。
- Password recovery session 與目前登入帳號的所有權綁定尚未封板，列為正式商用前高優先修正。
- `.env.local` 已在本機設定且維持 Git ignore；不得提交或輸出實際值。

## 2026-07-13 — Sprint 4：完整身分驗證

### 新增

- 建立 Email 註冊、登入、登出、忘記密碼與重設密碼流程。
- 建立 Google OAuth PKCE 啟動與 `/auth/callback` code exchange。
- 建立註冊、忘記密碼、重設密碼頁及完整 loading、error、success 狀態。
- 建立 server-only session helper，未登入 Dashboard 導向登入頁，已登入者離開登入／註冊頁。
- 建立 Auth JSON parser、Zod schema、安全錯誤映射及可替換 rate-limit 介面。
- 建立驗證 schema、錯誤映射與 rate limiter 測試。

### 安全

- Callback 目的地採固定白名單，避免 open redirect。
- 未知 Supabase 錯誤不回傳 provider 內部訊息；忘記密碼不揭露帳號是否存在。
- Auth API 限制 JSON Content-Type、payload 大小與請求頻率。
- Dashboard 在伺服器驗證 claims 與 user，不只依賴 Proxy 或前端狀態。

### Migration 與環境

- 無新 Migration，未修改任何 Supabase 或 production 資料。
- 因未提供非 production Supabase Auth，真實 Email、Google OAuth、cookie 與 E2E 尚未執行。
- 未執行 commit、push 或 deploy。

## 2026-07-13 — Sprint 3：Supabase 基礎架構

### 新增

- 安裝 `@supabase/ssr` 與 `@supabase/supabase-js`。
- 建立 browser、server 與 Next.js 16 Proxy 的 Supabase client。
- 建立 Supabase 公開環境變數與 server-only 私密設定驗證邊界。
- 建立 `profiles` Migration、共用 `updated_at` trigger、最小 table grants 與自有資料 RLS policy。
- 建立不讀取使用者資料的 `database_health()` RPC 與 `/api/health/database`。
- 建立初始 Database TypeScript types、環境驗證測試及 Migration 安全契約測試。

### 安全

- 一般請求只使用 publishable key；Service Role Key 未進入 client、Proxy、健康檢查或資料存取流程。
- `profiles` 未提供匿名與刪除權限，登入者只能讀取、新增及更新自己的 profile。
- 未設定 Supabase 時健康檢查回傳 `not_configured`，不回傳環境內容或內部錯誤。

### Migration 與環境

- 新增 `20260713160000_s03_create_profiles.sql`，未套用至任何環境。
- 未連接或修改 production／staging／local Supabase 資料。
- 未執行 commit、push 或 deploy。

## 2026-07-13 — Sprint 2：開發規範與文件

### 新增

- 建立 AI 引擎設計，定義 provider、Subject Engine、結構化輸出、錯誤重試與品質狀態。
- 建立版權與內容來源政策，定義來源分級、禁止內容、出版社進度參考用語及疑似侵權處理流程。
- 建立測試計畫，涵蓋靜態、單元、整合、E2E、安全、AI 品質與人工驗證。

### 更新

- 擴充產品規格，加入目標客群、使用者角色、商用核心、未來預留、非功能需求及產品流程。
- 擴充系統設計與資料庫規範，加入長期模組邊界、多租戶、RLS、Migration、seed 與環境原則。
- 擴充 `AGENTS.md`，加入 Git branch、commit、Migration 命名規範及 Definition of Done。
- 在 README 加入文件索引與目前 Sprint 狀態。

### 資料庫、API 與產品功能

- 無 Migration、無 API 或產品功能變更，未串接資料庫或 AI。
- 未執行 commit、push、deploy 或 production 操作。

## 2026-07-13 — Sprint 1：專案初始化

### 新增

- 建立 Next.js App Router、TypeScript strict、Tailwind CSS 專案基礎。
- 加入 ESLint、Prettier、Vitest、Testing Library 與 Playwright 設定。
- 加入 Zod、React Hook Form 與登入示範的 client/server 雙層驗證。
- 建立響應式首頁、登入頁與空白 Dashboard。
- 建立 loading、404、route error 與 global error 畫面。
- 建立 Button、Input、Select、Card、Dialog、Alert、Spinner 元件。
- 建立環境變數範例、協作規範與產品、系統、資料庫文件。

### 資料庫與 AI

- 無 Migration，未串接資料庫或 AI，未修改任何正式環境資料。
