# Retention and Deletion Policy Architecture

- 狀態：**Accepted — Architecture Approved**
- Architecture Package：AP-002
- 類型：Data governance architecture（未實作，非法律意見）

## 1. 目的

定義 EduCraft AI 如何以版本化 policy 判斷保存、封存、匿名化、回收與永久刪除。本文件不自行宣稱台灣或其他 jurisdiction 的具體法定保存期限；正式設定需經法律、隱私、財務與教育治理審查。

## 2. Policy Layers

決策優先序：

```text
Legal / Regulatory Requirement
  → Platform Minimum Policy
    → Organization Extension
      → Resource-specific Hold
```

- Organization policy 只能延長或增加保護，不能低於 legal/platform minimum。
- Legal/support/security hold 覆蓋正常 deletion schedule。
- Policy change 只向前生效；不得回溯破壞已建立的保存承諾或紀錄。
- 每次 lifecycle decision 保存實際使用的 `policy_key`、`policy_version` 與 effective date。

## 3. Policy Model

未來 policy 至少包含：

| 欄位                         | 說明                               |
| ---------------------------- | ---------------------------------- |
| `policy_key`                 | 穩定 machine key                   |
| `entity_type`                | 適用 Entity                        |
| `jurisdiction`               | 法域／地區；不得由 client 任意指定 |
| `organization_plan_or_type`  | 商業方案或機構類型條件             |
| `retention_duration`         | 可配置期間；不在程式碼寫死         |
| `deletion_grace_period`      | 可取消等待期                       |
| `anonymization_rule`         | 欄位 allowlist、方式與不可逆性     |
| `legal_hold_override`        | hold 行為與優先序                  |
| `export_requirement`         | 執行前是否必須完成匯出             |
| `policy_version`             | 不可覆寫的版本                     |
| `effective_at`／`expires_at` | 生效窗口                           |
| `approved_by`／`approved_at` | 治理核准 reference                 |

Policy record 發布後不可直接覆寫；建立新版本並保留舊版供歷史 decision 重現。

## 4. Policy Categories

### Business Retention

Organization settings、Membership workflow、教材工作資料與營運紀錄。需區分 active、archived、trashed 與 deleted tombstone。

### Security Retention

登入、安全事件、role/access、failed high-risk action。內容最小化，但需支援事件調查與風險偵測。

### Billing Retention

Subscription、Invoice、refund、tax reference。Invoice 原則上不可一般 UI 刪除，只能 void/credit note；期限由財務／法律政策決定。

### Education Record Retention

Teaching Session/History、Learning Event/History、Assessment、Attempt、Response、Homework/Submission。一般使用者不可 hard delete；必要時採 correction、withdrawal marker 或依法匿名化。

### Minor／Guardian Privacy Retention

Student、Guardian、Enrollment 與教育歷程需區分退班、畢業、封存、權利請求與必要保存；不得以刪除 Account 直接破壞歷程。

### AI Input／Output Retention

Prompt context、generation、quality result、cost/provenance 分別定義。禁止保存 legacy publisher identity、Secret、不必要 PII 或未授權教材；可用 hash/structured metadata 時不保存全文。

### Notification Retention

依 channel、法定通知、delivery receipt 與一般產品訊息分開。法定／刪除通知不可與一般已讀訊息同期限處理。

### Audit Retention

Audit append-only，依事件級別與 legal/security requirement 保存；外部 archive 只能由受控 export/warehouse 流程，不得讓一般 UI 刪除。

## 5. Hold Model

Retention hold scope 可為 Platform、Organization、Account、Entity 或 Request。至少記錄 hold type、reason code、scope、applied/released by、effective window、case/legal reference、policy version 與 Audit correlation。

Hold type 至少預留：legal、support dispute、security incident、billing/refund、export in progress、regulatory request。Hold reason text 採最小必要資料，不保存完整案件內容。

套用 hold 後：

- 暫停 permanent deletion 與 destructive anonymization。
- Archive／read-only 可依 policy 繼續，但不得破壞 evidence。
- UI 顯示安全 blocker 與聯絡路徑，不向無權限者揭露法律細節。
- Release 需要明列角色、reason、re-auth 與 Audit；Support 不能自行 release。

## 6. Deletion Decision

每次決策依序檢查：

1. Resource 與 tenant scope。
2. Actor permission、re-auth、separation of duties。
3. Current lifecycle state 與 version。
4. Direct/downstream dependencies。
5. Applicable policy set 與最嚴格 effective rule。
6. Retention/legal/support/security/billing hold。
7. Ownership reassignment、export、notification、grace。
8. Anonymize、archive、trash 或 delete 的最小破壞方案。
9. Audit decision snapshot。

標準決策結果沿用 AP-002 dependency result model。Client 不提供 policy version 作最終權威；server policy resolver 選擇並回傳。

## 7. Anonymization

- Anonymization 不等於將 email 換成可逆 hash；必須評估重識別風險。
- Organization content 的 `created_by` 不改成任意其他真人；改用 actor tombstone/controlled system reference。
- 歷史顯示名稱可變成中性標記，但 Audit 保留不可修改的內部 reference。
- 對分析資料採 aggregate/minimum grain；小樣本與未成年人群組需額外抑制。
- Anonymization 規則版本化，執行結果保存 redaction status 與欄位計數，不保存原值於 Audit。

## 8. Recycle Bin 與 Archive

- Archive 用於仍需保留且可能恢復的 Aggregate；不啟動永久刪除倒數。
- Recycle Bin 只適用可安全還原的 working data，並具有 restore deadline 與 parent/dependency validation。
- Permanent delete request 是獨立 workflow；不因 restore deadline 到期就由 client 同步刪除。
- Knowledge Point、published Version、History、Invoice、Audit 不進一般 Recycle Bin。

## 9. Account 與 Organization 刪除

Organization delete 先盤點所有 Domain、Owner、Membership、exports、Billing、jobs 與 holds，只保留 tombstone、依法保存 Billing/Security/Audit。Account delete 先解析多 Organization、唯一 Owner、Domain identities 與歷程；Organization-owned content 不 cascade。

`auth.users`、Profile、Membership 的 FK cascade 不是產品刪除流程。受控 account workflow 必須先完成 companion state、ownership transfer、actor tombstone 與 retention decision，才可移除 eligible auth data。

## 10. Immutable Audit

Audit 只保存 allowlisted metadata、state transition、result、reason code、policy version、request/correlation ID 與遮罩環境資訊。禁止完整 PII、Password、Token、Secret、教材內容與學生作答。Audit redaction 只能附加 redaction marker／替代顯示，不覆寫原始事件鏈。

## 11. Migration 原則

- 只新增 forward-only Migration，不修改 Sprint 1～8 歷史。
- 所有治理表 ENABLE/FORCE RLS，FK 預設 RESTRICT。
- 先 schema/flags off，再 backfill/dual-read/write，最後才開 UI/job。
- `organizations.status/deleted_at` 與 Membership legacy status 在過渡期保留。
- 不直接 cascade delete Organization data。
- rollback 關 flag、停 job、保留資料、以 correction Migration 修正。

## 12. 待法務與治理核准

1. 各 jurisdiction／Entity 的具體 retention duration。
2. 未成年人與 Guardian 的刪除、告知、代理與 export 規則。
3. Billing／Invoice／Tax data 的保存與匿名化限制。
4. Education records 的更正、撤銷、匿名化與保存義務。
5. Audit 外部 archive、查詢與 export retention。
6. AI input/output、quality/provenance 與使用者上傳內容的保存政策。

## 13. 尚未實作

本文件不建立 policy table、resolver、hold、job、API、UI、Migration 或法定期限設定。
