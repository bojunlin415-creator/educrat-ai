# ADR-005：Platform vs Organization Administration

- 狀態：**Accepted — Architecture Approved**
- Architecture Package：AP-002
- 日期：2026-07-16

## 背景

EduCraft AI 是多租戶教育平台。Platform 人員需要支援、合規與安全處置，但 Platform Admin 若被視為全域 Organization Owner，會破壞資料所有權、最小權限與客戶信任。

## 決策

1. Platform role 與 Organization Membership 完全分離。
2. Authentication Account、Person Profile、Organization Membership、Domain Persona 與 Platform Role Assignment 依 ADR-007 分離；Platform role 不能被當成 Profile 屬性或 Organization Persona。
3. `PLATFORM_SUPER_ADMIN`、`PLATFORM_ADMIN`、`PLATFORM_SUPPORT`、`PLATFORM_AUDITOR` 不自動成為任何 Organization member。
4. Organization Owner/Admin 只能治理自己的 tenant，不能查看或操作其他 Organization。
5. Platform 日常畫面只顯示營運摘要與遮罩 PII；教育內容與學生私密資料不是客服預設可見資料。
6. 跨租戶內容存取採 case-scoped just-in-time capability，必須包含案件、用途、理由、資料欄位 allowlist、期限、re-auth、核准者與 Audit。
7. Level 3 操作採 separation of duties：申請人、核准者與 execution job 不得是同一 authority。
8. Platform Support 不能 permanent delete、變更最高權限或解除 retention/legal hold。
9. Platform Auditor 唯讀；Audit export 本身也需理由、re-auth 與 Audit。
10. Platform Super Admin 是 break-glass／最高治理角色，不供日常客服使用。
11. AI Agent、background job 與 integration principal 都不是 Platform role；只能取得單次、最小範圍 capability。

## 導航與資料層隔離

- Platform Console 使用 `/platform/*` 與獨立 navigation、authorization helper、session assurance 與 Audit middleware。
- Organization Workspace 使用 active organization context 與既有 tenant RLS。
- Platform Console 不得假裝切換為某 Organization 來繞過 tenant RLS。
- 未來跨租戶讀取必須使用專用治理 API，回傳遮罩後 DTO，不直接回傳 Supabase row。

## Platform Access 契約

每次高風險查詢至少驗證：

```text
platform role
case or request id
approved purpose
resource scope
field allowlist
access expiry
re-auth freshness
separation of duties
retention/legal restrictions
```

存取結果不得包含 Secret、Token、密碼、完整學生作答或無關教材內容。資料存取、export、拒絕與過期嘗試都要寫 Audit。

## 不採用方案

- 將 Platform Admin 加入每個 Organization：會污染 Membership、Ownership 與歷史。
- 使用 Service Role 作一般管理後台 session：範圍過大且無法套用使用者授權。
- 只靠 UI 隱藏：API 與 DB 邊界仍會外洩。
- 永久的跨租戶 impersonation：缺乏目的限制、期限與客戶透明度。

## 結果

Platform 管理台與 Organization Settings 必須分離開發、測試與 Audit。Domain authority、RACI、published/consumed contract 依 ADR-007；Platform Console 能力狀態依 `docs/product/capability-map.md`，跨 Domain 通知／治理事件依 `docs/architecture/event-catalog.md`。正式 Identity、RBAC、Event Bus 與 Queue 不在 AP-002 實作範圍，後續 Package 必須遵循此 ADR。
