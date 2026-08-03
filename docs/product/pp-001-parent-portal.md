# PP-001 Parent Portal

狀態：Implementation Completed — Final External Verification Required

PP-001 建立家長入口，讓已驗證 guardian-child relationship 的家長以友善語言查看孩子的學習摘要、作業狀態、弱點知識點與練習建議。

## Architecture

資料流固定為：

```text
RP-001 Reporting Service
  → Parent-specific ViewModel
  → Parent Portal API
  → Parent Portal UI
```

Parent Portal 不直接查詢 `learning_events`、`student_knowledge_mastery`、`student_subject_summary`、`teacher_class_summary`、`learning_recommendations`、`assignment_submissions`。RP-001 仍負責報表聚合；PP-001 只做家長專用 projection 與安全呈現。

## Guardian Access Model

PP-001 新增最小持久化模型 `student_guardians`：

- `relationship_type`：`parent`、`legal_guardian`、`authorized_caregiver`、`other_verified_guardian`
- `status`：`pending`、`verified`、`active`、`revoked`
- 只有 `active`、`verified_at` 不為空且完成 consent / activation 的關係可讓 guardian 查看孩子摘要。
- Teacher 不會因為教學關係自動成為 guardian。
- Student 不能建立 guardian relationship。
- Client 沒有 `student_guardians` insert/update grant，不能自行升級 status。

GV-001 已建立 Organization-issued invitation、verified email match、explicit consent 與 active relationship activation flow。完整 guardian self-claim、legal-document verification、consent revocation UI 與 parent account linking 仍需後續 Package。

## Parent Report ViewModel

家長端只呈現：

- Learning Progress：整體正確率、mastery summary、友善狀態文字
- Strengths：優勢摘要
- Needs Improvement：弱點知識點與練習優先級
- Assignment Summary：作業數量、狀態與近期項目
- Recommended Practice：練習建議摘要
- Parent Insight：rule-based 家長友善提醒
- Recent Activity：近期趨勢摘要

不顯示原始作答、`mastery_score` 欄位名、內部 recommendation reason、raw report row、完整答案、prompt 或 provider response。

## API

新增 server-side API：

- `GET /api/dashboard/parent`
- `GET /api/dashboard/parent/children`
- `GET /api/dashboard/parent/students/[studentId]/summary`
- `GET /api/dashboard/parent/students/[studentId]/assignments`
- `GET /api/dashboard/parent/students/[studentId]/recommendations`

所有 endpoint 均要求登入、active organization membership、guardian role 與 active verified relationship。未授權、revoked、cross-tenant 或 unlinked child 均 fail closed 並回傳安全錯誤。

## GV-001E Final Verification Coverage

Formal Playwright coverage is provided by `tests/e2e/guardian-parent-portal.spec.ts`:

- Organization Admin creates guardian invitations through the formal API.
- Guardian uses the matching verified email account to preview minimal child info, explicitly grants consent and activates the relationship.
- Parent Portal displays linked child, Child Selector, Learning Progress, Assignment Summary, Strengths, Needs Improvement, Recommended Practice and Parent Insight.
- Multi-child selector verifies one guardian can view multiple legitimate children without mixing data.
- Revocation through the formal server-side boundary immediately removes child access.
- Wrong email, replay token, unrelated child, cross-tenant read and direct mutation attempts fail closed.

## UI

新增 `/dashboard/parent`：

- Child Selector
- Learning Progress Summary
- Assignment Summary
- Strengths
- Needs Improvement
- Recommended Practice
- Parent Insight
- Recent Activity
- No-child empty state

UI 不作為安全邊界；所有資料由 server service 驗證後提供。

## Audit

新增 `parent_portal_audit_events`：

- `PARENT_DASHBOARD_VIEWED`
- `PARENT_STUDENT_REPORT_VIEWED`
- `GUARDIAN_INVITATION_CREATED`
- `GUARDIAN_INVITATION_ACCEPTED`
- `GUARDIAN_CONSENT_GRANTED`
- `GUARDIAN_RELATIONSHIP_CREATED`
- `GUARDIAN_RELATIONSHIP_REVOKED`

Audit metadata 不保存 report payload、答案、內部 reason、AI prompt、provider response 或未成年敏感內容。

## Boundaries

PP-001 不建立：

- Parent messaging
- Notifications
- Email reports
- Scheduled reports
- Dashboard charts
- Organization dashboard
- Parent payment
- AI tutor
- Guardian self-claim
- Legal-document verification
- Full consent revocation lifecycle

Production migration 未由代理自動套用。
