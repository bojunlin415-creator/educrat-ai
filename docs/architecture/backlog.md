# Architecture Backlog

本文件只記錄尚待獨立 Architecture Request 審查的架構議題。Backlog 項目不代表已實作、已排入目前 Sprint 或已取得資料庫變更授權。

## AR-002：Data Lifecycle & Audit Architecture

- 狀態：Backlog — 尚未啟動
- 範圍：Archive、Restore、Soft Delete、Recycle Bin、Permanent Delete、Dependency Protection、Retention Policy、Role Permission、Audit Log、刪除原因與二次確認。
- 適用領域：教材、Chapter、Lesson、學生、Knowledge Point、Teaching History、Learning History 與其他歷程資料。

### 必須遵守的初始原則

1. Knowledge Point 原則上不可永久刪除，只能停用或版本化。
2. Teaching History 與 Learning History 原則上不可由一般使用者刪除。
3. 已產生下游學習紀錄的 Lesson 不得直接硬刪除，必須先通過依賴保護與保留政策。
4. 不同資料領域必須分別定義 archive、restore、soft delete、永久刪除、保留期間與角色權限，不能共用一套無差別刪除規則。
5. 高風險刪除須記錄 actor、原因、影響範圍與時間，並要求二次確認及不可竄改的 Audit Log。
6. 永久刪除必須是受控、可稽核且符合依賴與保留政策的例外流程，不得由一般 CRUD endpoint 直接提供。

AR-002 不屬於 AR-001。本次不建立資料表、Migration、API、UI、刪除流程、回收桶或稽核功能；必須由後續獨立 Architecture Review 定義後才能實作。
