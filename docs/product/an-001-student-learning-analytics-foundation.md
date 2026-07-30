# AN-001 Student Learning Analytics Foundation

狀態：Implementation Completed — Awaiting Product Review

## 目的

AN-001 建立 EduCraft AI 的學習事件與能力分析核心，讓每一次學生作答都能形成不可覆蓋的 learning event，並由事件重建學生知識點掌握度、科目摘要、學習時間線與教師班級摘要。

本 Package 不建立 AI Recommendation、Dashboard、Parent Report、Teacher Dashboard、Organization Dashboard、圖表或自適應學習流程。

## Architecture

- `lib/learning-analytics/`：Learning Event、Knowledge Mastery、Subject Summary、Teacher Class Summary domain、validation、service 與 safe API response boundary。
- `app/api/learning/**`：server-side learning analytics API。
- `supabase/migrations/20260730130000_an001_create_learning_analytics_foundation.sql`：forward-only database foundation。

所有 API 只透過 server-side service 存取資料，不接受 client 傳入可信任 role、organization 或 tenant 權威。

## Learning Event

`learning_events` 是 append-only event table。每次學生作答建立一筆 immutable event，包含：

- assignment、submission、student、class、curriculum、curriculum version references
- question id
- knowledge point id
- optional learning objective id
- subject、grade、difficulty
- correct、score、time spent、attempt number
- answered／created timestamps

事件不可更新、不可刪除；若需要更正，未來必須以 additional event 或 correction event 方式擴充，不覆蓋歷史。

## Knowledge Mastery

`student_knowledge_mastery` 是可重建 projection。每位學生每個 knowledge point 維護：

- correct count
- incorrect count
- attempt count
- accuracy
- mastery score
- mastery level
- last answered time

Mastery Level：

- `unknown`
- `beginner`
- `developing`
- `proficient`
- `mastered`

AN-001 明確不只保存平均分數。

## Subject Summary

`student_subject_summary` 依 student、subject、grade 維護：

- accuracy
- average score
- question count
- knowledge count
- mastery distribution
- last activity

## Timeline

`learning_events` 本身即為 Learning Timeline 的來源。Timeline API 按 answered time 回傳每次作答，不覆蓋能力變化歷史。

## Teacher Summary API

新增 teacher class summary API，提供：

- class accuracy
- knowledge distribution
- weak knowledge ranking
- activity trend

本 Package 只建立 API 與資料 foundation，不建立 Dashboard 或 Charts。

## Authorization

- Student：只能建立／查看自己的 learning data。
- Teacher：只能查看自己負責班級內學生的 learning data。
- Organization Owner/Admin：可查看機構內 learning analytics。
- Cross tenant：fail closed。

## Audit

新增 learning analytics audit foundation：

- `LEARNING_EVENT_CREATED`
- `LEARNING_SUMMARY_VIEWED`

Audit metadata 只保存 reference 與 view type，不保存答案全文、教材內容、PDF、Prompt、Token、Secret 或完整學生私密內容。

## Database

新增 tables：

- `learning_events`
- `student_knowledge_mastery`
- `student_subject_summary`
- `teacher_class_summary`
- `learning_audit_events`

所有 table 啟用 RLS 與 FORCE RLS。Migration 為 additive，不修改歷史 migration。

## Known Limitations

- 尚未建立 AI Recommendation。
- 尚未建立 Dashboard、Charts、Teacher Dashboard、Organization Dashboard。
- 尚未建立 Parent Report 或 Parent Portal。
- 尚未建立 background aggregation job；目前由 server-side write flow 重建 affected projections。
- 尚未建立 production migration 操作紀錄。
