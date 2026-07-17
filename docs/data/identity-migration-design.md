# Identity Migration Design

狀態：**Approved Architecture Baseline — Not Implemented**
執行狀態：未建立 Migration、未修改 Database、未操作 Production

## 1. Constraints

- 不修改 Sprint 1～8 歷史 Migration。
- 不更換 `profiles.id`，不破壞 Email／Password、Google OAuth、recovery、cookie session、Profile、Avatar、Membership、last-owner 或 active organization fallback。
- Additive first；舊 ID 永久可解析，禁止 destructive rename/drop/truncate。
- AP-003A 只定義 Identity schema候選；Role／Permission、RLS projection 與 assignment 由 AP-003B 決定。
- 未完成 Audit、dependency 與 background job foundation 前，不開放 merge、irreversible anonymization 或 Account hard delete。

### Account hard delete formal gate

Account hard delete保持關閉是正式安全政策，不是 defect。任何 implementation、管理介面或人工 SQL都不得在下列門檻完成前刪除 `auth.users`：

1. Person／Account linking foundation。
2. 完整 FK dependency inventory。
3. Tombstone actor strategy。
4. AP-002B Immutable Audit Foundation。
5. Retention／Legal Hold enforcement。
6. Ownership reassignment與 last-owner protection。
7. Identity anonymization workflow。
8. AP-004 Background deletion job architecture。

門檻完成後仍需以 feature gate、dependency re-check、policy version、fresh approval與 forward-only Migration逐環境驗證；不得把既有 cascade FK視為刪除工具。

## 2. Option comparison

| 方案                                                  | Sprint 1～8 相容 | Managed identity | Account linking               | Query/RLS                           | 風險                    |
| ----------------------------------------------------- | ---------------- | ---------------- | ----------------------------- | ----------------------------------- | ----------------------- |
| A. 保留 `profiles.id = auth.users.id`，另增 `persons` | 高               | 可               | 不完整，缺少顯式 link history | 中                                  | 容易暗示 Account=Person |
| B. `profiles` 直接成為 Person                         | 低               | 勉強             | 差                            | 表面簡單                            | 需改既有主鍵語意，拒絕  |
| C. `persons` + `account_person_links`                 | **高**           | **完整**         | **完整且可治理**              | 查詢多一跳，可建立 projection/index | **推薦**                |

推薦 C：正常流程維持預設一對一，例外才使用受控 linking/merge；不開放任意多對多。

## 3. Candidate entities

以下是候選，不代表全部必須建表：

| Candidate                | 建立條件／目的                                               | AP-003A 建議                                              |
| ------------------------ | ------------------------------------------------------------ | --------------------------------------------------------- |
| `persons`                | canonical Person、privacy/lifecycle、merge target            | 核心候選                                                  |
| `account_person_links`   | Account–Person link history、proof/status                    | 核心候選                                                  |
| `auth_identity_metadata` | 只有需要 app-level provider projection 時                    | 延後；優先依賴 Supabase auth authority，不複製 credential |
| `person_profiles`        | 多 Account 共用 canonical profile 時                         | 分階段評估；先保留 legacy `profiles`                      |
| `personas`               | Managed Student/Guardian、Teacher/Reviewer business identity | 核心候選；欄位由 owning Domain 共同核准                   |
| `guardian_relationships` | 多對多、可驗證、具時效與欄位 scope                           | Future Guardian package                                   |
| `identity_merge_records` | impact、approval、alias、conflict與結果                      | Audit/Job foundation 後                                   |
| `service_principals`     | integration/worker 需要正式 identity 時                      | Future Integration/AP-004；不提前建立                     |

不要為 future possibility 建立空表。每個 candidate 必須在 owning Domain、query、RLS、retention與 Audit contract核准後才進 Migration。

## 4. Proposed additive shape

### `persons` candidate

- `id uuid primary key`
- `status text` with controlled check（初始僅 ACTIVE／MERGED／ANONYMIZED）
- `canonical_person_id uuid nullable`，只供 MERGED alias 指向 canonical Person
- `created_at/updated_at`
- privacy/lifecycle metadata 應使用 typed companion／request，不把所有治理欄位塞入本表

Constraints：alias 不得指向自己；只允許一層 canonical resolution 或由受控 function 保證無 cycle；ANONYMIZED 不保存不必要 PII。

### `account_person_links` candidate

- `id uuid primary key`
- `account_id uuid references auth.users(id)`；FK delete strategy 在 implementation review 決定，不得 cascade Person
- `person_id uuid references persons(id)`
- `status`、`link_type`、`verified_at`、`valid_from/to`
- `created_by_reference`、`merge_record_id?`、`created_at/updated_at`

Constraints/index：每個 Account 最多一個 active canonical link；`account_id,status`、`person_id,status` index；client 不得 direct insert/update；Account ID 不接受 caller 自訂作 authority。

### Persona candidate

- Stable ID、`person_id`、`persona_type`、owning Domain、optional `organization_id`、status、validity、merge alias與最小 metadata。
- 不存 Permission list；Organization/Domain scope 不等於 access grant。

## 5. Legacy compatibility

### Profiles

- `profiles.id = auth.users.id` 保留，不改主鍵／FK或現有 Profile API。
- 第一階段由 Account link 取得 Person；Profile 仍是 Account-linked display projection。
- 當多 Account sharing profile 成為真實需求，再評估 `person_profiles` canonical table；可先 server adapter 決定 primary projection，不能默默以最後寫入覆蓋。
- Avatar object path 暫沿用 Account ID；Person merge 時不能移動物件而不保留 provenance。

### Memberships

- `organization_members.user_id` 與單一 `role` 在 AP-003B cutover 前維持 authority。
- Implementation 可先透過 Account → Person projection讀取，不立即改 membership FK。
- 若 future Membership 需直接 reference Person，可比較「add nullable `person_id` + backfill」與「canonical membership v2」；決策必須與 AP-003B role assignment、managed personas、account deletion一起核准。
- 現有 `user_id ON DELETE CASCADE` 使 Account hard delete不安全。在新的 canonical authority 與 forward FK hardening/companion preservation完成前，Account deletion workflow只能 suspend/anonymize，不可刪 `auth.users`。

### Preferences／last owner

- `user_preferences.user_id` 仍屬 Account-level workspace preference；Account link/merge 不自動合併 active organization。
- 切換 Organization 必須以當前 Account 的有效 Membership重新驗證。
- last-owner protection 繼續以現有 Membership operation生效；Person merge或 Account移轉必須先做 owner dependency inventory與原子轉移。

## 6. Rollout phases

### Phase 0 — architecture approval

核准 ADR-008／009、安全、Privacy、ownership與 AP-003B handoff；不建表。

### Phase 1 — additive identity core（future）

建立最小 `persons`／`account_person_links`、FORCE RLS、最小 grants、fixed-search-path functions與 Audit contract。為每個現有 Auth Account backfill一個 Person + active link，保留 Profile/ Membership原狀。

Backfill requirements：可重入、每 Account deterministic/idempotent、批次 checkpoint、重複/孤兒報告、無 email合併、失敗不改 runtime authority。

### Phase 2 — dual read

- Shadow-read `Account → Person` projection，比對 link完整率與跨租戶 leakage。
- Legacy path仍為 authority；missing/ambiguous link fail closed並告警，不在 client自動修補。

### Phase 3 — managed personas

在 Persona/Guardian owning Domain核准後，建立無 Account的 Student/Guardian flow；所有 external ID opaque，relationship需 verification。

### Phase 4 — controlled dual write

新 Account原子建立 Person/link；Profile onboarding仍更新 legacy Profile。Identity mutation在 AP-002B Audit writer前保持 feature flag off。

### Phase 5 — authority cutover

AP-003B role/policy與 RLS projection核准後，server canonical read轉向 Person/Membership projection；legacy `organization_members.role`仍 dual-read直到差異為零。

### Phase 6 — hardening

以新的 forward-only Migration調整未來 FK／grants／RPC，不改歷史檔；Account hard delete只有在 dependency、retention、Audit、notification與 job gate全部通過後才可考慮。

## 7. RLS and function requirements

- 所有新 public table 必須 ENABLE + FORCE RLS；default deny。
- Person不能形成跨租戶 directory。一般 Organization query只能由有效 relationship取得最小 projection。
- Person本人只能透過 Account link讀取自己資料；不能自行修改 merge、canonical link、platform role或 verified guardian status。
- Managed Persona access須經 Organization/Domain scope，不能因沒有 Account而使用 Service Role繞過正常 authorization。
- SECURITY DEFINER function固定空 `search_path`、使用 `auth.uid()`、撤銷 PUBLIC／anon／不必要 service role execute，只 grant明確 caller。
- 不接受 `p_user_id`、`p_person_id`、`p_role`、`p_organization_id`作 authority；輸入 ID只作目標，server重驗 relationship。

## 8. Merge protection

- Merge先鎖定兩個 Person graph，產生 impact inventory並檢查 owner、Platform role、Guardian、Student、Persona、Membership與 legal hold。
- Canonical choice、alias creation、link transfer與 merge result必須單一 transaction或由可恢復 workflow執行；部分成功不可見。
- 不直接更新所有歷史 foreign key；使用 alias resolution/tombstone保留來源 Person reference。
- Merge conflict進人工 review，不能因相同 email/provider自動 resolve。

## 9. Validation gates

### Development

- 歷史 Migration不變且 local/remote一致。
- Backfill數量、孤兒、重複 active link、cycle、cross-tenant projection為零。
- Email/Google/recovery/Profile/Avatar/Organization/Curriculum regression全通過。
- Account delete cascade simulation證明在功能 gate關閉時不會被呼叫。
- RLS使用不同 Organization、Managed Student、linked Account與 anonymous principal驗證。

### Production

- Architecture + Privacy + Security + AP-003B approval。
- AP-002B Audit writer先行；AP-002A/C lifecycle/dependency gate完成。
- Rollout feature flag、monitoring、backup、rollback/forward-correction runbook完成。
- 無破壞性 backfill；先 shadow read，再小比例 dual write。
- Account hard delete、Person merge、irreversible anonymization保持關閉，直到 AP-004 job/notification與法務核准。

## 10. Rollback／forward correction

- Additive table可停止讀寫並回到 legacy authority；不 drop資料。
- Backfill錯誤以新 correction Migration或受控 repair job修正，不改舊 Migration。
- Dual-write mismatch保留兩側與 correlation/Audit，停止 rollout後人工解析。
- 已建立 Person ID、link ID與alias不可重用；即使回退 runtime也保持可追溯。
