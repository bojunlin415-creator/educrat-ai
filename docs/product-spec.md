# 產品規格

文件版本：v1.0  
產品暫稱：EduCraft AI
市場範圍：台灣國小教育與補教市場

## 產品願景

課堂星球協助台灣國小補習班、安親班與教師，依 Education Knowledge Graph、公開課綱、中性 Curriculum Reference 及教師設定，快速建立可編輯、可追溯且經品質檢查的原創教材。AI 是輔助工具，教師始終保有內容審核與最終決定權。

對外核心聲明：

> 本平台依公開課綱與公開教學進度資訊生成原創補充教材，非出版社官方教材，亦未經相關出版社授權或背書。

## 目標客群

### 第一階段

- 國小補習班與安親班的授課教師
- 補習班主任、機構管理員與教材審核者
- 國小導師、科任教師與家教老師

### 後續階段

- 多分校與連鎖補教機構
- 學生與家長
- 經正式授權合作的教育內容提供者

本產品目前只規劃台灣市場，不將其他國家或學制納入近期開發範圍。

## 使用者角色

| 角色       | 商用核心責任                   | 上線階段       |
| ---------- | ------------------------------ | -------------- |
| 平台管理員 | 管理平台、內容審核、成本與客服 | 商用核心       |
| 機構擁有者 | 管理機構、訂閱、成員與權限     | 商用核心       |
| 機構管理員 | 管理分校、教師與機構教材       | 商用核心       |
| 分校主管   | 管理指定分校與教材流程         | 商用核心       |
| 教師       | 建立、編輯、審閱及匯出教材     | 商用核心       |
| 審核者     | 執行教材品質與內容審核         | 商用核心       |
| 學生       | 接收作業與線上作答             | 預留、預設關閉 |
| 家長       | 查看學習報告與通知             | 預留、預設關閉 |

## 核心原則

1. 對齊公開課綱與教師提供的教學目標。
2. 不重製出版社課文、題庫、教師手冊或未授權內容。
3. Curriculum Reference 只作為 Knowledge Point 與教材進度之間的 Mapping Layer；Publisher 僅保留 legacy compatibility。
4. AI 產出必須經結構化驗證、品質檢查及教師審閱後才能匯出。
5. 清楚呈現處理中、無資料、錯誤與成功狀態。

## 商用核心範圍

第一個可收費版本預計包含：

- Email／OAuth 登入、機構、分校、成員、角色與權限。
- 課綱、Knowledge Point、通用單元及中性 Curriculum Reference。
- 國語、英文、數學的原創教材、試卷、答案與解析。
- 教材建立精靈、逐題編輯、單題重生、版本控制及教材庫。
- 匯出前品質檢查、教師確認、學生版、教師版、PDF 與 DOCX。
- AI 工作追蹤、成本與額度、訂閱、金流狀態、操作日誌及管理後台。

自然、社會及生活科先透過統一 Subject Engine 介面預留，正式開放前須完成各科知識來源、事實檢查與教師驗證。

## 未來功能預留

以下功能納入架構邊界，但不在第一個商用版本全面開放：

- 班級、學生、作業、線上作答及自動批改。
- 能力診斷、補救推薦、家長報告及通知。
- 題目商城、授權、定價與收益分潤。
- PowerPoint、Google Docs、原生手機 App。
- 直播與課堂 session 整合。
- 自然、社會、生活正式生成引擎。

預留不代表提前建立所有資料表或 UI；每項功能仍須由指定 Sprint 建立、驗證與開放。

## 明確不在目前範圍

- 重製或仿寫出版社課文、題庫、教師手冊、答案及插圖。
- 宣稱與康軒、南一、翰林或其他出版社官方同步或合作。
- 自動抓取、破解、上傳或保存整本教材。
- 教師未確認即自動匯出或發布 AI 教材。
- 未經指示操作 production 資料、金流或部署。

## 主要產品流程

```text
教師選擇課程範圍與教材用途
  → 系統建立結構化教材規格
  → 科目引擎產生原創內容
  → 規則與 AI 品質檢查
  → 不合格內容重試或阻擋
  → 教師預覽、編輯及確認警告
  → 通過檢查後匯出學生版／教師版
```

## 機構多租戶流程

Sprint 6 建立商用 SaaS 的租戶邊界：完成 Profile onboarding 的使用者可建立第一個機構，建立者由資料庫原子流程自動成為 `organization_owner`，並將該機構設為 active organization。使用者可屬於多個機構，但每次 server request 都必須重新確認 active membership，不能信任瀏覽器傳入的角色或 organization id。

目前開放角色為機構擁有者、機構管理員、教師與審核者；`branch_manager`、`student`、`guardian` 只在資料庫受控值中預留，尚未提供操作介面。Sprint 6 只建立建立者 membership；成員邀請與細緻 RBAC 必須由後續明確授權的 Sprint 實作，Curriculum Editor 不放寬 membership write。

## 教材核心結構

Sprint 7 先建立教材結構，不建立 AI、題庫或試卷。AR-001 將既有 publisher-centered model 限縮為 legacy compatibility，使用者介面改用「課綱通用版／教學進度模板 1、2、3／自訂教學進度」的 Curriculum Reference 語意；新資料表須由後續獨立 Migration 工作建立。

每份教材屬於 active organization，保存教材名稱、科目、年級、Curriculum Reference、學年度、學期與狀態。建立教材時同步建立初始版本，舊版本不得被新內容覆蓋。Sprint 8 已開放版本 1 下的章節／課次 CRUD、草稿／發布狀態、學習目標、預估時間、教學備註與同層排序；版本本身唯讀，尚不建立版本 2。

Lesson 另以 backward-compatible 欄位預留 grade-relative `difficulty`（1–5，可空）與人類可讀 `keywords`。欄位隨 Curriculum Version 階層保存並沿用 organization RLS，可直接成為 Sprint 12 Engine 的結構化輸入，但本階段不保存 Prompt、模型、Embedding、生成來源或 review workflow。

owner/admin 可建立與修改教材，teacher/reviewer 目前為唯讀。所有 API 與資料查詢都在伺服器重新確認 active organization 及 membership，client 不可指定 organization 或 created-by。

## 非功能需求

- 安全：跨機構資料完全隔離，敏感操作可追溯，私密金鑰不得外洩。
- 可用性：主要流程提供 loading、empty、error、success 狀態。
- 響應式：桌面、平板及手機皆可完成主要操作。
- 可追溯：題目保存來源、模型、Prompt、schema、審核與教師修改版本。
- 可維護：科目、AI provider、匯出及金流使用清楚介面，不將規則散落於頁面。
- 品質：`fail` 教材不得匯出，`warning` 必須經教師確認。

## 成功衡量方向

- 老師能在可接受時間內完成一份可用教材並順利匯出。
- 客觀題答案與解析一致，數學可驗算題目達到零已知錯答上線門檻。
- 跨機構資料洩漏事件為零。
- 每份匯出教材皆具備品質檢查與教師確認紀錄。
- 可追蹤 AI 任務成功率、重試率、教師修改率與單份教材成本。

## 已完成範圍

- Sprint 1：頁面骨架、共用 UI、示範驗證與測試基礎。
- Sprint 2：產品、系統、資料、AI、版權、測試及協作規範。
- Sprint 3：Supabase SSR 基礎、profiles schema、RLS 與資料庫健康檢查。
- Sprint 4：Email／Google 身分驗證、密碼復原、session callback 與受保護 Dashboard。
- Sprint 5：使用者個人資料、首次 onboarding、私有 Avatar 上傳與 user-scoped Storage RLS。
- Sprint 6：機構／補習班、owner membership、active organization、機構 onboarding／settings／switcher 與跨租戶 RLS。
- Sprint 7：科目、年級、出版社進度參考、教材、不可覆蓋版本、章與課的核心結構，以及 organization-scoped 教材列表、建立、詳細與編輯流程。
- Sprint 8：版本 1 唯讀的 Curriculum Editor、章節與課次 CRUD、server-validated 排序、樹狀導覽、Dashboard 章課統計，以及 owner/admin 寫入與 teacher/reviewer 唯讀權限。
- AR-001：Knowledge Graph 核心、Curriculum Reference Mapping Layer、legacy display adapter，以及待核准的 forward-only Migration Design。

目前仍未實作分校、成員邀請、細緻 RBAC、版本 2／發布稽核、AI 生成、題庫、試卷、品質檢查或匯出。Sprint 6 不開放任意加入機構或修改成員角色；這些能力保留給後續授權 Sprint。Production 未執行任何 Migration 或部署。Sprint 4 的 Google OAuth 尚待人工驗收，密碼復原 session 綁定仍是正式商用前的高優先修正。
