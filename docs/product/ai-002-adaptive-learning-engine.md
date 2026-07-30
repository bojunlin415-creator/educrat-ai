# AI-002 Adaptive Learning Engine

狀態：Implementation Completed — Awaiting Product Review

## Mission

AI-002 建立 Adaptive Learning Engine foundation，根據 AN-001 的 Learning Analytics 產生個人化補救與進階學習推薦。

本 Package 只建立 recommendation foundation，不直接呼叫 AI、不生成教材、不建立 Dashboard、Charts、Notification、Background Scheduler、Parent Report、Teacher Dashboard 或 Organization Dashboard。

## Architecture

- `lib/adaptive-learning/`：framework-neutral adaptive learning domain、weak knowledge detection、knowledge gap analysis、difficulty recommendation、learning path builder、AI-001 handoff interface 與 server-side recommendation service。
- `app/api/recommendations/**`：server-side recommendation API。
- `supabase/migrations/20260730160000_ai002_create_adaptive_learning_foundation.sql`：forward-only recommendation database foundation。

## Adaptive Engine

`AdaptiveLearningEngine` 使用純 domain function 組合：

- `detectWeakKnowledge()`
- `analyzeKnowledgeGaps()`
- `recommendDifficulty()`
- `buildLearningPath()`
- `buildAdaptiveLearningResult()`

Domain 不依賴 React、Next.js、Supabase、OpenAI provider 或 UI。

## Weak Knowledge Detection

依據：

- Knowledge Mastery
- Attempt Count
- Accuracy
- Mastery Score
- Recent Timeline

輸出每個 weak knowledge point：

- risk score
- confidence
- recommendation reason

## Knowledge Gap Analysis

根據 weak knowledge point 建立 gap 說明，指出目前知識點可能阻礙的下一階段能力。本 Sprint 使用 deterministic foundation，不建立完整 Knowledge Graph prerequisite engine。

## Adaptive Difficulty

依 mastery、accuracy、recent trend 決定：

- `easy`
- `normal`
- `hard`

不得直接只用平均分數。

## Learning Recommendation

`learning_recommendations` 保存：

- student
- organization
- subject / grade
- knowledge point
- recommended difficulty
- recommended question count
- recommended curriculum type
- reason

推薦只描述補救或進階教材需求，不直接生成教材。

## Learning Path

`learning_paths` 保存：

- current knowledge point
- next step
- recommended ability
- recommended curriculum

## AI-001 Handoff

新增 `CurriculumGenerationRecommendationPort` 介面，未來可把 recommendation 轉成 AI-001 generation input。

本 Sprint 不呼叫 AI-001、不呼叫 OpenAI、不建立 provider call、不生成教材。

## Authorization

- Student：只能查看自己的 recommendation。
- Teacher：只能查看自己班級學生。
- Organization Owner/Admin：可查看機構內 recommendation。
- Cross tenant：fail closed。

## Audit

新增：

- `LEARNING_RECOMMENDATION_CREATED`
- `LEARNING_PATH_VIEWED`

Audit metadata 不保存 worksheet、答案、AI payload、Prompt、Token 或完整學習內容。

## Database

新增：

- `learning_recommendations`
- `learning_paths`
- `learning_recommendation_audit_events`

所有新表啟用 RLS 與 FORCE RLS。Migration 為 additive，不修改歷史 migration。

## Known Limitations

- 尚未建立完整 Knowledge Graph prerequisite engine。
- 尚未建立 AI provider call 或教材自動生成。
- 尚未建立 Dashboard、Charts、Notification 或 Background Scheduler。
- 尚未建立 Parent Report、Teacher Dashboard 或 Organization Dashboard。
- 尚未套用 Production migration。
