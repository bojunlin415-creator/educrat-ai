# Identity Security Model

狀態：**Approved Architecture Baseline — Not Implemented**
適用：AP-003A Identity Domain；不代表安全功能已實作

## 1. Trust boundaries

```text
Untrusted client
  → Auth/session verification
  → Account reference from auth.uid()
  → Server identity projection
  → Membership/Persona relationship verification
  → AP-003B permission decision（future）
  → Domain invariant
  → RLS final tenant boundary
```

Account、Person、Profile、Membership、Persona、Role 與 Platform authority 是不同證據。任何一項存在都不能單獨推導其餘項目。

## 2. Mandatory rules

1. 不信任 client 傳入的 `user_id`、Account ID、Person ID、Membership ID、Persona ID、Role 或 Organization ownership。
2. 真人 Account identity 一律以已驗證 `auth.uid()` 為起點。
3. `profiles.id` 或 Profile 欄位不得作為跨租戶授權證據。
4. 每次 Organization 資料存取須重新驗證 active Membership 與資源 tenant；active organization preference 不授權。
5. Persona 只表示業務身份，不直接授權。
6. Role／Permission／Scope 由 AP-003B 定義；AP-003A 不建立 bypass。
7. OAuth email、provider subject 或相同 email 不等於已驗證 Person linkage。
8. Account link 必須重新驗證所有相關 Account，並依風險要求 recovery／MFA hook。
9. Account 不得自行附加 Platform Role Assignment。
10. 不允許使用同 Email 自動合併具 Ownership、Guardian、Student 或 Platform 身份的 Account。
11. Managed Student／Guardian 使用不可猜測 internal ID；不得暴露連號或以 email 作 public lookup。
12. Guardian Relationship 必須經受控驗證，不能只憑 email 或 Teacher 聲明。
13. Platform Support 不得搜尋後自行認領 Person、Membership 或 Guardian relationship。
14. Service Principal 不得使用真人 refresh token、cookie 或 Account credential。
15. AI 不得持有 Account session、refresh token、Platform role 或 Service Principal credential。
16. Session 不保存完整 Permission、PII、Guardian graph 或 Student scope；只保存最小 session claim/reference。
17. Identity lookup、link、claim 與 recovery endpoint 必須避免 account／person enumeration。
18. Login／link error 不得透露 email、Account 或 Person 是否存在。
19. Profile update 不能改變 Auth Identity、canonical Person link、Membership、Persona 或 Platform role。
20. Identity link、unlink、merge、claim、guardian verification 與 platform assignment 必須使用 immutable Audit contract。

## 3. Account linking and merge controls

- Linking 與 merging 是不同操作：link 增加受控 Account–Person relation；merge 解析兩個 Person graph 的衝突。
- 高風險 Person merge 不提供單擊 client API；只能送出 review request，由 server 產生 impact summary。
- 必查 Membership／last owner、Platform role、Student／Guardian relation、Persona、Ownership、Audit actor、provider identity 與 email conflict。
- 同一發起者不得自行完成高風險 merge；雙人核准與 re-auth contract 由 AP-003B/AP-002B 定義。
- Alias Person 不能重新成為 active canonical target；任何 link graph cycle 都必須由 constraint/service 阻擋。
- Merge 失敗必須原子 rollback；不能留下部分 Membership 或 identity 已轉移的狀態。

## 4. Student and guardian controls

- Student account claim 使用一次性、短效、不可從 Student ID 推測的 claim proof。
- Claim 要驗證 Organization、Student Persona 狀態、既有 Account link、Guardian/consent policy 與邀請有效期。
- Guardian 只能取得 relationship 明確允許的欄位，不得看見其他 Guardian 的 contact／legal data。
- Organization A 不能得知同一 Person 在 Organization B 的 Persona、Membership、role 或 relationship。
- 未成年人資料輸出、修改、link、unlink 與 anonymization 必須依 Privacy policy；權限不足時使用一致錯誤，不洩漏關係存在。

## 5. Platform and service identities

- Platform role 不等於 Organization member；Platform Support 只能透過限時 CASE grant 與資料遮罩取得存取。
- Platform workspace 與私人 Organization/Parent workspace 不在同一 authority request 中混用。
- elevated session 顯示 case、Organization、能力、到期時間；離開後立即失效。
- Service Principal 每個用途獨立，最小 capability、scope、owner、rotation、expiration 與 audit identity；禁止共用全域 service secret。
- `service_role` 不是日常 Platform Admin 或測試真人流程的替代品。

## 6. Failure and observability

- 對外錯誤使用 allowlist；SQL、provider subject、internal Person/Membership existence、stack 與 policy detail不回傳。
- 失敗 link/merge/claim 要記 security counter；是否長期寫 Audit 依 AP-002B sampling/threshold，避免保存過量 PII。
- 任何 link graph integrity error、last-owner conflict、跨租戶 Person exposure 或 unexpected cascade 都是 release blocker。
- Log／Audit 不得含密碼、token、recovery code、完整 email、完整未成年資料或 Google credential。

## 7. Implementation gates

- AP-003B：Role／Permission／Scope 與 re-auth policy。
- AP-002B：append-only Audit writer；在它之前不開放 identity mutation。
- AP-002A/C：account/person lifecycle 與 dependency protection。
- AP-004：非同步 merge inventory、通知與 irreversible deletion／anonymization job。
