# BF-003：Original Curriculum Generation Engine

狀態：Implementation Completed — Awaiting Product Review

BF-003 正式將 EduCraft AI 的 AI 產品方向改為「根據課綱、能力指標、知識點與教學目標生成完全原創教材」。

本 Package 移除 BF-001／BF-002 中殘留的教材版本、進度參考、冊次與 legacy source compatibility input。AI 產品 foundation 不建立出版社 domain、出版社 mapping、出版社章節、Lesson Code 或 Unit Mapping。

## Product Direction

AI 教材生成只能依據：

- 學習階段
- 年級
- 科目
- 學習主題
- 知識點
- 能力指標
- 教學目標
- 教材用途
- 題數
- 難易度
- 是否附解析

## Curriculum Domain

新增或調整的產品語意：

- Curriculum Topic
- Knowledge Point
- Learning Objective
- Competency Indicator
- Topic Hierarchy

不得建立任何出版社 Domain。

## Prompt Design

System Prompt 明確要求：

- 你是一位台灣國民小學課程設計專家。
- 請依照學習主題、知識點、能力指標與教學目標產生完全原創教材。
- 不得引用、改寫、翻譯、重製或摘要任何出版社教材。
- 不得參考教師手冊、題庫、解析、插圖、課文或任何教材比對結果。
- 不得使用 OCR、逐字摘錄、版面仿製或品牌可辨識內容。

## Generation

`generateOriginalCurriculum()` 是新的語意入口。

流程仍為：

1. Input Validation
2. Prompt Build
3. Copyright Safety Validation
4. Provider Health Check
5. Provider Generate
6. Structured Output Validation
7. Knowledge Mapping Validation
8. Domain Result

`generateCurriculum` 目前保留為同一 function 的 compatibility alias，但產品語意以 `generateOriginalCurriculum()` 為準。

## Copyright Safety Validation

新增 `validateCopyrightSafetyText()` 與 `validatePromptCopyrightSafety()`。

檢查：

- Publisher Keyword
- Lesson Mapping
- Prompt Safety
- Forbidden Vocabulary

若使用者輸入或 prompt context 偵測到出版社名稱、教師手冊、題庫、課文引用、課本章節或 mapping 語意，直接 fail closed。

## Boundaries

未實作：

- 教材比對。
- OCR。
- 出版社 mapping。
- 課本章節。
- Lesson Code。
- Unit Mapping。
- 真實 AI provider call。
- API／UI／Database／Migration。

## Future Integration

後續若要接入實際模型，composition root 必須先通過：

1. Copyright Safety Validation。
2. Structured Output Validation。
3. Knowledge Mapping Validation。
4. Teacher Review Workflow。
5. Audit／Authorization integration。
