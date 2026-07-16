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

1. AP-003 Identity, RBAC & Permission Framework
2. AP-002B Immutable Audit Foundation
3. AP-002A Lifecycle Schema Foundation
4. AP-002C Dependency Protection
5. AP-004 Background Job, Event & Notification Foundation
6. AP-002D Organization Closing
7. AP-002E Account Privacy／Deletion
8. AP-002F Recycle Bin
9. AP-002G Platform Admin Console

## AP-003 Handoff：Identity／RBAC Foundation

- 狀態：只定義 handoff，**尚未開始**。
- 來源：ADR-007 Identity Concept Model 與 Domain Boundary。
- 必須處理：Account／Person linking、Organization role 與 Persona 分離、Platform Role Assignment、policy decision、resource/action/scope、re-auth freshness、JIT capability、separation of duties、revocation 與 tombstone actor。
- 阻擋：AP-002 的 Platform role 實作、高風險跨租戶 access、Account lifecycle、ownership override、Platform Console mutation 與 permanent deletion approval。
- 不得把 `profiles`、`organization_members.role` 或 active organization preference 直接宣稱為完整 Identity／RBAC。
