# AI Curriculum Reference Policy

- 狀態：Architecture Policy — 尚未串接 AI
- 適用：Prompt builder、Subject Engine、AI Job、品質審核、測試 fixture 與模型觀測資料

## 核心規則

Education Knowledge Graph 是 AI 教材生成的唯一知識核心。Curriculum Reference 只提供進度 Mapping context；legacy Publisher identity 不得成為 Prompt、規則、搜尋、Embedding、評分或生成分支條件。

## 禁止進入 AI Context

任何 Prompt 或 provider request 不得包含或依賴：

- `publisher`
- `publisher_id`
- `publisher_name`
- Publisher Code
- legacy source display name
- legacy mapping table details
- 未經審核的 knowledge source metadata
- 出版社課文、圖片、試題、答案、教師手冊、解析或版面

不得透過別名、自由文字備註或使用者自訂欄位繞過本規則。

## 允許的結構化 Context

AI 只能取得完成 server validation、RLS 與來源治理的：

- Knowledge Point
- Learning Objective
- Teaching Strategy
- Assessment Focus
- Difficulty
- Learning Resource
- Curriculum Reference（中性 ID、type 與 display-independent code）

Curriculum Reference 不能取代 Knowledge Point，也不能直接決定教材內容。

## Source 隔離

- `knowledge_sources` 是治理資料，不是一般 AI input。
- Source name、URL、license notes、internal comments 與 visibility 不得出現在使用者教材或 AI 回應。
- 若事實檢核需要來源，只能由 server 建立經清理的 factual assertions；模型不得自行向使用者揭露來源紀錄。
- `ADMIN_ONLY` 與 `INTERNAL` source 絕不進入 client payload。

## Prompt Builder Contract

未來 Prompt builder 必須使用 allowlist DTO，不接受完整 Curriculum DB row。建議 contract：

```text
AIReferenceContext
├── curriculumReference
├── knowledgePoints[]
├── learningObjectives[]
├── teachingStrategies[]
├── assessmentFocus[]
├── difficulty
└── learningResources[]
```

禁止把 Supabase row 直接序列化送入 provider。

## 驗證門檻

AI Sprint 開始前必須建立：

1. Prompt context Zod schema。
2. 禁止 legacy publisher keys 的 recursive validator。
3. Prompt snapshot／static scan，確認沒有 publisher identity。
4. Knowledge Point 與 Curriculum Reference FK／RLS 測試。
5. Source visibility redaction 測試。
6. 生成紀錄不得保存未遮蔽的 legacy source name。

驗證失敗必須阻擋 AI Job，不得降級為自由文字 Prompt。

## AR-001 限制

本政策不實作 Prompt、AI Metadata、Embedding、Generation 或 Review Workflow。任何 AI 程式開發必須等待 Knowledge Graph 與 Curriculum Reference Migration 通過 Architecture Approval。
