# AI 引擎設計

文件版本：v1.0  
目前狀態：架構規格，尚未串接任何 AI provider

## 目標

AI 引擎負責依結構化教材規格產生原創草稿，不負責取代教師、繞過授權規則或自行決定教材可匯出。所有模型回應皆視為不可信任資料。

## 設計原則

- AI Key 只存在伺服器端，client 不直接呼叫模型供應商。
- 使用 provider interface 隔離模型 SDK，測試以 deterministic mock provider 執行。
- Prompt、模型設定、schema 與審核規則皆需版本化並可追溯。
- 生成使用結構化輸出；不得以自由文字解析作為商用資料寫入依據。
- 先建立教材 blueprint，再依題目或內容單元生成，避免一次產出整份不可控內容。
- 科目規則與 AI provider 分離；可程式計算的答案不交給模型猜測。
- 任務具備冪等性、取消、timeout、錯誤分類、限制重試與成本紀錄。
- 匯出權限由品質管線決定，AI 自評不能單獨使內容通過。
- Education Knowledge Graph 是唯一知識核心；Publisher identity、legacy publisher FK 或來源品牌不得進入 AI context。

## 共用生成流程

```text
已驗證的教師輸入
  → Worksheet Blueprint
  → AI Job + Prompt Version + Schema Version
  → Subject Engine 產生內容
  → Structured Output Schema 驗證
  → 科目規則與答案檢查
  → 內容安全、範圍與重複檢查
  → 第二階段品質審核
  → pass / warning / fail
  → 教師編輯與確認
  → 可匯出版本
```

任何階段失敗都不得把 partial result 當作正式題目發布。為除錯所需的原始回應應最小化、遮蔽敏感資料並依保留政策處理。

## Subject Engine 介面方向

每個科目引擎未來至少提供：

- 支援題型與教材類型。
- 依課程範圍建立 blueprint。
- 建立 provider request 所需的結構化 context。
- 驗證生成內容、答案、難度與範圍。
- 計算或標記品質結果。
- 轉換成共用教材與匯出模型。

預定引擎：Math、Chinese、English；Science、Social、Life 先以 Feature Flag 關閉並保留註冊介面。

## 科目品質策略

### 數學

- 數值、算式與標準答案由規則引擎建立並重新驗算。
- AI 只可協助生成生活情境與年級適切解析，不得改變核心數值關係。
- 檢查餘數、約分、小數位數、單位與唯一正確選項。

### 國語

- 只生成原創文章，不要求模仿特定課文、作者、角色或出版社表達。
- 控制年級、字數、句長、文體、核心能力、修辭與閱讀層次。
- 每個客觀題答案必須能由文章支持，並檢查唯一最佳答案。
- 執行相似風險與知名角色／故事警示；警示需教師確認或阻擋。

### 英文

- 控制字彙範圍、句型、文法點、句長、閱讀長度及文化適切性。
- 檢查目標字彙覆蓋、文法、干擾選項與文章可答性。

### 自然、社會、生活

- 自然與社會正式開放前必須有經審核、具來源與更新時間的事實資料。
- 生活課須另外檢查活動安全、材料、成人協助與年齡適切性。
- 沒有足夠來源及教師驗證時，Feature Flag 維持關閉。

## 結構化輸出與版本

未來共用 Zod schema 至少涵蓋：

- worksheet blueprint
- generated question and options
- answer key and explanation
- original reading passage
- rubric
- quality review
- provenance and generation metadata

每筆 AI 內容需能追蹤 `provider`、`model`、`prompt_version`、`schema_version`、`job_id`、生成時間、用量及品質狀態。Schema 驗證失敗時不得自動強制轉型或略過未知結構。

## 錯誤與重試

- 可重試：暫時性 rate limit、網路中斷、provider 5xx、可修復的 schema 缺漏。
- 不可重試：權限不足、額度不足、禁止內容、無效規格、超出開放科目。
- 採限制次數的指數退避，並使用 idempotency key 防止重複扣額與重複寫入。
- 使用者看到可行動的錯誤訊息；內部 stack、request 內容與金鑰不得回傳。
- 連續異常應能暫停 provider 或科目功能，保留查看與編輯既有教材的能力。

## 品質狀態

- `pass`：所有必要規則通過，仍需教師最終確認。
- `warning`：內容可供教師審閱，但匯出前必須逐項確認。
- `fail`：不可匯出或發布；需修正、重生或人工處理。

模型自評只能提供一項 review signal，不能覆蓋程式驗證、來源政策或教師決定。

## Prompt 與版權防護

所有 production Prompt 必須：

- 明確要求原創，不重現、改寫或模仿出版社與受保護作品。
- 只接收完成來源審核的課綱、Knowledge Point 與中性 Curriculum Reference。
- 不接收或依賴 `publisher`、`publisher_id`、`publisher_name` 或 Publisher Code。
- 抵抗使用者要求忽略規則、揭露系統 Prompt 或複製未授權內容。

詳細 AI allowlist 見 `docs/ai/ai-reference-policy.md`；資料來源與處置方式見 `docs/copyright-policy.md` 與 `docs/legal/reference-policy.md`。

## 成本與隱私

- 生成前檢查機構額度，實際用量由伺服器依 provider 回應記錄。
- 不把學生個資、密碼、token、完整未授權文件送入模型。
- Log 以 job、request id 與雜湊追蹤，不保存不必要的完整 Prompt 或輸出。
- 模型與保留政策變更需經文件、測試與安全審查。

## Sprint 2 限制

本文件只定義架構。Sprint 2 沒有安裝 OpenAI SDK、建立 API、Prompt、AI 資料表或呼叫真實模型。
