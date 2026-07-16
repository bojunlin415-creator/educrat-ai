# ADR-006：Deletion, Retention and Audit Architecture

- 狀態：**Accepted — Architecture Approved**
- Architecture Package：AP-002
- 日期：2026-07-16

## 背景

Archive、Recycle Bin、Anonymize 與 Permanent Delete 的目的不同；單一 `deleted_at` 無法處理教育歷程、未成年人資料、Billing、legal hold、AI input/output 與不可變稽核。使用 cascade delete 也會破壞 Organization-owned content 與歷程完整性。

## 決策

### Hybrid Lifecycle

- Aggregate current state 由 Domain row 或 typed companion table 管理，維持強 FK 與 Domain invariant。
- 共用 `lifecycle_requests`、`deletion_requests`、`retention_policies`、`retention_holds`、`recycle_bin_entries` 與 `audit_events` 管理 workflow。
- Generic table 不作所有 Entity 的 canonical state，避免弱 FK 與 RLS 混用。

### Deletion

1. Permanent delete 必須經 permission、state、dependency、retention、hold、export、re-auth 與 approval。
2. Organization Owner 只能提出申請；Platform Super Admin 核准，受控 background job 執行。
3. Account deletion 先 transfer ownership、解析所有 memberships、匿名化必要 PII，再移除 eligible authentication data。
4. Curriculum/Chapter/Lesson 有 protected history 時只能 archive/retire。
5. Knowledge Point、published Curriculum Version、Teaching/Learning History、Invoice 與 Audit Event 不提供一般 permanent delete。

### Retention

Retention policy 版本化，包含 jurisdiction、entity、plan/type、duration、grace、anonymization、export、effective date 與 legal hold override。Organization policy 只能延長，不能低於 Platform/legal minimum。每次 decision 保存 policy version；本 ADR 不宣稱任何法定天數。

### Audit

Audit append-only，失敗的高風險操作與 Platform Support 存取也要記錄。metadata 採 allowlist，禁止密碼、Secret、Token、完整 PII、教材全文與完整學生作答。Actor 刪除後以 tombstone reference 保持事件完整，不能保留可逆 email hash 作為替代 PII。

Immutable Audit foundation 必須先於任何新的 lifecycle write flow。Domain Event 不能取代 Audit Event：Domain Event 供跨 Domain projection／workflow 使用，Audit Event 用於證明 actor、policy、before/after 與結果；兩者透過 correlation ID 連結並遵循 `docs/architecture/event-catalog.md` 的 payload／PII 邊界。

## Forward-only Rollout

1. 由 AP-003 完成 Identity／RBAC、re-auth、Platform capability 與 separation of duties。
2. 由 AP-002B 完成 append-only Audit writer、metadata allowlist、RLS 與 failure receipt；沒有 Audit 不開 lifecycle write。
3. 由 AP-002A 以 additive schema 建立 canonical lifecycle，flags 關閉；backfill 遇到 unknown 狀態立即停止。
4. 由 AP-002C 建立 dependency／retention／hold decision 與 impact summary。
5. 由 AP-004 建立 Background Job、Event、Notification 的 idempotency、checkpoint、cancel 與 failure 基礎。
6. 先 Dual-read 並以舊欄位 fallback，再 Dual-write compatible states；新狀態只寫 canonical layer。
7. AP-002D 上線 Organization Closing；AP-002E 上線 Account Privacy／Deletion request。
8. AP-002F 上線 archive/trash/restore 與 Recycle Bin，切換 UI/server 並確認無 legacy delete caller。
9. 以新 Migration 撤銷舊 hard-delete RPC 的 authenticated execute。
10. AP-002G 最後建立 Platform Admin Console；只有依賴、Audit、背景工作、雙人核准與 final scan 完整時，才可評估 permanent deletion UI 與 job。

Rollback 只關 flag、停止 job、保留新資料並以 correction Migration 修正；不 Drop、Truncate、改 ID 或重寫歷史 Migration。

## 不採用方案

- 每個 API 寫死 retention 天數。
- 全域 generic table 保存所有 canonical state。
- 以 Service Role 直接 delete。
- 只保存成功 Audit；失敗高風險操作同樣重要。
- Audit 保存完整 before/after PII。
- 直接 cascade delete Organization content。

## 結果

後續 schema、RLS、RPC、UI、job 與 policy resolver 必須分 Package 實作並通過獨立審核。Domain authority 依 ADR-007，產品能力依 `docs/product/capability-map.md`，事件／Audit correlation 依 `docs/architecture/event-catalog.md`。AP-002 不建立 Identity、RBAC、Event Bus、Queue、Migration 或功能。
