# 課堂星球（AI 國小教材生成 SaaS）

為台灣國小補教業者與教師打造的 AI 原創教材生成工作台。目前完成平台基礎與開發規範，僅提供展示頁面、共用 UI、表單驗證及測試環境；尚未串接真實資料庫、登入服務或 AI。

## 技術堆疊

- Next.js App Router、React、TypeScript strict mode
- Tailwind CSS、ESLint、Prettier
- Vitest、Testing Library、Playwright
- Zod、React Hook Form
- Supabase SSR、PostgreSQL Migration 與 RLS

## 本機啟動

需求：Node.js 22 以上、pnpm 11。

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Sprint 3 起，若要測試 Supabase 連線，需在 `.env.local` 設定非 production 專案的：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

沒有設定時一般頁面仍可啟動，`/api/health/database` 會安全回傳 HTTP 503 與 `not_configured`，不會顯示環境變數內容。

開啟 <http://localhost:3000>。可使用以下路徑：

- `/`：首頁
- `/login`：示範登入頁（不會保存資料）
- `/dashboard`：空白教材工作台

## 品質檢查

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

端對端測試需先安裝 Playwright 瀏覽器：

```bash
pnpm exec playwright install chromium
pnpm run test:e2e
```

## 目錄

```text
app/                 App Router 頁面、狀態頁與伺服器 API
components/forms/    功能表單
components/ui/       共用 UI 元件
docs/                產品與工程文件
lib/validation/      共用 Zod schema
tests/e2e/           Playwright 測試
database/migrations/ 經審查後才能套用的 PostgreSQL Migration
public/              靜態資源
```

## Supabase 開發流程

Sprint 3 已建立 SSR client、Next.js 16 Proxy、`profiles` Migration 與資料庫健康檢查，但未連接或修改任何 Supabase 專案。

1. 建立獨立的 local 或 staging Supabase 專案，不得使用 production。
2. 將 `.env.example` 複製為 `.env.local`，只填入該環境的 URL 與 Publishable Key。
3. 人工審查 [Sprint 3 Migration](database/migrations/20260713160000_s03_create_profiles.sql)。
4. 由獲授權人員依 Supabase 工作流程套用至 local／staging。
5. Migration 套用後重新產生型別，檢查差異再取代 `lib/supabase/database.types.ts`：

```bash
pnpm dlx supabase@latest gen types typescript \
  --project-id YOUR_NON_PRODUCTION_PROJECT_ID \
  --schema public > lib/supabase/database.types.ts
```

不得自行對 production 執行 Migration。型別產生使用 publishable project id，不應在指令、文件或 log 放入 Service Role Key。

## Supabase Auth 設定

Sprint 4 已建立 Email／Password、Google OAuth、登出、忘記密碼、重設密碼與 PKCE callback。要在非 production 環境實測，還需由管理者完成：

1. 在 Supabase Auth 啟用 Email provider，決定是否要求 Email confirmation。
2. 將下列網址加入 Redirect URLs：
   - `http://localhost:3000/auth/callback`
   - staging 的 `/auth/callback`
3. 啟用 Google provider，並在 Google Cloud／Supabase 設定正確的 Client ID、Secret、origin 與 callback。
4. Email 驗證與密碼重設在正式營運前需設定自有 SMTP；Supabase 測試寄信服務不適合作為 production 郵件服務。
5. 確認 `.env.local` 的 `NEXT_PUBLIC_APP_URL` 與實際 origin 完全一致。

目前 rate limit 採可替換的記憶體實作，只適合本機與單一程序測試；部署前必須換成所有 instance 共用的持久化服務。

## 專案文件

- [產品規格](docs/product-spec.md)：產品定位、角色、商用範圍與分期功能
- [系統設計](docs/system-design.md)：系統邊界、模組責任與長期架構
- [資料庫設計](docs/database.md)：資料治理、RLS 與 Migration 規範
- [AI 引擎設計](docs/ai-engine.md)：生成、結構化驗證與品質管線
- [版權政策](docs/copyright-policy.md)：資料來源分級與禁止內容
- [測試計畫](docs/test-plan.md)：測試層級、必要案例與完成門檻
- [變更紀錄](docs/changelog.md)：各 Sprint 完成內容與影響
- [協作規範](AGENTS.md)：永久工程規則與 Definition of Done

## 安全與內容原則

- 私密金鑰不可使用 `NEXT_PUBLIC_` 前綴，也不可送到瀏覽器。
- 所有外部輸入必須由伺服器端 Zod 驗證。
- 未來所有 AI 輸出都必須通過結構化 schema 與教材品質檢查。
- 不得收錄出版社課文、題庫、教師手冊或其他未授權內容；出版社資訊僅可用作公開教學進度參考。
- 不得自行執行正式環境 Migration 或修改正式資料。

## 專案狀態

- Sprint 1：專案初始化，已完成。
- Sprint 2：開發規範與文件，已完成。
- Sprint 3：Supabase SSR、profiles Migration、RLS 與健康檢查，已完成程式與靜態驗證；尚待人工套用至非 production 環境。
- Sprint 4：完整身分驗證流程、受保護路由與 rate-limit 介面，已完成程式與 mock／單元驗證；尚待非 production Auth E2E。
- 下一步：Sprint 5 使用者個人資料；執行前須先完成人工 Supabase Auth 與 RLS 驗收。
