# Platform Admin Governance

- 狀態：**Accepted — Architecture Approved**
- Architecture Package：AP-002
- 類型：Security architecture（未實作）

## 1. 安全目標

Platform 管理能力用於營運、合規、支援與安全事件，不是繞過租戶 RLS 的萬用入口。任何跨租戶資料存取都要符合 purpose limitation、least privilege、time bound、separation of duties 與 full audit。

## 2. 角色責任

### PLATFORM_SUPER_ADMIN

- 僅處理最高治理、角色管理、emergency action、retention hold 與 permanent-delete approval。
- 不能作為日常客服帳號；應使用獨立強驗證、短 session 與 break-glass 流程。
- 不因角色自動取得教材內容日常瀏覽權。
- Level 3 必須 fresh re-auth、理由、案件、二次核准；不得自我核准與執行。

### PLATFORM_ADMIN

- 管理 Organization/Account 狀態、deletion review 與授權範圍內的 Audit。
- 可 suspend/restore、要求補件、block request；不可執行 permanent delete。
- PII 只在具體案件與欄位 allowlist 下查看。

### PLATFORM_SUPPORT

- 只能查看指派案件與遮罩後技術摘要。
- 無 permanent delete、platform-role elevation、retention-hold release、force-close 權限。
- PII 解鎖需額外核准、fresh re-auth、短 TTL，存取本身產生 Audit。

### PLATFORM_AUDITOR

- 唯讀 Audit、policy、compliance 與 security summary。
- 不修改業務資料或 lifecycle state。
- Audit export 需 scope、理由、re-auth、watermark/trace reference 與 export Audit。

## 3. Platform 與 Organization 邊界

- Platform role assignment 與 `organization_members` 分離。
- Platform user 不自動加入 Organization，也不改寫 active organization preference。
- Platform API 使用獨立 authorization context，不重用 Organization Owner helper。
- Organization Owner/Admin 不能授予 Platform role。
- Platform Admin 不能透過直接修改 Membership row 取得租戶內容。
- Organization content ownership 永遠屬 Organization；Platform 只依法／依契約處理。

## 4. Case-scoped Access

跨租戶支援存取至少需要：

| 欄位              | 規則                                          |
| ----------------- | --------------------------------------------- |
| `case_id`         | 必須存在且狀態允許調查                        |
| `purpose_code`    | allowlist；不可自由使用「其他」繞過           |
| `resource_scope`  | Organization + entity + record IDs            |
| `field_allowlist` | 只回傳必要欄位；預設遮罩 PII                  |
| `approved_by`     | 高風險不得為同一 actor                        |
| `expires_at`      | 短期；不可永久                                |
| `reauth_at`       | PII/export/high-risk 必須 fresh               |
| `correlation_id`  | 串連 access、query、export 與 lifecycle Audit |

拒絕、過期、超範圍與無結果查詢也應寫安全 Audit，避免只記成功存取。

## 5. PII 分級與遮罩

- Level 0：公開／非個人摘要，如 Organization ID、狀態、方案類型。
- Level 1：營運識別，如遮罩 email/phone、member count；Support 可案件式查看。
- Level 2：完整聯絡資料、identity links；Admin 需用途與 fresh re-auth。
- Level 3：未成年人、guardian、教育紀錄、完整 response；預設不向 Support/Admin 顯示，需特別合規流程。
- Secret、Password、Token、session、provider credential 永遠不可顯示。

## 6. High-risk Action Controls

| Action                        | Initiator                              | Approver                                | Executor           |
| ----------------------------- | -------------------------------------- | --------------------------------------- | ------------------ |
| Organization permanent delete | Owner request／Platform Admin review   | Platform Super Admin + second authority | Controlled job     |
| Account anonymization/delete  | Subject request／Platform Admin review | Platform Super Admin                    | Controlled job     |
| Retention hold release        | Platform Admin/Auditor recommendation  | Authorized governance role              | Controlled RPC/job |
| Platform role elevation       | Existing Super Admin                   | second Super Admin/security authority   | Controlled RPC     |
| Force close                   | Security/governance incident           | Super Admin dual approval               | Controlled job     |

任何 action 都不能由 Service Role 任意 SQL 代替產品治理流程。Production 直接 SQL 只可作正式 incident procedure，需事前／事後 Audit、雙人操作與復原紀錄。

## 7. Session 與 Re-auth

- Platform Console 使用比一般 Workspace 更短的 session assurance。
- Level 2/3 需 fresh re-auth；時間窗由 policy 配置，不寫死在 UI。
- Platform role 變更立即使舊 capability 與高風險 session 失效。
- Break-glass session 不可與一般瀏覽 session 混用，且需通知安全責任人。

## 8. Audit 與觀測

最低事件：login/reauth、role assignment/revocation、case access granted/denied/expired、PII revealed、cross-tenant query、export、lifecycle request/approval/block/cancel、retention hold、job execution。

Audit metadata 不保存完整 query result、學生作答、教材內容、password、token 或 secret。偵測異常：大量跨租戶查詢、Support PII 解鎖、短時間多次 export、self-approval、過期 capability、無案件查詢。

## 9. Platform Console 資訊架構安全

- `/platform/*` 與 Organization navigation 分離。
- Overview 只顯示 aggregate metrics，不支援點入任意教材內容。
- Search 對 email/phone 做 exact/limited search，結果遮罩；禁止模糊列舉全平台使用者。
- Permanent delete、force close、hold release、platform role bulk change、cross-tenant audit export 禁止 bulk。
- Mobile 不移除 re-auth、reason、impact 或 second-approval step。

## 10. RLS 與資料存取方向

未來平台治理表全部 ENABLE/FORCE RLS。Platform authorization helper 只回答具體 permission/scope，不回傳全能 boolean。跨租戶業務資料由專用治理 RPC 回傳最小 DTO；不得給 platform roles 一般 table-wide select。Service Role 不進 client/session，也不作平台使用者身分。

## 11. 測試門檻

- 每個 Platform role 的 allow/deny/conditional case。
- 無 case、錯 case、過期 capability、錯 Organization、超欄位 allowlist。
- Support PII 遮罩與 Auditor read-only。
- self-approval、同一人申請/核准/執行的阻擋。
- failed action Audit、export Audit、role revocation 即時失效。
- 跨租戶 URL/IDOR、RLS recursion、Service Role client scan。

## 12. 尚未實作

本文件不建立 Platform role、RLS、Console、API、session、case、Audit 或 job；只建立未來安全契約。
