# Architecture Backlog

本文件只記錄尚待獨立 Architecture Request 審查的架構議題。Backlog 項目不代表已實作、已排入目前 Sprint 或已取得資料庫變更授權。

## AS-001：Assignment Foundation

- 狀態：**Completed and Git Sealed**；產品 foundation 已完成並封板。
- 已完成：Assignment aggregate、Student Assignment status、Submission foundation、server-side assignment API、tenant-scoped RLS 與 Assignment audit events。
- Database：新增 additive migration `20260729150000_as001_create_assignment_foundation.sql`，建立 `assignments`、`assignment_students`、`assignment_submissions` 與 `assignment_audit_events`；不修改歷史 Migration。
- 安全：Assignment 固定綁定 published Curriculum Version；Student 只能看自己的派發與 submission；Teacher 管理自己建立的 assignment；Organization Owner/Admin 管理機構內全部 assignment。
- 明確未完成：AI 分析、Learning Analytics、Dashboard、Parent Report、Class／Enrollment persistence、批改、分數報表、通知與 AI 推薦。

## CL-001：Class & Enrollment Foundation

- 狀態：**Completed and Git Sealed**；產品 foundation 已完成並封板。
- 已完成：Class aggregate、Enrollment domain、Primary Teacher relationship、Student-Class relationship、Assignment class target integration、tenant-scoped RLS 與 Classroom audit events。
- Database：新增 additive migration `20260730100000_cl001_create_class_enrollment_foundation.sql`，建立 `classes`、`class_enrollments`、`assignment_classes` 與 `classroom_audit_events`；不修改歷史 Migration。
- 安全：Teacher 只能管理自己為 primary teacher 的班級；Student 只能查看自己的 active class enrollment；Organization Owner/Admin 可管理機構內全部班級；cross tenant fail closed。
- 明確未完成：Attendance、Timetable、Learning Analytics、Dashboard、Parent Portal、AI Recommendation、Assistant Teacher、批改與報表流程。

## AN-001：Student Learning Analytics Foundation

- 狀態：**Implementation Completed — Awaiting Product Review**；產品 foundation 已完成，尚未 Git Seal。
- 已完成：Learning Event domain、Knowledge Mastery、Subject Summary、Learning Timeline、Teacher Class Summary API、Aggregation service、tenant-scoped RLS 與 Learning audit events。
- Database：新增 additive migration `20260730130000_an001_create_learning_analytics_foundation.sql`，建立 `learning_events`、`student_knowledge_mastery`、`student_subject_summary`、`teacher_class_summary` 與 `learning_audit_events`；不修改歷史 Migration。
- 安全：Learning Event append-only；Student 只能查看自己；Teacher 只能查看自己班級；Organization Owner/Admin 可查看機構內 learning analytics；cross tenant fail closed。
- 明確未完成：AI Recommendation、Dashboard、Charts、Parent Report、Teacher Dashboard、Organization Dashboard、Adaptive Learning、background aggregation job 與 production migration。

## EX-001：Curriculum Export Foundation

- 狀態：**Implementation Completed — Awaiting Product Review**；產品整合已完成，尚未 Git Seal。
- 已完成：framework-neutral export core、runtime PDF renderer、worksheet／answer-sheet／combined mode、safe filename、stored version export API、Browser Print Preview、`curriculum.export` authorization 與 `CURRICULUM_EXPORTED` audit integration。
- Database：新增 additive migration `20260729100000_ex001_add_curriculum_export_audit.sql`，僅擴充 curriculum lifecycle audit action allowlist 與 insert policy；不建立 PDF table、storage 或 persistent file。
- 安全：PDF runtime generate；不建立 public storage、不永久保存 PDF、不輸出 provider raw response、prompt、完整教材內容到 audit metadata 或公開 URL。
- 明確未完成：DOCX、批次匯出、Background Job、Export Job Queue、品質 gate、簽章、水印、機構品牌模板、長文件 pagination 精修、正式 PDF library／font embedding 策略。

## PB-001：Curriculum Publish Foundation

- 狀態：**Implementation Completed — Awaiting Product Review**；產品整合已完成，尚未 Git Seal。
- 已完成：正式 `draft`／`in_review`／`published`／`archived` 狀態、Submit Review／Review／Publish／Archive／Reopen Draft／Create New Version server routes、publish validation、version lock、狀態徽章與 lifecycle action UI。
- Database：新增 additive migration `20260729120000_pb001_curriculum_publish_foundation.sql`，forward-only 將 legacy `active` curriculum 轉為 `published`，擴充 curriculum/version status check、publish RPC 與 audit action allowlist；不修改 Sprint 1～8 歷史 Migration。
- 安全：Teacher 可送審；Reviewer 可審閱；Owner/Admin 可發布、封存與建立新版本。Published version 不可原地覆寫，非 Draft 的章節／課次 product service write fail closed。
- 明確未完成：AI-002、通知、Queue、Background Job、Platform review、dedicated reopen audit action、DB-level hardening for every historical editor RPC、跨 Entity publish orchestration。

## PI-001：Curriculum Delete & Recycle Bin Integration

- 狀態：**Implementation Completed — Awaiting Product Review**；產品整合已完成，尚未 Git Seal。
- 已完成：Curriculum-only archive、soft delete、recycle bin list、restore from recycle bin、controlled permanent deletion、append-only lifecycle audit table、trusted authorization adapter、AP-002F recycle entry adapter、API routes 與 UI Danger Zone。
- Database：新增 additive migration `20260728120000_pi001_add_curriculum_recycle_bin.sql`、forward-only uniqueness follow-up `20260728123000_pi001_use_active_curriculum_name_uniqueness.sql`，以及 caller-bound lifecycle RPC role-check follow-up `20260728124000_pi001_inline_curriculum_lifecycle_role_checks.sql`；不修改 Sprint 1～8 歷史 Migration。
- 安全：owner/admin 才可 lifecycle write；teacher/reviewer 維持唯讀；一般 list/detail 排除 deleted curricula；回收桶維持 active organization isolation。
- 明確未完成：Lesson／Worksheet／Assessment lifecycle、Platform-wide recycle bin、Re-auth UI／receipt、Background Job、Platform Admin review、Organization Closing、Account Deletion、AI generation persistence。
- 名稱策略：同一 organization 內只有 `deleted_at is null` 的教材受唯一名稱限制；回收桶教材不阻擋建立同名新教材。若還原時名稱已被 active 教材占用，必須 fail closed 並回傳安全 domain error。

## BF-001：AI Curriculum Engine MVP Handoff

- 狀態：**Implementation Completed — Awaiting Product Review**；產品 foundation 已建立，尚未 Git Seal。
- 已完成：`lib/ai-curriculum/` generation input、Knowledge Point、Prompt Builder、Curriculum Template、A4/PDF-ready layout descriptor、Validator、Preview contract 與 canonical serialization。
- 版權邊界：legacy 教材版本 input 只轉為中性 Curriculum Reference label；Prompt 不接收出版社名稱、code 或 mapping details。教材生成規則要求原創，不複製、改寫、引用或重製出版社課文、教師手冊、題庫、插圖、答案或解析。
- 明確未完成：AI provider call、model schema adapter、generation persistence、Database、Migration、API、Server Action、正式 UI、PDF binary export、Audit、Authorization product integration、Learning History、BI、家長端、金流、訂閱、加盟或 CRM。
- 後續產品化：需獨立核准 AI Provider Adapter、Teacher Review Workflow、Export Provider、Quality Gate、Usage/Cost Tracking、Knowledge Graph persistence 與產品 UI。

## BF-002：AI Generation Engine Handoff

- 狀態：**Implementation Completed — Awaiting Product Review**；產品 foundation 已建立，尚未 Git Seal。
- 已完成：`lib/ai-generation/` GenerationRequest／Result／Metadata／Usage、AIProvider interface、OpenAI adapter boundary、Structured Output schema、Prompt Pipeline、Generation Pipeline、Output／Knowledge Mapping Validator、Retry Decision 與 canonical serialization。
- Provider 邊界：`AIProvider` 支援 `generate()`、`health()`、`providerName()`、`modelName()`；不依賴 OpenAI SDK、HTTP、Next.js、Supabase、Database 或 API Route。
- Fail-closed：invalid request、provider unavailable、provider exception、invalid structured output、invalid knowledge mapping 均回傳 machine-readable failure，不接受自由文字教材。
- 明確未完成：concrete OpenAI adapter、API key、HTTP call、streaming、real retry executor、Database、Migration、API、Server Action、UI、generation persistence、Audit、Authorization product integration、quota/cost persistence、background job。
- 後續產品化：需獨立核准 concrete provider adapter、server composition root、Authorization／Audit integration、generation persistence、cost/quota tracking、Teacher Review Workflow 與 Export Pipeline。

## BF-003：Original Curriculum Generation Handoff

- 狀態：**Implementation Completed — Awaiting Product Review**；產品 foundation 已建立，尚未 Git Seal。
- 已完成：BF-001／BF-002 input 與 prompt 語意移除教材版本、出版社進度參考、冊次、Lesson Mapping 與 Unit Mapping；新增 Curriculum Topic、Competency Indicator、Learning Objective、Topic Hierarchy 與教材用途語意。
- 新入口：`generateOriginalCurriculum()`；`generateCurriculum` 僅保留為 compatibility alias，產品語意以 original curriculum generation 為準。
- Copyright Safety：新增 publisher keyword、lesson mapping、prompt safety 與 forbidden vocabulary validation；偵測到出版社名稱、教師手冊、題庫、課文引用、課本章節或 mapping 語意時 fail closed。
- 明確未完成：出版社 mapping、教材比對、OCR、課本章節、Lesson Code、Unit Mapping、真實 AI provider call、API、UI、Database、Migration、Audit、Authorization product integration。
- 後續產品化：需獨立核准 concrete provider adapter、server composition root、Teacher Review Workflow、Copyright Safety reporting、Audit／Authorization integration 與 generation persistence。

## AI-001：Real Curriculum Generation Handoff

- 狀態：**Implementation Completed — Awaiting Product Review**；尚未 Git Seal、push 或 deploy。
- 已完成：真實 OpenAI Responses provider、`POST /api/curriculums/generate`、`POST /api/curriculums/generate/save`、建立頁 AI Generate／Preview／Edit／Save Draft、`curriculum_ai_drafts` structured persistence、Version 1 draft 建立、Chapter／Lesson 摘要建立、AI audit events 與 owner/admin/teacher authorization。
- Provider：使用 server-only `OPENAI_API_KEY` 與 `OPENAI_MODEL`；未設定 key 時 fail closed，不產生 fake output。
- Persistence：`client_request_id` 保護同一 save request 的重送，不以 UI disabled 作為唯一防重邊界。
- Copyright：Route 與 service 雙層 validation；偵測出版社名稱、publisher、edition、textbook、教師手冊、題庫、課文引用、課本章節或 mapping 語意時停止。
- 明確未完成：streaming、AI job queue、background retry、usage/cost persistence、quota、billing、worksheet/assessment generation、learning analytics 與 production deployment。
- 人工產品驗收：需在 Development server 設定 `OPENAI_API_KEY` 後執行一次真實生成 → 編輯 → 儲存 → 重新開啟。

## AR-002：Data Lifecycle & Audit Architecture（由 AP-002 提案承接）

- 狀態：AP-002 Accepted — Architecture Approved；尚未實作
- 範圍：Archive、Restore、Soft Delete、Recycle Bin、Permanent Delete、Dependency Protection、Retention Policy、Role Permission、Audit Log、刪除原因與二次確認。
- 適用領域：教材、Chapter、Lesson、學生、Knowledge Point、Teaching History、Learning History 與其他歷程資料。

### 必須遵守的初始原則

1. Knowledge Point 原則上不可永久刪除，只能停用或版本化。
2. Teaching History 與 Learning History 原則上不可由一般使用者刪除。
3. 已產生下游學習紀錄的 Lesson 不得直接硬刪除，必須先通過依賴保護與保留政策。
4. 不同資料領域必須分別定義 archive、restore、soft delete、永久刪除、保留期間與角色權限，不能共用一套無差別刪除規則。
5. 高風險刪除須記錄 actor、原因、影響範圍與時間，並要求二次確認及不可竄改的 Audit Log。
6. 永久刪除必須是受控、可稽核且符合依賴與保留政策的例外流程，不得由一般 CRUD endpoint 直接提供。

AR-002 不屬於 AR-001。其需求已由已核准的 `AP-002 Platform Governance Foundation` 擴充為 Platform／Organization 治理、Account／Membership lifecycle、Dependency、Retention、Audit、Danger Zone 與 Migration Design。目前仍未建立資料表、Migration、API、UI、刪除流程、回收桶或稽核功能。

正式 implementation 順序如下；每一項仍須獨立核准，不能合併成單一 Sprint，也不得自動視為 Sprint 9：

1. AP-003A Identity Domain Model
2. AP-003B Role, Permission & Policy Framework（Accepted；architecture only）
3. AP-002B Immutable Audit Foundation（Accepted and Git Sealed；runtime foundation only）
4. AP-002A Lifecycle Schema Foundation（Accepted and Git Sealed；runtime foundation only）
5. AP-002C Dependency Protection（Accepted and Git Sealed；runtime foundation only）
6. AP-002D Retention & Legal Hold Foundation（Accepted and Git Sealed）
7. AP-002E Re-authentication Boundary Foundation（Accepted and Git Sealed）
8. AP-002F Recycle Bin Foundation（Implementation Completed；等待架構審查）
9. AP-004 Background Job, Event & Notification Foundation
10. Organization Closing product Package（識別碼待後續架構核准，未開始）
11. Account Privacy／Deletion product Package（識別碼待後續架構核准，未開始）
12. AP-002G Platform Admin Console

> AP-002 原始 roadmap 曾以 AP-002D 指稱 Organization Closing。2026-07-23 的獨立 Package 指令將 AP-002D 用於 Retention & Legal Hold Foundation；本文件保留 Organization Closing 產品範圍但不沿用衝突識別碼，也不宣稱該產品流程已開始。
> 同理，2026-07-23 的獨立 Package 指令將 AP-002E 用於 Re-authentication Boundary Foundation；原先 Account Privacy／Deletion 產品範圍保留，但不得沿用衝突識別碼或視為已開始。

## AP-003A Handoff：Identity Domain Model

- 狀態：**Accepted — Architecture Approved**；Identity 架構與 Migration Design 已成為核准基線，runtime 尚未開始。
- 來源：ADR-007 Identity Concept Model 與 Domain Boundary。
- 本 Package：Account／Auth Identity／Person／Profile／Membership／Persona／Guardian／Service Principal 邊界、受控 linking／merge、lifecycle、privacy、tombstone與 migration constraints。
- 阻擋：AP-003B 的 Role／Permission／Policy 設計，以及後續 Account lifecycle、Person merge、Student claim、Guardian link與 Platform identity runtime。
- 不得把 `profiles`、`organization_members.role` 或 active organization preference 直接宣稱為完整 Identity／RBAC。
- 文件：`ap-003a-identity-domain-model.md`、ADR-008～009、Identity Security／Privacy／UX 與 Identity Migration Design。
- 核心決策：預設 Account–Person 一對一、受控 linking／merge、Persona／Membership／Role分離、Managed Persona可無 Account、Email不作 Person ID。
- 未實作：table、Migration、RLS、RPC、API、UI、Invite、Student/Parent runtime、RBAC/Permission、Platform role、Audit writer、Event Bus、Queue。
- AP-003B 接手：Role Model、Permission Catalog、Scope、Policy Decision、Persona與 Role關係、legacy role相容、re-auth與 CASE access。
- AP-003A 與 AP-003B 已核准並解鎖 AP-002B；AP-002B 與 AP-002A foundation 皆已核准並 Git Sealed，後續仍依 AP-002C → AP-004 推進。Permanent deletion、irreversible anonymization、Platform high-risk mutation與 production break-glass仍等 AP-004。

### Account hard delete formal blocker

- Account hard delete保持關閉是正式安全政策，不是 Bug。
- 重新審查前至少須完成 Person／Account linking、FK dependency inventory、tombstone actor、AP-002B Audit、Retention／Legal Hold、ownership reassignment、identity anonymization workflow與 AP-004 background deletion job architecture。
- 不得以現有 `ON DELETE CASCADE`、Service Role、Dashboard或人工 SQL繞過；Organization-owned content、Teaching／Learning History、Assessment、Review Decision與Audit不可隨 Account刪除。

## Curriculum Lifecycle／Deletion Handoff

- 現況：**Delete Feature Not Implemented**。教材詳細頁沒有 delete action；也沒有 Curriculum delete dialog、validation、Domain service、DELETE API、RLS/grant、Dependency Protection、Recycle Bin／Restore 或 permanent deletion workflow。
- `archived` 是既有更新流程可設定的狀態，不等於完整 Lifecycle／Trash／Restore／Delete。
- AP-003 family（AP-003B 權限層）定義 archive／restore／trash／delete request 的 Role、Permission、Scope 與 re-auth。
- AP-002B foundation 定義不可變 Event／Writer與append-only persistence contract；後續 Database adapter才會實現真正append-only儲存。AP-002A 建立 canonical lifecycle schema；AP-002C 驗證 Version／Chapter／Lesson與未來下游 dependency；AP-002F 實作 Recycle Bin／Restore／deadline／permanent-delete eligibility；AP-004 執行大型或不可逆 background deletion work。
- AP-002B 與 AP-002C 完成前不得開放 Curriculum permanent deletion；AP-004 完成前不得執行大型或不可逆永久刪除。
- 本 Backlog 不授權修改 Curriculum UI、API、service、RLS、grant、Migration、Chapter／Lesson delete RPC 或 Database。

## AP-003B Handoff：Role、Permission、Scope and Policy Decision

- 狀態：**Accepted — Architecture Approved**；文件已 Git Sealed。AP-004A 已建立 runtime contracts，但 catalog、policy、scope 與 enforcement runtime 尚未開始。
- 文件：`ap-003b-authorization-framework.md`、ADR-010～013、Permission Catalog、Authorization Security Model、Authorization Migration Design。
- Catalog：224 個唯一 `resource.action` keys；不使用 `isAdmin`／`isOwner` Boolean，也不把 Scope、Entitlement或Business Rule塞進Role。
- Identity關係：AP-003A提供 Account／Person／Profile／Membership／Persona authority；AP-003B只定義 Role Definition／Assignment、Permission、Scope與Policy Decision，不重做Identity。
- 相容性：`organization_members.role`仍是runtime authority；未來只採 additive backfill、shadow evaluation、受控 dual-write與feature-gated cutover，不修改Sprint 1–8 Migration。
- 安全門檻：Platform Support只可有time-bound CASE access；AI profile不是Account、管理Role或Service Principal；Campus／School／Student／Guardian scope尚未存在時fail closed。
- AP-003B核准後已由獨立指令解鎖AP-002B foundation；AP-002B與AP-002A foundation皆已核准並Git Sealed，再依AP-002C、AP-004順序推進。
- AP-002B append-only persistence與產品整合完成前不得啟用新的Role／Delegation／CASE write；AP-004前不得開放permanent deletion、irreversible anonymization、platform high-risk mutation或production break-glass。

## AP-004A Handoff：Authorization Runtime Foundation

- 狀態：**Accepted and Git Sealed**；runtime foundation 已建立，AP-004B 尚未開始。
- 已建立：AuthorizationContext、Decision／Reason／Result／Error、branded PermissionKey、ResourceScope vocabulary、PermissionResolver／PolicyResolver interfaces、AuthorizationProvider DI boundary 與 architecture tests。
- 明確未建立：Permission Catalog runtime、role/persona/membership adapter、permission/policy/scope resolver implementation、API／middleware guard、resource enforcement、Audit writer、Database／Migration／RLS、JWT／Session／OAuth 或 UI。
- 現有 `organization_members.role`、server checks 與 RLS 仍是現行 authority；AP-004A 不得被用來宣稱完整 RBAC 或 Policy Engine 已上線。
- AP-004B 必須取得獨立核准，並先定義 catalog version/deprecation、legacy parity、fail-closed resolver、shadow evaluation 與 Audit handoff，不能由本 Package 自動開始。

## AP-004B Handoff：Permission Resolver & Policy Engine

- 狀態：**Accepted and Git Sealed**；純函式 runtime core 已核准，產品 enforcement 尚未開始。
- 已完成：exact Permission grant、獨立 wildcard policy expression、17 類 Scope 驗證、explicit lineage、關係證據、immutable Policy、safe Condition、deterministic ordering、default deny、explicit DENY override、Decision Engine 與單元／安全／架構測試。
- Catalog 邊界：AP-003B 的 224 permission baseline 未變；本 Package 不建立 Catalog persistence/runtime，unknown key 只能在 exact context grant 缺少時 fail closed。
- Scope 邊界：Membership／Person／Profile／Persona／Own／Managed 是 relation evidence，不新增與 AP-004A 重複的 Scope vocabulary；caller 必須在未來 trusted adapter 提供可驗證資料。
- 明確未完成：Identity／Membership／Persona／Role query adapter、catalog version/deprecation gate、legacy parity/shadow evaluation、API／middleware／Server Action／UI enforcement、Audit persistence、Database／Migration／Supabase／RLS／Session／JWT／OAuth 整合。
- AP-004C 只有技術前置條件，未獲開始授權；必須另行核准 trusted adapters、Audit handoff、resource lineage acquisition、production rollout 與現行授權 parity。

## AP-004C-A Handoff：Minimal Authorization Adapter

- 狀態：**Accepted and Git Sealed**；不得視為 Product enforcement 上線。
- 已完成：唯一 `authorize()` application entry、AuthorizationContext Factory、framework-neutral Server Action／API helper、typed Authorization／Forbidden／Unauthenticated／Invalid Context error 與單元／架構測試。
- 原始 caller-supplied context contract 已由 AP-004C-B 取代；Session、Catalog persistence 與 lineage 的 concrete資料取得仍未實作。
- Helper 不是真正 Server Action／Route Handler，沒有 Next.js、Cookie、Database、Supabase、RLS、Audit、middleware、UI 或產品 business rule integration。
- 後續必須獨立核准 trusted adapter、現行授權 parity／shadow evaluation、AP-002B Audit handoff、resource lineage acquisition 與產品逐路徑 rollout。
- 本 Package 不授權 Curriculum Delete、BF-003、AP-002B、RLS integration 或 Sprint 9。

## AP-004C-B Handoff：Trusted Authorization Context Adapter

- 狀態：**Accepted and Git Sealed**；尚未產品上線。
- 已完成：interface-only Identity／Membership／Persona／Role／Permission Grant authority ports、trusted provider orchestrator、cross-source validation、provider-issued envelope、immutable whitelist copy，以及 `authorize()`／Server／API helper integration。
- Fail closed：forged Identity、Membership、active Organization、Permission、Permission authority、Scope、未簽發 envelope，以及 missing Identity／Membership 均有自動測試。
- 明確未完成：production Session／Supabase／Database concrete adapters、Catalog version authority、resource lineage acquisition、legacy parity／shadow evaluation、Audit、RLS、middleware、產品 API／Server Action／UI enforcement。
- PLATFORM／CASE／break-glass context 暫不開放；目前 trusted provider 要求 active Organization membership。
- 不授權 Audit、Lifecycle、Curriculum Delete／Archive、Migration、middleware、React hook 或任何 Product business rule。

## AP-002B Handoff：Immutable Audit Foundation

- 狀態：**Accepted and Git Sealed**；尚未接入產品寫入。
- 已完成：immutable Audit Event／Receipt、metadata allowlist、fail-closed validation、canonical serializer、Hash Chain／Repository／Clock／ID ports，以及以 expected previous hash 進行 atomic append 的 Audit Writer contract。
- Security boundary：禁止 arbitrary metadata、PII／Secret payload、Event mutation、Repository update/delete與 framework／Database／產品 Domain import；append失敗或 chain conflict 不回傳 Receipt。
- 明確未完成：Audit table、Migration、Supabase repository、RLS／grant、production hash adapter、transaction/outbox、retention／hold、external archive、API／UI與產品 lifecycle integration。
- AP-002A／C不得把此 foundation 誤當 persistence 已完成；任何 lifecycle write上線前仍需 append-only storage、transaction consistency、Authorization、RLS、Dependency Protection及完整負向測試。
- BF-003、Curriculum Archive／Delete／Restore、Recycle Bin與permanent deletion未獲解鎖；本 Package不授權開始下一項。

## AP-002A Handoff：Lifecycle Schema Foundation

- 狀態：**Accepted and Git Sealed**；尚未接入產品 write flow。
- 已完成：versioned State／Transition／Requirements／Definition、immutable ALLOWED／DENIED Decision、Definition Provider、construction-only Registry、pure Lifecycle Policy port、fail-closed Evaluator與canonical serialization。
- Core vocabulary：Draft、Published、Archived、Trashed、Deleted；只允許六個顯式 transition，禁止wildcard、implicit jump、duplicate route與terminal outgoing。
- Requirements只描述Audit、Authorization、Dependency、Re-authentication、Retention與Legal Hold門檻；本 Package不執行或驗證這些外部能力。
- 明確未完成：Database schema、Migration、RLS、RPC、API、UI、Server Action、lifecycle request、state persistence、optimistic concurrency、legacy adapter、Archive／Restore／Delete、Recycle Bin與產品Domain policy。
- Security boundary：不接受password、token、cookie、header、PII、教材／學生內容或任意request payload；unknown input、version、field、state、transition、intent與Policy result一律fail closed。
- AP-002C已獨立核准並Git Sealed；Audit persistence／transaction consistency、Authorization product integration及產品Dependency adapter完成前不得開任何lifecycle write。
- BF-003、Curriculum Delete、permanent deletion、AP-002F與Sprint 9仍未解鎖。

## AP-002C Handoff：Dependency Protection Foundation

- 狀態：**Accepted and Git Sealed**；尚未接入產品流程。
- 已完成：versioned Dependency vocabulary、immutable directed Reference、Check Request／Result、construction-only Registry、interface-only async Graph與pure Policy ports、fail-closed Evaluator、topology validation與canonical serializer。
- Validation：unknown resource／dependency／transition／field／version、duplicate normalized edge、direct／indirect cycle、disconnected fragment、Graph／Policy exception與無效output均fail closed。
- Security boundary：只接受受控technical identifiers，不接受Password、Token、Cookie、PII、HTTP payload、教材內容或學生資料；Production source不依賴framework、Database、Supabase、Audit、Authorization、Lifecycle或產品Domain。
- 明確未完成：Curriculum／Lesson等產品vocabulary與policy、concrete Graph adapter、Database query／Migration／RLS、impact UI、API、Lifecycle／Audit orchestration、transaction/outbox與background job。
- AP-002C ALLOWED不等於允許Archive／Delete；AP-002B persisted Audit、AP-004 trusted product authorization、AP-002A write orchestration、AP-002D產品Retention／Legal Hold adapter、Re-auth與transaction consistency完成前，所有lifecycle write仍維持關閉。
- BF-003、Curriculum lifecycle、AP-002F、permanent deletion與Sprint 9仍未解鎖；下一個Package不得由本次自動開始。

## AP-002D Handoff：Retention & Legal Hold Foundation

- 狀態：**Accepted and Git Sealed**；尚未接入產品流程。
- 已完成：versioned Retention Definition／Rule、bounded Period、safe Metadata、Legal Hold Reference、Check Request／Decision、construction-only Registry、pure Policy port、fail-closed validation／Evaluator與canonical serializer。
- Evaluator順序：validation → rule resolution → legal hold gate → policy → immutable decision；active legal hold在Policy前直接拒絕，Policy不能override。
- Validation：unknown resource／category／transition／field／version、duplicate vocabulary／resource／hold、invalid rule／period／metadata／hold／policy output、cross-resource hold、unsupported hold與PII-shaped identifier均fail closed。
- Security boundary：只接受technical identifiers、受控codes、有界數字與boolean；不接受Password、Token、Cookie、Header、HTTP payload、PII、教材內容、學生資料或legal case自由文字。
- 明確未完成：法定期限、jurisdiction／plan／Organization／Curriculum產品rule、Clock／retention anchor、Policy Resolver、Legal Hold repository與apply/release workflow、Database、Migration、RLS、API、UI、Audit/Dependency/Lifecycle orchestration、transaction/outbox或background job。
- AP-002D ALLOWED不等於期間已屆滿或允許Archive／Delete／Purge；產品write仍須AP-004 trusted Authorization、AP-002B persisted Audit、AP-002A Lifecycle、AP-002C Dependency、authoritative Retention/Hold adapter、Re-auth／Approval與transaction consistency。
- Organization Closing、Account Privacy／Deletion、Recycle Bin、BF-003、permanent deletion與Sprint 9均未因本Foundation自動解鎖。

## AP-002E Handoff：Re-authentication Boundary Foundation

- 狀態：**Accepted and Git Sealed**；尚未接入產品流程。
- 已完成：versioned Re-auth Requirement、Risk Level、Challenge Reference、Check Request／Decision、construction-only Registry、pure Policy port、fail-closed validation／Evaluator與canonical serializer。
- Evaluator順序：validation → requirement resolution → challenge validation → policy → immutable decision；missing required challenge只回傳`challengeRequired`，不驗證credential。
- Validation：unknown action／challenge type／field／version、duplicate vocabulary／requirement、invalid requirement／risk level／metadata／challenge／policy output、wrong challenge type與credential-shaped payload均fail closed。
- Security boundary：只接受technical identifiers、受控codes、有界數字、boolean與ISO instant；不接受Password、OTP Code、MFA Secret、Token、Cookie、Header、HTTP payload、PII、教材內容或學生資料。
- 明確未完成：Login、OAuth re-auth flow、MFA、OTP、Password verification、WebAuthn、Session refresh、Clock／freshness window、receipt repository、credential verifier、Database、Migration、RLS、API、UI、Audit/Dependency/Lifecycle/Retention orchestration、transaction/outbox或background job。
- AP-002E ALLOWED不等於允許Role mutation、Export、Archive、Delete、Purge或break-glass；產品write仍須AP-004 trusted Authorization、AP-002B persisted Audit、AP-002A Lifecycle、AP-002C Dependency、AP-002D Retention/Hold、authoritative Re-auth adapter、Approval與transaction consistency。
- Organization Closing、Account Privacy／Deletion、Recycle Bin、BF-003、permanent deletion與Sprint 9均未因本Foundation自動解鎖。

## AP-002F Handoff：Recycle Bin Foundation

- 狀態：**Implementation Completed — Awaiting Architecture Review**；尚未接入產品流程。
- 已完成：versioned Recycle Entry、Restore Request、Permanent Deletion Request、Purge Eligibility、Restore／PermanentDeletion Decision、construction-only Registry、pure Policy port、fail-closed validation／Evaluator與canonical serializer。
- Evaluator順序：validation → recycle entry → retention/dependency/hold gates → policy → immutable decision；不執行actual restore、delete、purge或write。
- Validation：unknown resource／transition／field／version、duplicate vocabulary、invalid entry／lifecycle state／restore request／permanent deletion request／policy output與payload-shaped extra field均fail closed。
- Security boundary：只接受technical identifiers、受控codes、有界數字、boolean與ISO instant；不接受Password、Token、Cookie、Header、HTTP payload、PII、教材內容或學生資料。
- 明確未完成：Database、Migration、RLS、RPC、Repository、Supabase adapter、API、UI、Server Action、middleware、actual restore、soft delete、hard delete、storage deletion、background job、notification、queue或產品policy。
- AP-002F allowed decision不等於允許Curriculum Delete、Archive、Restore或Permanent Delete；產品write仍須AP-004 trusted Authorization、AP-002B persisted Audit、AP-002A Lifecycle、AP-002C Dependency、AP-002D Retention/Hold、AP-002E Re-auth、Approval與transaction consistency。
- BF-003、Curriculum lifecycle、Account Privacy／Deletion、Organization Closing、permanent deletion與Sprint 9均未因本Foundation自動解鎖。
