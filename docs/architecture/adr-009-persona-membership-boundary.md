# ADR-009：Persona／Membership／Role Boundary

狀態：**Accepted**
日期：2026-07-16

## Context

現有 `organization_members.role` 將租戶關係與單一角色放在同一 row，足以支援 Sprint 6～8 的 owner/admin/teacher/reviewer，但不足以表示 Owner + Teacher + Parent、多 Persona、Managed Student、跨機構不同身份或未來 assignment scope。

## Decision

1. **Membership** 回答 Person 是否屬於 Organization，以及 membership lifecycle／organization scope。
2. **Persona** 回答 Person 在教育流程中是 Teacher、Reviewer、Student、Parent/Guardian 或 Organization Staff。
3. **Role Assignment** 回答 Actor 可執行哪些能力；完整模型由 AP-003B 定義。
4. Persona 與 Role 分離。Persona 不直接授權；Role 也不取代業務 Persona。
5. 同一 Person 可在同一 Organization 有多個 Persona，也可跨 Organization 有不同 Persona 與 Role。
6. Student／Guardian Persona 可在沒有 Authentication Account 時存在。
7. Platform Role Assignment 是獨立 authority，不能放入 Membership role。
8. 現有 `organization_members.role` 在 AP-003B cutover 前保持 runtime authority，不能因本 ADR 放寬或改寫。

## Model comparison

| 模型                             | 結果                                                                  |
| -------------------------------- | --------------------------------------------------------------------- |
| 一 Membership 一 Role            | 保留作 legacy compatibility；不足以支援多角色                         |
| 一 Membership 多 Role Assignment | 推薦給 AP-003B，但尚未定義 table／permission                          |
| Persona 直接綁 Role              | 拒絕；業務身份與授權耦合，難以最小權限                                |
| Persona 與 Role 分離             | **採用**；由 policy 依 Membership、Persona、Role、Scope、資源關係決策 |

## Persona invariants

- Persona 有穩定 ID、type、owning Domain、狀態、有效期與可選 Organization scope。
- Persona suspension/archive 不刪歷史；merge 保留 alias/tombstone。
- Teacher 與 Reviewer 是不同 Persona；同一人可同時擁有。
- Student Account claim 連接既有 Student Persona，不產生第二份 Learning History。
- Guardian relationship 不從 Parent Persona 自動推導；必須是已驗證、具時效與欄位範圍的多對多 relationship。
- Parent 不得以自己的 Account 代替 Student submission。

## Platform boundary

平台員工若同時是某機構的 Parent 或 Teacher，Platform workspace 與 Organization workspace 必須使用不同 authority context。Platform role 不自動建立 Membership；跨租戶支援遵循 AP-002 CASE contract，完整 Policy 留給 AP-003B。

## Consequences

- 未來 workspace switcher 需區分 Organization、Persona／Workspace 與 Role summary，但不代表重新登入。
- RLS 不能只靠 Organization ID 或 Persona type授權；AP-003B 必須定義 Membership、assignment 與 relationship scope。
- 現有單一 role 不會在 AP-003A 被移除、改名或多寫。

## Deferred to AP-003B

Permission naming/catalog、Role permission sets、Scope model、Policy Decision、Organization/Platform Role、Persona-to-role relation、Permission Matrix 與 legacy role dual-read／dual-write。
