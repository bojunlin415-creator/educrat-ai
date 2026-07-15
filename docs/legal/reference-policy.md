# Curriculum Reference Legal Policy

- 狀態：Architecture Policy
- 適用：資料蒐集、知識治理、Curriculum Reference、AI context、測試、教材輸出與營運後台

## 產品定位

EduCraft AI 依公開課綱、自建 Knowledge Point、教師設定與經治理的事實性 Mapping 建立原創補充教材。Curriculum Reference 是進度相容層，不是出版社教材、授權證明或官方合作標示。

本文件是產品與工程控制規則，不取代正式法律意見。商用前仍須由台灣智慧財產權專業人士審閱。

## 禁止保存或處理

不得在資料庫、Storage、Prompt、Embedding、測試、log、匯出或備份保存出版社的：

- 課文或實質段落
- 圖片、插圖、Logo 或視覺素材
- 試題、題庫或習作題目
- 答案
- 教師手冊
- 解析
- 具創作性的表格、編排、版面或單元表達
- 掃描、破解、下載或來源不明的教材檔案

也不得以少量改字、換數值、換角色、改順序或 AI 改寫規避限制。

## 允許進入治理流程

在確認授權或合法使用依據後，可保存必要且最小化的：

- 公開課綱
- 能力指標
- 自建 Knowledge Point
- 學習目標
- 教學方法
- 補救策略
- Assessment Mapping
- Knowledge Mapping
- 客觀的學年度、學習階段與進度索引事實

允許項目仍需記錄來源類型、license、visibility、取得日期、審核狀態與使用範圍。

## Reference 命名

使用者介面只使用：

- 課綱通用版
- 教學進度模板 1
- 教學進度模板 2
- 教學進度模板 3
- 自訂教學進度

不得使用足以讓使用者誤認官方同步、授權、合作、原版或題庫來源的品牌、Logo、圖像或文案。

## Source Provenance

- `knowledge_sources` 只記錄知識治理，不保存不必要全文。
- `ADMIN_ONLY` source 只允許授權管理者與法務治理流程查看。
- `INTERNAL` source 不得進入一般 API、UI、教材或 AI 回應。
- `PUBLIC` 只代表可公開顯示的治理狀態，不等於自動取得商用授權。
- AI 不得向使用者揭露 source identity、URL、license notes 或 internal comments。

## Mapping 規則

- Curriculum Reference 只能 Mapping Knowledge Point。
- 不得把外部教材章課結構直接複製為 Lesson。
- Lesson 必須透過自建或合法治理的 Knowledge Point Mapping 建立。
- 進度模板的中性命名不能取代來源與相似風險審查，也不得形成對外可辨識的一對一品牌替身。

## 發現疑似受保護內容

1. 立即阻擋發布、分享、AI Job 與新匯出。
2. 不在 issue、log 或聊天中複製疑似內容。
3. 只保留最小事件 metadata 與必要雜湊。
4. 通知指定法務／內容治理角色。
5. 以新的規則、correction migration 或內容處置修正；不得覆寫稽核紀錄。

## AR-001 限制

本政策只建立 Architecture Boundary。AR-001 不擷取、匯入、轉換或刪除任何外部教材內容，也不建立資料庫 Migration。
