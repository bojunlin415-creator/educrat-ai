# Identity and Minor Data Privacy

狀態：**Approved Architecture Baseline — Not Implemented**
本文件定義產品／架構責任，不宣稱特定法定保存期限或已完成法律審查。

## 1. Data classification

| 類別                       | 範例                                                     | 最小可見範圍                                           | Masking／跨租戶規則                                         |
| -------------------------- | -------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| Authentication Data        | email、provider、login/recovery metadata                 | Person 本人、最小 Platform Security                    | 一般 Organization 不看 provider/recovery；跨租戶禁止        |
| Profile Data               | display name、avatar、locale、preferences                | 本人；業務必要的成員可見 projection                    | contact／preference 按目的遮罩，不建立全域 Person directory |
| Organization Identity Data | Membership、staff status、role assignment                | 該 Organization 的有效授權範圍                         | Organization A 不得看 B 的 Membership／role                 |
| Education Persona Data     | Teacher、Reviewer、Student、Guardian                     | Persona owning Domain 與有效 Organization relationship | Persona type 不可跨 Organization 推導                       |
| Sensitive Minor Data       | Student identifiers、Guardian relation、learning records | 本人／已驗證 Guardian／assigned educational scope      | 預設最小欄位；不可用 email/student ID 直接查詢              |
| Platform Governance Data   | Platform role、CASE grant、security events               | 授權 Platform Governance/Auditor                       | Organization 只看必要結果，不看完整平台權限／案件           |

## 2. Privacy principles

- Purpose limitation：Identity lookup 不能被重用成行銷名單、跨機構 Person 搜尋或學生關係探索。
- Data minimization：Managed Student 只建立教育流程所需最小 Person／Persona資料；沒有登入需求不建立假 Account。
- Tenant isolation：同一 Person 的跨 Organization 關係不能成為 Organization 間的共用檔案。
- Relationship verification：Parent/Guardian access 以已驗證且仍有效的 relationship 決定，不以姓氏、email 或自稱關係決定。
- Child safety：家長與學生帳號分離；Guardian 不能代替學生作答，學生也不能查看其他 Guardian 私密資訊。
- Explainability：link、claim、merge、anonymize 與 denial 必須提供不洩漏他人身份的安全說明。
- No AI authority：AI 不取得 Identity graph、Auth Identity、Platform role 或完整未成年 PII；如需教學 context，只提供 domain-approved 最小 projection。

## 3. Responsibility matrix

| 資料／請求                   | 查看／匯出責任                                         | 更正責任                                   | 刪除／匿名化責任                     | Audit access                       |
| ---------------------------- | ------------------------------------------------------ | ------------------------------------------ | ------------------------------------ | ---------------------------------- |
| Auth Account／Identity       | Person + Platform Identity policy                      | Platform Identity／provider                | Platform privacy workflow            | Security/Auditor 最小資訊          |
| Profile                      | Person                                                 | Person；必要時 Platform support            | Person request + retention decision  | 僅高風險變更                       |
| Membership                   | Person + Organization authorized roles                 | Organization；Person 可提出更正            | Organization lifecycle；不刪 Account | Organization audit projection      |
| Student Persona              | authorized Organization、Student/Guardian relationship | Organization + privacy correction          | archive/anonymize，不能刪必要歷史    | 授權 Governance/Auditor            |
| Guardian Relationship        | relationship parties + authorized Organization         | Organization verification；Guardian 管偏好 | 終止／撤銷，歷史依 retention         | 驗證與變更必記錄                   |
| Learning／Assessment history | Student／verified Guardian／assigned staff             | Domain correction workflow                 | 一般使用者不可刪；依法匿名化         | 最小且不可修改                     |
| Platform role／CASE          | Platform Governance                                    | Platform Governance                        | governed revoke/expire               | Platform Auditor；存取本身被 Audit |

## 4. Guardian and dependent privacy

- Relationship 必須分開表示 `legal_guardian_status`、report access、communication access、consent authority、emergency contact、validity 與 verification；不能用單一 boolean 取代。
- 一名 Guardian 只看自己獲准的 Student fields；不得看見其他 Guardian 的 email、電話、legal status 或 consent detail。
- Relationship ended/suspended 後立即停止新 access，但依法／政策保留歷史 decision reference。
- Guardian data export 只含其本人與合法 relationship 範圍，不自動包含其他家庭成員完整資料。
- Student Account claim 不改變 Guardian relationship，也不把 Guardian consent 永久複製到 Account。

## 5. Account deletion and anonymization

- Account deletion 撤銷登入能力；不等於刪除 Person、Persona、Membership 或業務紀錄。
- Person anonymization 移除非必要 PII，保留不可反推的 tombstone reference、policy version與歷史完整性。
- Organization-owned curriculum、teaching／learning history、assessment、review與 audit 不隨 Account cascade。
- Legal hold、security investigation、billing dispute、last owner、未完成 export／notification 或跨 Organization membership 可以阻擋最終操作。
- 不在本文件指定期限；Retention policy 需版本化、按 jurisdiction/record type 評估。

## 6. Cross-organization prohibition

Organization A 不能查看、推測或搜尋同一 Person 在 Organization B 的 Account、Membership、Persona、role、Student、Guardian relationship 或學習資料。Platform Support 跨租戶 access 只能依 AP-002 的 CASE、遮罩、目的、有效期與 Audit contract；不能建立常駐全域 Person 搜尋。

## 7. Deferred legal decisions

學生可自行建立 Account 的年齡／同意規則、監護證明方式、各教育紀錄保存期限、資料可攜格式、跨境處理與未成年行銷限制需由後續 Privacy/Legal review 明確決定。
