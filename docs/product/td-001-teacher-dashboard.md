# TD-001 Teacher Dashboard

狀態：Implementation Completed — Awaiting Product Review

TD-001 建立 Teacher Dashboard UI、API 與 rule-based teaching insight foundation。Dashboard 建立於 RP-001 Reporting Foundation 上；Learning data 必須透過 Reporting Service 取得，不得由 Dashboard 直接查詢 Learning tables。

## Architecture

- `lib/teacher-dashboard/domain.ts` 定義 dashboard view model、overview、insight、student ranking、weak knowledge 與 recommendation panel model。
- `lib/teacher-dashboard/service.ts` 組合 RP-001 Reporting Service、Class／Assignment service 與 dashboard audit writer。
- `app/dashboard/teacher` 呈現 Teacher Dashboard page；原 `/dashboard` 只提供入口，不讓報表載入失敗影響既有教材工作台。
- `components/teacher-dashboard/teacher-dashboard.tsx` 呈現 Teacher Dashboard layout；Chart 僅使用 framework-neutral chart model，不綁定特定 chart library。
- `app/api/dashboard/teacher/*` 提供 server-side shared dashboard API。

## Dashboard Layout

首頁包含：

1. Today's Overview
2. Teaching Insights
3. Class Performance
4. Student Performance
5. Weak Knowledge
6. Assignment Status
7. AI Recommendation

## Today's Overview

- Today's Active Students
- Assignments Due
- Assignment Completion Rate
- Average Accuracy
- Recent Learning Activity

## Teaching Insights

目前採 rule-based，不呼叫 OpenAI。

來源：

- RP-001 Teacher Report
- Weak Knowledge aggregation
- Assignment completion

輸出自然語言摘要與下一堂課建議。

## Class Performance

- Average Accuracy
- Mastery／Weak Knowledge distribution
- Knowledge Distribution
- Learning Trend
- Assignment Completion

## Student Performance

支援排序概念：

- Needs Attention
- Most Improved
- Highest Accuracy
- Highest Activity

## Weak Knowledge

顯示：

- Knowledge Point
- Affected Students
- Risk Level
- Recommendation Count

## AI Recommendation Panel

TD-001 不直接呼叫 OpenAI，也不產生新教材。

Recommendation panel 使用 AI-002 recommendation vocabulary 與 RP-001 weak knowledge aggregation 產生教師可讀的推薦方向：

- Recommended Worksheet
- Recommended Difficulty
- Recommended Topic
- Recommendation Reason

## Assignment Status

- Pending
- In Progress
- Submitted
- Overdue

## API

- `GET /api/dashboard/teacher`
- `GET /api/dashboard/teacher/classes`
- `GET /api/dashboard/teacher/students`
- `GET /api/dashboard/teacher/insights`

## Authorization

- Teacher：只能查看自己班級。
- Organization Owner/Admin：可查看機構內教師儀表板資料。
- Student：不得存取 Teacher Dashboard。
- Cross tenant：fail closed。

## Audit

新增：

- `TEACHER_DASHBOARD_VIEWED`
- `TEACHING_INSIGHT_VIEWED`

Audit metadata 不保存 dashboard payload、charts、學生作答內容、Prompt 或 provider response。

## Database

新增 additive migration：

- `20260730210000_td001_create_teacher_dashboard_audit.sql`

只新增：

- `teacher_dashboard_audit_events`

未新增或修改：

- Learning tables
- Analytics schema
- Parent Dashboard tables
- Organization Dashboard tables
- Notification／Scheduled Report tables

## Explicitly Deferred

- Parent Dashboard
- Organization Dashboard
- Email Report
- Notification
- Scheduled Report
- Real chart library adapter
- AI-generated teaching insight
- Dashboard cache invalidation policy
