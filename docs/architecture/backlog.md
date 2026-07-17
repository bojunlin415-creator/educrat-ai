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
2. AP-003B Role, Permission & Policy Framework
3. AP-002B Immutable Audit Foundation
4. AP-002A Lifecycle Schema Foundation
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
- AP-003A 與 AP-003B 核准後才能解鎖 AP-002B → AP-002A → AP-002C；permanent deletion、irreversible anonymization、Platform high-risk mutation與 production break-glass仍等 AP-004。

### Account hard delete formal blocker

- Account hard delete保持關閉是正式安全政策，不是 Bug。
- 重新審查前至少須完成 Person／Account linking、FK dependency inventory、tombstone actor、AP-002B Audit、Retention／Legal Hold、ownership reassignment、identity anonymization workflow與 AP-004 background deletion job architecture。
- 不得以現有 `ON DELETE CASCADE`、Service Role、Dashboard或人工 SQL繞過；Organization-owned content、Teaching／Learning History、Assessment、Review Decision與Audit不可隨 Account刪除。

## Curriculum Lifecycle／Deletion Handoff

- 現況：**Delete Feature Not Implemented**。教材詳細頁沒有 delete action；也沒有 Curriculum delete dialog、validation、Domain service、DELETE API、RLS/grant、Dependency Protection、Recycle Bin／Restore 或 permanent deletion workflow。
- `archived` 是既有更新流程可設定的狀態，不等於完整 Lifecycle／Trash／Restore／Delete。
- AP-003 family（AP-003B 權限層）定義 archive／restore／trash／delete request 的 Role、Permission、Scope 與 re-auth。
- AP-002B 提供 append-only Audit；AP-002A 建立 canonical lifecycle schema；AP-002C 驗證 Version／Chapter／Lesson與未來下游 dependency；AP-002F 實作 Recycle Bin／Restore／deadline／permanent-delete eligibility；AP-004 執行大型或不可逆 background deletion work。
- AP-002B 與 AP-002C 完成前不得開放 Curriculum permanent deletion；AP-004 完成前不得執行大型或不可逆永久刪除。
- 本 Backlog 不授權修改 Curriculum UI、API、service、RLS、grant、Migration、Chapter／Lesson delete RPC 或 Database。

## AP-003B Handoff：Role、Permission、Scope and Policy Decision

- 狀態：**Proposed — Awaiting Architecture Approval**；文件提案完成，runtime 尚未開始。
- 文件：`ap-003b-authorization-framework.md`、ADR-010～013、Permission Catalog、Authorization Security Model、Authorization Migration Design。
- Catalog：224 個唯一 `resource.action` keys；不使用 `isAdmin`／`isOwner` Boolean，也不把 Scope、Entitlement或Business Rule塞進Role。
- Identity關係：AP-003A提供 Account／Person／Profile／Membership／Persona authority；AP-003B只定義 Role Definition／Assignment、Permission、Scope與Policy Decision，不重做Identity。
- 相容性：`organization_members.role`仍是runtime authority；未來只採 additive backfill、shadow evaluation、受控 dual-write與feature-gated cutover，不修改Sprint 1–8 Migration。
- 安全門檻：Platform Support只可有time-bound CASE access；AI profile不是Account、管理Role或Service Principal；Campus／School／Student／Guardian scope尚未存在時fail closed。
- 核准後解鎖AP-002B Immutable Audit的實作設計，再依AP-002A、AP-002C、AP-004順序推進；本提案不授權直接開始任何後續Package。
- AP-002B前不得啟用新的Role／Delegation／CASE write；AP-004前不得開放permanent deletion、irreversible anonymization、platform high-risk mutation或production break-glass。
