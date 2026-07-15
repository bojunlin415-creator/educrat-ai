# ADR-003：Curriculum Reference Abstraction

- Architecture Request：AR-001
- 狀態：Accepted — 條件修正已完成
- 日期：2026-07-15
- 決策範圍：Curriculum、Knowledge Graph、AI context 與 legacy compatibility

## 背景

Sprint 7 以 `publishers` 與 `curriculums.publisher_id` 建立第一版教材進度參照。該結構已套用至 Development，並被 Sprint 8 Curriculum Editor 使用，因此歷史 Migration、既有資料、舊 RPC 與舊 API 都必須保留。

長期產品不能以 Publisher 作為教材 Domain 或 AI context。教材內容必須源自 Education Knowledge Graph；版本進度只是一層可替換的相容 Mapping，不能成為知識真實性的來源。

## 決策

EduCraft AI 採用下列依賴方向：

```text
Education Knowledge Graph
        │
        ▼
Curriculum Reference Layer
        │
        ▼
Curriculum
        │
        ▼
Curriculum Version
        │
        ▼
Chapter
        │
        ▼
Lesson
```

1. Knowledge Graph 是教材知識、能力與關聯的唯一核心。
2. Curriculum Reference 是 Knowledge Point 與教材進度之間的 Mapping Layer。
3. Publisher 不再屬於新 Domain Model。
4. `publishers`、`publisher_id`、舊 RPC 與舊 API 僅保留為 Legacy Compatibility。
5. AI Prompt、Subject Engine、生成任務與品質檢查禁止依賴 Publisher identity。
6. 未來教材透過 Knowledge Point Mapping 建立；Curriculum Reference 不得直接 Mapping Lesson。

## Domain 邊界

### Curriculum Reference

未來新增 `curriculum_references`，至少包含：

| 欄位              | 設計                                                  |
| ----------------- | ----------------------------------------------------- |
| `id`              | UUID primary key                                      |
| `organization_id` | nullable；global reference 為 null，CUSTOM 可屬於機構 |
| `code`            | 中性且穩定的 machine code，不含來源品牌               |
| `display_name`    | 使用者可見的中性名稱                                  |
| `reference_type`  | `CORE`、`CUSTOM`、`REFERENCE`、`SYSTEM`               |
| `status`          | `active`、`inactive`、`archived`                      |
| `display_order`   | 非負排序值                                            |
| `description`     | 中性用途說明，不保存受保護內容                        |
| `created_at`      | UTC timestamp                                         |
| `updated_at`      | UTC timestamp                                         |

首批 global references：

- 課綱通用版（`CORE`）
- 教學進度模板 1（`REFERENCE`）
- 教學進度模板 2（`REFERENCE`）
- 教學進度模板 3（`REFERENCE`）
- 自訂教學進度（`CUSTOM`；實際自訂實例須 organization-scoped）

不得建立 Publisher Type。

教學進度模板是中性的進度相容工具，不是任何出版社的官方版本，也不代表合作、授權、代理、贊助或背書。對外名稱、代碼、排序與說明不得形成可辨識的一對一品牌替身；legacy deterministic mapping 只能留在 server compatibility layer，不能出現在 UI、公開文件、一般 API 說明或 AI context。

### Knowledge Source

未來新增 `knowledge_sources`。它只記錄知識來源治理，不是教材全文來源，也不是使用者教材庫。

至少包含：`id`、`organization_id`、`source_type`、`name`、`description`、`license_type`、`visibility`、`created_at`、`updated_at`。

`source_type`：

- `CURRICULUM_STANDARD`
- `PUBLIC_RESOURCE`
- `SELF_CREATED`
- `ORGANIZATION`
- `AI_GENERATED`
- `MANUAL`

`visibility`：

- `ADMIN_ONLY`
- `INTERNAL`
- `PUBLIC`

Source provenance 不得出現在一般 Curriculum DTO、使用者教材、匯出文件或 AI 回應。只有經授權的治理流程可以查詢完整來源紀錄。

### Curriculum Reference Mapping

未來新增 `curriculum_reference_mappings`，最少包含：

- `id`
- `curriculum_reference_id`
- `knowledge_point_id`
- `knowledge_source_id`（nullable）
- `sequence_no`
- `mapping_type`
- `status`
- `effective_from`
- `effective_to`
- `created_at`
- `updated_at`

依賴方向固定為：

```text
Curriculum Reference
  → Curriculum Reference Mapping
  → Knowledge Point
  → Lesson Knowledge Point Mapping
  → Lesson
```

`curriculum_reference_mappings` 禁止包含 `lesson_id`。Lesson 與 Reference 不得直接相連。

目前尚未建立 `knowledge_points`，因此 mapping table 必須等 Knowledge Graph schema 經獨立審查後，與可驗證的 FK 一起建立；不得先放置沒有 FK 的鬆散 UUID。

## Reference Display Adapter

AR-001 在不修改資料庫的前提下先建立 server-side Display Adapter：

- 讀取 legacy reference row。
- 轉換為 `{ id, code, displayName, referenceType }`。
- UI 只接收 `CurriculumReferenceDisplay`。
- 原始 source name/code 不得進入 UI 或未來 AI context。
- 舊 API 欄位形狀暫時保留，但 `publisher.name`／`publisher.code` 只回傳中性相容值。
- 舊 API request `publisherId` 仍可使用，server 立即正規化為 `curriculumReferenceId`。

這是 Anti-Corruption Layer，不代表新 Domain 依賴 legacy publisher。

## Migration Design（本次不執行）

### 新增物件

未來只以新的 forward-only Migration 新增：

1. `curriculum_references`
2. `knowledge_sources`
3. `legacy_publisher_reference_mappings`（admin-only 相容表）
4. `curriculums.curriculum_reference_id` nullable FK
5. `curriculum_reference_mappings`（Knowledge Point schema 核准後）
6. 必要 indexes、updated-at triggers、RLS、column grants 與受控 RPC v2

不得修改已套用 Migration，不得 Rename、Drop、Truncate 或刪除舊資料。

### FK 設計

- `curriculums.curriculum_reference_id → curriculum_references.id`，初期 nullable，`ON DELETE RESTRICT`。
- `legacy_publisher_reference_mappings.publisher_id → publishers.id`，`ON DELETE RESTRICT`。
- `legacy_publisher_reference_mappings.curriculum_reference_id → curriculum_references.id`，`ON DELETE RESTRICT`。
- `curriculum_reference_mappings.curriculum_reference_id → curriculum_references.id`。
- `curriculum_reference_mappings.knowledge_point_id → knowledge_points.id`。
- `curriculum_reference_mappings.knowledge_source_id → knowledge_sources.id`，nullable。

### Backfill Strategy

1. Seed CORE、教學進度模板 1／2／3、CUSTOM global definitions。
2. 在 admin-only compatibility table 建立 legacy row 與中性模板的 deterministic mapping；不得對外公布品牌對照。
3. 以 mapping table 回填所有既有 `curriculums.curriculum_reference_id`。
4. 每批回填記錄筆數與 checksum；遇到未知 legacy row 時停止，不猜測 mapping。
5. 驗證每個現有 Curriculum 都保留原 ID、Version、Chapter 與 Lesson。
6. 通過跨租戶與資料完整性驗收後，才允許新 API 使用新 FK。

### Dual Write Strategy

- 新 API/RPC v2 以 `curriculum_reference_id` 為 canonical input。
- 過渡期透過 `legacy_publisher_reference_mappings` 取得相容 `publisher_id`，在同一 transaction 寫入兩欄。
- 舊 API/RPC 仍以 `publisher_id` 運作；server 透過 mapping 補出 `curriculum_reference_id`。
- CORE、CUSTOM、SYSTEM 在開放建立前必須具備明確 legacy compatibility mapping；不得以任意既有 publisher row 代填。
- Dual-write 任一欄失敗時整筆 rollback，不得留下半遷移 Curriculum。
- AI、Knowledge Graph 與新 UI 永遠只讀新 reference，不讀 legacy 欄位。

### Rollback Plan

本架構採 forward-only rollback：

1. 關閉 `curriculum_reference_layer` feature flag。
2. 新寫入暫停或切回已驗證的舊 API/RPC。
3. 保留新增 table、欄位與 backfill 資料，不 Drop、不 Delete。
4. 使用新的 correction Migration 修正 mapping 或資料。
5. 舊 `publisher_id`、舊 RPC 與舊 API 在整個過渡期持續可用。

### 相容性門檻

- Sprint 1～8 全部測試必須維持通過。
- 現有 Curriculum／Version／Chapter／Lesson ID 與組織歸屬不得改變。
- RLS 仍以 organization boundary 為最終授權，不信任 reference id。
- 舊 request `publisherId`、DB `publisher_id` 與 RPC `p_publisher_id` 保留。
- API 不得向 UI 洩漏原始 legacy source name/code。
- Migration local／remote history 只能新增版本，不得重寫歷史。

## AI 邊界

AI 只能接收經驗證的 Knowledge Point、Learning Objective、Teaching Strategy、Assessment Focus、Difficulty、Learning Resource 與中性 Curriculum Reference。詳細規則見 `docs/ai/ai-reference-policy.md`。

## 法務與內容邊界

Reference 不代表內容授權。進度模板的中性命名只能降低來源混淆，不能授權複製受保護教材，也不得被宣稱為官方版本。詳細規則見 `docs/legal/reference-policy.md`。

## 不採用方案

### 直接 Rename publishers

拒絕。會修改已套用架構、破壞 DB types、RPC、API 與現有資料相容性。

### 只修改 UI 字串

拒絕作為最終架構。它無法阻止 API、AI context 或後續 Domain 持續依賴 Publisher。

### Reference 直接連 Lesson

拒絕。會繞過 Knowledge Point，讓教材結構再次依賴外部版本編排。

## 結果與代價

優點：Knowledge Graph 可獨立演進、AI context 中性、舊資料可持續運作、來源治理與使用者教材分離。

代價：過渡期需維持 adapter、legacy mapping、雙欄寫入與兩套 API contract 測試；真正移除 legacy schema 必須另案審查，AR-001 不處理。
