# Architecture Backlog

本文件只記錄尚待獨立 Architecture Request 審查的架構議題。Backlog 項目不代表已實作、已排入目前 Sprint 或已取得資料庫變更授權。

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
5. AP-002C Dependency Protection
6. AP-004 Background Job, Event & Notification Foundation
7. AP-002D Organization Closing
8. AP-002E Account Privacy／Deletion
9. AP-002F Recycle Bin
10. AP-002G Platform Admin Console

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
- AP-002C仍需獨立核准；Audit persistence／transaction consistency、Authorization product integration及Dependency Protection完成前不得開任何lifecycle write。
- BF-003、Curriculum Delete、permanent deletion、AP-002F與Sprint 9仍未解鎖。
