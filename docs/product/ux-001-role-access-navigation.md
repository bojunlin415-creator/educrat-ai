# UX-001 Role Access, Navigation & Admin Control Completion

狀態：Implementation Completed — Awaiting Product Verification

UX-001 補齊角色入口、家長入口、Owner/Admin 權限管理與工作區切換的產品縫隙。此 Package 不新增 AI、報表、營運儀表板、CX/OD 流程，也不操作 Production。

## 範圍

- `/settings/access` 提供 Organization Owner/Admin 的使用者與權限管理頁。
- `GET /api/access/users`、`/roles`、`/guardians`、`/invitations` 提供管理摘要。
- `POST /api/access/roles/assign`、`/remove`、`/members/[id]/disable`、`/enable`、`/guardians/[id]/revoke` 與 `/context/switch` 提供 server-side 操作入口。
- 全域導覽依 server-resolved active organization membership 顯示教師儀表板、家長入口與使用者權限。
- 登入後的預設目的地改由 trusted membership role 解析；無 active organization 時仍回 `/dashboard` 交由既有 onboarding guard。
- Guardian invitation acceptance 與 signup 加入家長流程提示；不建立 guardian self-claim。
- `/dashboard/teacher` 將 service error 顯示為 fail-closed error state，不再讓 React Server Component 直接 runtime crash。
- `/dashboard/student` 僅建立正式學生角色目的地與空狀態，不建立學生作答或學習產品功能。

## Role matrix

| Role               | Trusted source                                             | Home                 | Navigation                             | Access management |
| ------------------ | ---------------------------------------------------------- | -------------------- | -------------------------------------- | ----------------- |
| organization_owner | `organization_members.role` + active organization          | `/settings/access`   | 使用者與權限、教師儀表板、教材、工作台 | Allow             |
| organization_admin | `organization_members.role` + active organization          | `/settings/access`   | 使用者與權限、教師儀表板、教材、工作台 | Conditional       |
| teacher            | `organization_members.role` + active organization          | `/dashboard/teacher` | 教師儀表板、教材、工作台               | Deny              |
| reviewer           | `organization_members.role` + active organization          | `/dashboard/teacher` | 教師儀表板、教材、工作台               | Deny              |
| guardian           | `organization_members.role` + active verified relationship | `/dashboard/parent`  | 家長入口、教材、工作台                 | Deny              |
| student            | `organization_members.role` + active organization          | `/dashboard/student` | 工作台                                 | Deny              |

## Security rules

- Client 不可直接更新 `organization_members.role` 或 `status`。
- 角色管理只能透過 fixed-search-path RPC 執行。
- Owner role 受保護；Owner/Admin 不能自我升權或自我移除。
- Admin 不可建立 Owner，也不可把他人升成 Admin。
- Guardian relationship 不等於 organization staff role。
- Teacher-class relationship 與 organization role 分離。
- Role/context switching 必須由 server-side trusted membership 驗證，不信任 client 傳入的 role。
- Audit 不保存 password、token、raw invitation token、完整學生資料或 submission content。

## Current limitation

現有 `organization_members` 仍是 legacy single-role schema，且 `(organization_id, user_id)` 唯一。UX-001 不能安全支援「同一帳號在同一 organization 同時是 teacher + guardian」的真正多角色資料模型。現階段支援：

- 跨 organization 的 role/workspace switching。
- 同一 organization 內單一 active role 的 trusted context switch。
- Guardian invitation 若遇同 organization 既有非 guardian membership，仍 fail closed。

真正多角色需後續 additive migration 將 role assignment 從 membership 拆出，並保留 legacy compatibility、RLS 與 last-owner protection。

## Verification notes

待產品驗證至少需覆蓋：

- Owner/Admin 開啟 `/settings/access` 並查看 Users/Roles/Classes/Guardians。
- Teacher/Guardian/Student 無法開啟 `/settings/access`。
- Role assignment、member disable/enable、guardian revocation 都走 API/RPC。
- Guardian invitation → verified email login/register → consent → `/dashboard/parent`。
- Teacher Dashboard service unavailable 時顯示可理解 error state。
- E2E 對 multi-role same-organization scenario 需標記為目前 schema blocker。
