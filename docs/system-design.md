# 系統設計

文件版本：v1.0

## 現況架構

```text
瀏覽器
  └─ Next.js App Router
      ├─ Server Components：首頁、Dashboard、頁面外框
      ├─ Client Components：登入表單、Dialog、錯誤重試
      ├─ Route Handler：登入示範資料的伺服器端 Zod 驗證
      ├─ 共用 UI：Button、Input、Select、Card、Dialog、Alert、Spinner
      └─ 測試：Vitest / Testing Library / Playwright
```

目前已建立 Supabase SSR client、Next.js 16 Proxy、環境驗證、`profiles` Migration 與資料庫健康檢查。尚未連接實際 Supabase 專案，也沒有 AI provider、背景工作、儲存、金流或正式監控整合。

### Supabase SSR 邊界

- `lib/supabase/client.ts`：Client Components 使用 publishable key 的 browser client。
- `lib/supabase/server.ts`：Server Components、Server Actions 與 Route Handlers 使用 request cookies 建立獨立 client。
- `lib/supabase/proxy.ts`：透過 Next.js 16 `proxy.ts` 同步 refresh cookie，並以 `auth.getClaims()` 驗證 token。
- `lib/env/public.ts`：驗證瀏覽器可用的 Supabase URL 與 Publishable Key。
- `lib/env/server.ts`：server-only 私密設定邊界；Sprint 3 不使用 Service Role。
- `/api/health/database`：呼叫不讀取資料的 `database_health()` RPC；未設定或不可用時回傳不含內部錯誤的 503。

Proxy 只負責 session cookie 更新，不作為最終授權層。後續受保護頁仍必須在伺服器端驗證 claims／user，資料存取仍受 RLS 限制。

### Auth 流程

- Email 登入／註冊、忘記密碼與更新密碼由 Route Handler 接收 JSON，先限制大小、驗證 Content-Type 與 Zod schema，再呼叫 Supabase Auth。
- Google OAuth 由伺服器建立 PKCE URL，瀏覽器只接收經 schema 驗證的外部 redirect URL。
- `/auth/callback` 只接受有長度限制的 code，以及 `/dashboard`、`/reset-password` 兩個白名單目的地，避免 open redirect。
- Dashboard 在 Server Component 以 `getClaims()` 與 `getUser()` 重新驗證；未登入者導向登入頁。
- 登入與註冊頁在伺服器確認使用者已登入時導向 Dashboard。
- Provider 錯誤透過 allowlist 映射為可理解訊息，未知內部錯誤不直接回傳。

### Rate limit

Auth endpoint 使用 `RateLimiter` 介面，目前由 hashed client address 搭配 in-memory fixed window 實作。這只提供本機與單一 process 的基礎防護；staging／production 必須替換為所有 instance 共用、具原子操作與監控的持久化 provider。前端狀態或 Supabase 自身 rate limit 不能取代應用層防護。

## 長期系統邊界

```text
Web / Future Mobile Clients
  → Next.js Application Boundary
      ├─ Auth and Organization
      ├─ Curriculum and Provenance
      ├─ Worksheet and Question Core
      ├─ Subject Engine Registry
      ├─ AI Job Orchestration
      ├─ Quality Review Pipeline
      ├─ Export Services
      └─ Billing and Administration
  → Supabase
      ├─ PostgreSQL + RLS
      ├─ Auth
      └─ Private Storage
  → Server-only Providers
      ├─ OpenAI
      ├─ Payment provider
      ├─ Error monitoring
      └─ Email / notifications
```

此圖是模組邊界，不代表所有模組已實作。新增外部 provider 前必須由對應 Sprint 定義安全、錯誤、重試與測試策略。

## 模組責任

| 模組                 | 責任                                   | 不負責           |
| -------------------- | -------------------------------------- | ---------------- |
| Auth / Organizations | Session、機構、分校、成員與權限        | 教材內容規則     |
| Curriculum           | 課綱、知識點、單元、進度參考與來源     | 保存出版社全文   |
| Worksheet Core       | 教材規格、題目、版本、編輯與狀態       | 自行呼叫模型     |
| Subject Engines      | 各科 blueprint、生成規則、驗證與難度   | 帳務與組織權限   |
| AI Jobs              | Provider、任務、Prompt、重試、成本紀錄 | 決定教材可匯出   |
| Quality Pipeline     | 結構、領域、安全、相似風險與教師確認   | 繞過失敗檢查     |
| Export               | 通過檢查的學生版、教師版、PDF、DOCX    | 修正教材內容     |
| Billing / Admin      | 訂閱、額度、客服、稽核與旗標           | 信任前端付款結果 |

## 關鍵資料流

### 寫入資料

1. Route Handler 或 Server Action 接收 `unknown` 輸入。
2. 伺服器端 schema 驗證、正規化並確認 session 與 organization scope。
3. Repository 只執行已授權操作；資料庫 RLS 提供第二道隔離。
4. 高風險或商務操作寫入 audit log，敏感值必須遮蔽。

### 生成與匯出

1. 教材規格先結構化保存，再建立具冪等性的 AI job。
2. AI provider 只在伺服器端執行，回應先視為不可信任資料。
3. 回應通過 schema、科目規則與品質檢查後才可成為教材草稿。
4. 教師修改產生可追溯版本；發布版本不可原地覆寫。
5. 只有品質狀態允許且教師已確認的版本可建立 export record。

## 邊界與安全

- 瀏覽器只能存取明確標記為公開的設定；Service Role 與 OpenAI 金鑰不得進入 client bundle。
- Route Handler 將 request body 視為 `unknown`，通過 Zod 後才可使用。
- 未來 AI provider 僅能由伺服器端呼叫，回應需通過 schema 後才能持久化或顯示。
- 未來所有教材匯出流程需依賴品質檢查通過狀態，不允許由前端自行繞過。
- UI 權限只改善體驗；所有授權必須在伺服器與 RLS 再次執行。
- 多租戶資料一律帶有 organization scope，不接受 client 提供的 organization id 作為唯一授權依據。
- 外部 webhook 必須驗證簽章並具備冪等性。
- Log、追蹤與錯誤訊息不得包含密碼、token、完整個資、AI Key 或 Service Role Key。

## 架構決策

- 採模組化單體作為早期商用架構，以明確介面隔離領域；有實際規模需求前不拆微服務。
- UI 預設使用 Server Components；只有瀏覽器互動或狀態需求才使用 Client Components。
- 科目能力以 `SubjectEngine` 註冊介面擴充，不在頁面內散落科目判斷。
- AI、支付、通知與文件匯出皆使用 provider interface，測試使用 mock provider。
- 長時間工作透過 job abstraction 執行，介面應能在後續替換為外部 queue。
- 資料庫 Migration 是 schema 的唯一正式來源；不以 Dashboard 手動改表取代 Migration。

## 建議目錄責任

- `app/`：路由、頁面與伺服器端入口。
- `components/ui/`：不含領域邏輯的可重用元件。
- `components/forms/`：表單狀態與互動。
- `lib/validation/`：client/server 共用的 Zod schema。
- `lib/auth/`、`lib/permissions/`：session、角色與授權邏輯。
- `lib/supabase/`：browser、server 與 middleware client。
- `lib/ai/`：AI provider、工作、Prompt 與 schema。
- `lib/exports/`：列印、PDF、DOCX provider。
- `modules/`：各科 Subject Engine 與領域驗證器。
- `database/`：Migration、seed、policy 與資料庫測試。
- `docs/`：產品、安全、資料與版本決策。
- `tests/integration/`：服務與資料邊界測試。
- `tests/e2e/`：跨頁面關鍵流程。

目錄只在對應 Sprint 需要時建立，避免預先放置空模組造成誤解。

## 部署與環境原則

- Local、test、staging、production 必須使用獨立設定與資料。
- 正式資料不得作為本機 seed；測試資料不可含真實學生或教師個資。
- production migration 必須依手冊由獲授權人員執行，本專案代理不得自行執行。
- 正式部署前須具備健康檢查、錯誤監控、備份、復原及回滾流程。
