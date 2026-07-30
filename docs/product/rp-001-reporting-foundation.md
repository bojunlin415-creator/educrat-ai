# RP-001 Reporting Foundation

狀態：Implementation Completed — Awaiting Product Review

RP-001 建立 Teacher、Parent 與 Organization Dashboard 未來共用的報表資料層。此 Package 只建立 Reporting Domain、Aggregation、ViewModel、Shared Reporting API 與 Report Export Model foundation；不建立 Dashboard UI、Charts、Scheduled Reports、Email Reports 或通知。

## Architecture

- `lib/reporting/domain.ts` 定義 framework-neutral reporting view models、匯出合約與 deterministic aggregation helper。
- `lib/reporting/service.ts` 是 server-side Reporting Service，Dashboard 與 API 不應直接查詢 Learning Analytics tables。
- `app/api/reports/*` 提供 Shared Reporting API，所有輸入先經 Zod schema 驗證，再進入 Reporting Service。
- `report_audit_events` 提供 RP-001 報表查看與未來匯出的 audit foundation；不保存報表 payload、PDF、Excel、CSV、圖表、作答內容或 provider response。
- `report_cache` 是 optional cache foundation，不改變 Learning Analytics source of truth。

## Reporting Aggregation

RP-001 聚合來源限定為已存在的 AN-001／AI-002 projection：

- `learning_events`：產生 student learning trend。
- `student_knowledge_mastery`：產生 weak knowledge 與 mastery summary。
- `student_subject_summary`：產生 student overall accuracy 與 subject-level distribution。
- `teacher_class_summary`：產生 class、teacher 與 organization-level comparison。
- `learning_recommendations`：產生 recommendation count 與 recommended difficulty summary。

所有 aggregation 必須可重新計算，且不得依賴 UI state。

## View Models

### Student Report

- `overallAccuracy`
- `masterySummary`
- `weakKnowledge`
- `learningTrend`
- `recommendedDifficulty`
- `recommendationCount`

### Teacher Report

- `classAccuracy`
- `studentRanking`
- `weakKnowledgeRanking`
- `activityTrend`
- `assignmentCompletion`

### Organization Report

- `organizationAccuracy`
- `classComparison`
- `teacherComparison`
- `knowledgeDistribution`
- `learningActivity`

## Export Model

RP-001 只建立 interface-level export contracts：

- PDF Export Contract
- Excel Export Contract
- CSV Export Contract

本 Package 不實作 PDF／Excel／CSV rendering，不建立 storage，不建立 scheduled report，也不提供公開下載 URL。

## Authorization

- Student：只能查看自己的 report。
- Teacher：只能查看自己負責班級中的學生與 class report。
- Organization Owner/Admin：可查看 organization-scoped report。
- Cross tenant：fail closed。

目前 authorization 依既有 organization membership、class ownership 與 RLS boundary；未來可接 AP-004 product authorization adapter。

## API

- `GET /api/reports/student`
- `GET /api/reports/teacher`
- `GET /api/reports/organization`
- `GET /api/reports/export-options`

`export-options` 只回傳匯出能力契約，不執行實際匯出。

## Audit

- `REPORT_VIEWED`
- `REPORT_EXPORTED`

RP-001 實作的 report view endpoint 寫入 `REPORT_VIEWED`。`REPORT_EXPORTED` 留給未來真正 export execution 使用。

## Database

新增 additive migration：

- `20260730190000_rp001_create_reporting_foundation.sql`

新增：

- `report_audit_events`
- `report_cache`（optional）

未修改：

- `learning_events`
- `student_knowledge_mastery`
- `student_subject_summary`
- `teacher_class_summary`
- AI、Assignment、Class 或 Curriculum tables

## Explicitly Deferred

- Teacher Dashboard UI
- Parent Dashboard UI
- Organization Dashboard UI
- Charts
- Email Reports
- Scheduled Reports
- Notification
- Real PDF／Excel／CSV export renderer
- Report cache invalidation job
- AP-004 product authorization cutover
