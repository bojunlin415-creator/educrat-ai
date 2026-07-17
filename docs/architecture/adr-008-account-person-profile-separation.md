# ADR-008：Account／Person／Profile Separation

狀態：**Accepted**
日期：2026-07-16

## Context

Sprint 1～8 以 Supabase `auth.users` 為登入 authority，並令 `profiles.id = auth.users.id`。此模型適合第一階段，但不能安全表示無登入帳號的學生／家長、同一人的多個登入方式或帳號、Person merge、Person-level Separation of Duties，以及不破壞歷史的 Account deletion。

## Decision

採用「預設一 Account 對一 Person，例外情境由受控 linking／merge 處理」：

1. Authentication Account 保持登入、session、credential、recovery 與 Auth Identity authority。
2. Canonical Person 表示真實世界中的人，可在沒有 Account 時存在。
3. 每個 Account 同一時間只能連到一個 active canonical Person；一個 Person 可在核准流程下連接多個 Account。
4. Profile 只保存個人顯示與體驗資料，不授權、不代表 Organization 身分。
5. 既有 `profiles` 保留作 Account-linked compatibility projection；不得更換 primary key或修改歷史 Migration。
6. Email 不作為 Person 永久識別，也不觸發自動 merge。
7. Person merge 保留 alias／redirect 與 tombstone，不覆寫歷史 actor ID。
8. `user_preferences.active_organization_id` 是 Workspace Preference，不是 Person、Profile 或 Membership authority。

## Rejected alternatives

### Account 永遠等於 Person

無法支援 Managed Student、Guardian 先建後邀請、Account merge、未來 SSO 與一人多 Account。

### 任意 Account–Person 多對多

權限、SoD、RLS 與 UX 都會產生歧義，且容易以多 Account 繞過核准與利益衝突檢查。

### 直接把 `profiles` 改為 Person

會改變既有主鍵與 Account-linked API 語意，增加 Sprint 1～8 破壞性風險，並把顯示偏好和 canonical Person governance 混合。

## Invariants

- `auth.uid()` 只證明 Account，不證明 Person、Membership、Persona 或 Role。
- Account link／unlink／merge 要重新驗證身份、做 conflict review 並寫入 Audit。
- Account hard delete 不得 cascade 刪除 Membership、Persona、教材、教學、學習、評量、Review 或 Audit。
- Linked accounts 的 SoD 以 canonical Person 判斷。
- Auth Identity token、provider credential 與 recovery secret 不複製到 application table。

## Consequences

- 一般登入仍維持現有快路徑，無需改動 OAuth/session。
- 未來 identity read 會增加 Account → Person link 的解析；應使用 server projection 與適當 index，不能把 link graph塞入 session。
- 在 identity migration 完成前，現有 Profile 和 Membership 仍以 Account ID 運作。
- Legacy `ON DELETE CASCADE` 使 Auth hard delete 暫時不可開放；只能透過 forward-only Migration 修正，不改歷史檔案。

## Rollout constraint

本 ADR 不建立資料表或 Migration。實作時採 additive、backfill、dual-read／dual-write、feature gate 與 forward correction；Production gate 見 `docs/data/identity-migration-design.md`。
