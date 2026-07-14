# Changelog

## 2026-07-14 — Sprint 5：使用者個人資料

### 新增

- 建立首次登入 onboarding、個人資料設定頁、受保護導向與工作台顯示名稱。
- 建立 authenticated `GET／PUT /api/profile`，使用者 ID 只取自 server session，所有欄位以 Zod 驗證。
- 建立 Avatar 上傳與移除 API，檢查 2 MB 上限、MIME allowlist 與 JPEG／PNG／WebP 實際檔頭。
- 建立 private `avatars` bucket、user-folder Storage RLS 與短效 signed URL 顯示流程。
- 新增 profile、Avatar、表單、Proxy、Migration 與真實 Playwright E2E 測試。

### Migration 與安全

- 新增 `20260714150000_s05_create_avatar_storage.sql`，已套用至 `educrat-development`；production 未執行。
- 本機與遠端 migration history 均為 `20260713160000`、`20260714150000`。
- own 物件讀寫成功，跨使用者讀寫與匿名讀取遭拒絕，錯誤 MIME 與超過 2 MB 物件遭拒絕；測試物件已清除。
- Profile API 採 select 後分離 insert／update，維持 Sprint 3 欄位級 grant，不放寬整表 UPDATE。
- 未使用 Supabase Secret／Service Role Key，未輸出或提交 `.env.local`。

### 已知限制

- 既有 Sprint 4 password recovery session 綁定仍需高優先修正；本 Sprint 未擴張處理。
- Auth rate limit 仍是單程序記憶體實作，production 前須換為共享 provider。
- 語言與時區先使用受控選項，未實作完整國際化。
- Supabase CLI 套用後的 pg-delta catalog cache 需要本機 Docker；migration 本身與遠端 history 已成功。

### 驗收

- `pnpm run typecheck`、`pnpm run lint`、`pnpm run test`、`pnpm run build` 全部通過。
- Vitest：11 個測試檔、49 項測試通過。
- Playwright：共 3 項 E2E 全部通過；真實個人資料流程在同一登入 session 驗證桌面與手機 viewport，公開頁面另以桌面／手機 smoke test 驗證，沒有跳過案例。

## 2026-07-13 — 維護：統一 Supabase CLI Migration 結構

### 更新

- 建立 `supabase/config.toml` 與 CLI 專用忽略規則。
- 將 Sprint 3 Migration 原封不動移至 `supabase/migrations/`。
- 更新 Migration 安全契約測試、README、系統設計及資料庫文件的路徑。

### Migration 與環境

- 未新增、刪除或修改 Migration SQL；僅調整為 Supabase CLI 標準路徑。
- `supabase/.temp` 連結資訊維持不追蹤，避免提交環境識別資訊。
- `supabase migration list --linked` 已確認本機與 `educrat-development` 均為版本 `20260713160000`。
- 已以唯讀 catalog 與全回滾交易驗證 schema、RLS、跨使用者隔離、匿名拒絕及 trigger，未留下測試資料。
- 不自行對 production 執行 Migration。

## 2026-07-13 — Sprint 4 後整合驗收（部分完成）

### 已通過

- 首頁、登入頁與未登入 Dashboard 導向的桌面／手機 Playwright smoke 測試。
- 註冊與忘記密碼頁可開啟，受保護的 Dashboard／重設密碼頁會將未登入者導向登入。
- Auth callback 的外部 `next` 目的地會被拒絕，不會形成 open redirect。
- `profiles` 實際 schema、RLS、own 權限、跨使用者隔離、匿名拒絕、trigger 與 `database_health()`。
- Email 註冊／callback、登入、登入後 Dashboard、session refresh 與登出已在 development 流程驗證。

### 尚未通過

- Google OAuth 仍需以實際 provider 完成人工驗收。
- Password recovery session 與目前登入帳號的所有權綁定尚未封板，列為正式商用前高優先修正。
- `.env.local` 已在本機設定且維持 Git ignore；不得提交或輸出實際值。

## 2026-07-13 — Sprint 4：完整身分驗證

### 新增

- 建立 Email 註冊、登入、登出、忘記密碼與重設密碼流程。
- 建立 Google OAuth PKCE 啟動與 `/auth/callback` code exchange。
- 建立註冊、忘記密碼、重設密碼頁及完整 loading、error、success 狀態。
- 建立 server-only session helper，未登入 Dashboard 導向登入頁，已登入者離開登入／註冊頁。
- 建立 Auth JSON parser、Zod schema、安全錯誤映射及可替換 rate-limit 介面。
- 建立驗證 schema、錯誤映射與 rate limiter 測試。

### 安全

- Callback 目的地採固定白名單，避免 open redirect。
- 未知 Supabase 錯誤不回傳 provider 內部訊息；忘記密碼不揭露帳號是否存在。
- Auth API 限制 JSON Content-Type、payload 大小與請求頻率。
- Dashboard 在伺服器驗證 claims 與 user，不只依賴 Proxy 或前端狀態。

### Migration 與環境

- 無新 Migration，未修改任何 Supabase 或 production 資料。
- 因未提供非 production Supabase Auth，真實 Email、Google OAuth、cookie 與 E2E 尚未執行。
- 未執行 commit、push 或 deploy。

## 2026-07-13 — Sprint 3：Supabase 基礎架構

### 新增

- 安裝 `@supabase/ssr` 與 `@supabase/supabase-js`。
- 建立 browser、server 與 Next.js 16 Proxy 的 Supabase client。
- 建立 Supabase 公開環境變數與 server-only 私密設定驗證邊界。
- 建立 `profiles` Migration、共用 `updated_at` trigger、最小 table grants 與自有資料 RLS policy。
- 建立不讀取使用者資料的 `database_health()` RPC 與 `/api/health/database`。
- 建立初始 Database TypeScript types、環境驗證測試及 Migration 安全契約測試。

### 安全

- 一般請求只使用 publishable key；Service Role Key 未進入 client、Proxy、健康檢查或資料存取流程。
- `profiles` 未提供匿名與刪除權限，登入者只能讀取、新增及更新自己的 profile。
- 未設定 Supabase 時健康檢查回傳 `not_configured`，不回傳環境內容或內部錯誤。

### Migration 與環境

- 新增 `20260713160000_s03_create_profiles.sql`，未套用至任何環境。
- 未連接或修改 production／staging／local Supabase 資料。
- 未執行 commit、push 或 deploy。

## 2026-07-13 — Sprint 2：開發規範與文件

### 新增

- 建立 AI 引擎設計，定義 provider、Subject Engine、結構化輸出、錯誤重試與品質狀態。
- 建立版權與內容來源政策，定義來源分級、禁止內容、出版社進度參考用語及疑似侵權處理流程。
- 建立測試計畫，涵蓋靜態、單元、整合、E2E、安全、AI 品質與人工驗證。

### 更新

- 擴充產品規格，加入目標客群、使用者角色、商用核心、未來預留、非功能需求及產品流程。
- 擴充系統設計與資料庫規範，加入長期模組邊界、多租戶、RLS、Migration、seed 與環境原則。
- 擴充 `AGENTS.md`，加入 Git branch、commit、Migration 命名規範及 Definition of Done。
- 在 README 加入文件索引與目前 Sprint 狀態。

### 資料庫、API 與產品功能

- 無 Migration、無 API 或產品功能變更，未串接資料庫或 AI。
- 未執行 commit、push、deploy 或 production 操作。

## 2026-07-13 — Sprint 1：專案初始化

### 新增

- 建立 Next.js App Router、TypeScript strict、Tailwind CSS 專案基礎。
- 加入 ESLint、Prettier、Vitest、Testing Library 與 Playwright 設定。
- 加入 Zod、React Hook Form 與登入示範的 client/server 雙層驗證。
- 建立響應式首頁、登入頁與空白 Dashboard。
- 建立 loading、404、route error 與 global error 畫面。
- 建立 Button、Input、Select、Card、Dialog、Alert、Spinner 元件。
- 建立環境變數範例、協作規範與產品、系統、資料庫文件。

### 資料庫與 AI

- 無 Migration，未串接資料庫或 AI，未修改任何正式環境資料。
