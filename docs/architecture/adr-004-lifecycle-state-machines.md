# ADR-004：Lifecycle State Machines

- 狀態：**Accepted — Architecture Approved**
- Architecture Package：AP-002
- 日期：2026-07-16

## 背景

現有 Organization、Membership、Curriculum、Version、Chapter 與 Lesson 各自有 `status`，但狀態語意、可逆性、保留要求與核准責任不同。若未來只提供任意 `PATCH status`，會讓使用者跳過 last-owner、dependency、retention、legal hold、re-auth 與 Audit。

## 決策

1. 每個 Aggregate 定義明確 state machine 與合法 transition；禁止任意狀態跳轉。
2. 狀態更新只能由 Domain transition service／受控 RPC 執行，不提供 direct table mutation。
3. 每次 transition 使用 current state + `state_version` 做 optimistic concurrency，並在 transaction 內重新檢查依賴。
4. Lifecycle request 與 Domain current state 分離：request 可 pending/blocked/cancelled，Domain row 只記 canonical current state。
5. 永久刪除採 request → grace → dependency final scan → approval → background execution，不是同步 CRUD。
6. 高風險 transition 即使失敗也必須留下 Audit Event。
7. AI Agent、Notification handler 與 background job 都不能自行核准 transition；job 只消費已核准且未過期的 capability。
8. Authentication Account、Person Profile、Organization Membership、Domain Persona 與 Platform Role Assignment 各自有 lifecycle；任何一項 transition 不得隱含修改其他四項。
9. Lifecycle state 由 owning Domain 定義與寫入；Governance 只編排 request、approval、dependency、retention 與 Audit，不以 generic table 取代 Domain authority。

## Organization 狀態

`ACTIVE`、`SUSPENDED`、`ARCHIVED`、`PENDING_DELETION`、`DELETION_BLOCKED`、`DELETED`。

合法轉換固定為：

- ACTIVE → SUSPENDED
- SUSPENDED → ACTIVE
- ACTIVE/SUSPENDED → ARCHIVED
- ARCHIVED → ACTIVE
- ARCHIVED → PENDING_DELETION
- PENDING_DELETION → ARCHIVED
- PENDING_DELETION → DELETION_BLOCKED
- DELETION_BLOCKED → PENDING_DELETION
- PENDING_DELETION → DELETED

`DELETED` 是終止狀態，只保留 tombstone 與依法保存資料。

## Account 狀態

`INVITED`、`ACTIVE`、`SUSPENDED`、`ARCHIVED`、`PENDING_DELETION`、`ANONYMIZED`、`DELETED`。Account transition 不得直接變更 Organization content 或歷程；必須先解析 Membership、Ownership、Domain identities、legal hold 與 Audit actor。

Account lifecycle 不等於 Person Profile、Persona 或 Platform Role lifecycle。Profile anonymization、Membership removal、Teacher／Student／Parent／Reviewer Persona retirement 與 Platform role revocation 必須由各 owning Domain 另行處理，並透過版本化 contract 協調。

## Membership 狀態

`INVITED`、`ACTIVE`、`SUSPENDED`、`ARCHIVED`、`REMOVED`。最後一位 active owner 不得被 suspend、archive、remove、降級或 leave。Ownership transfer 必須在同一 transaction 完成，且 transfer 前後都保持至少一位 active owner。

## Curriculum 階層

- Curriculum：draft/active 可 archive、restore、trash；hard delete 只限無 protected dependency 的未發布內容。
- Curriculum Version：published 後不可覆寫或 hard delete，只能 retired/superseded。
- Chapter/Lesson：無下游歷程時可 trash；一旦有 Teaching/Learning/Assessment dependency，只能 archive/retire。

## 與現有資料的相容

不修改 Sprint 1～8 Migration。未來以 additive typed companion state 或新 canonical 欄位承接完整狀態；現有 `status` 僅作相容讀寫。現有 `organizations.status` 與 `organization_members.status` 不足的狀態不得硬塞入既有 check constraint。

Sprint 8 的 delete RPC 暫時保留作 legacy compatibility。新 lifecycle flow 完成並切換所有 caller 後，以新的 forward-only Migration 撤銷 authenticated execute；不 Drop 函式、不重寫歷史。

## 不採用方案

- 單一 generic `status`：無法表達不同 Aggregate 不變量。
- Client 直接更新狀態：會繞過 dependency 與 Audit。
- 以 soft delete 取代所有 lifecycle：無法區分 archive、trash、pending、blocked 與 legal retention。
- 使用 PostgreSQL enum 作全域狀態：未來演進與 Domain 差異成本過高。

## 結果

未來 API、RPC、UI 與 background job 必須遵循 state machine；任何新的 Entity 必須先定義 lifecycle、authority、retention 與 Audit，才能提供刪除入口。Domain 邊界依 ADR-007，能力對照依 `docs/product/capability-map.md`，事件契約依 `docs/architecture/event-catalog.md`。本 ADR 不建立 Identity、RBAC、Event Bus、Queue、程式或 Migration。
