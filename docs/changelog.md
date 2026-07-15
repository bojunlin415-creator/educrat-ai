# Changelog

## 2026-07-15 — Sprint 8：Curriculum Editor（自動化驗收完成）

### 新增

- 建立 `/curriculums/[id]/editor` 雙欄教材編輯器、章課 Tree、麵包屑、工具列、章／課表單與唯讀模式。
- 建立 Chapter／Lesson GET、POST、PATCH、DELETE API 與 server-only data layer；所有輸入皆經 Zod 驗證。
- 完成章節與課次新增、修改、刪除、草稿／發布狀態、教學備註，以及拖曳和鍵盤按鈕排序。
- Dashboard 新增章節數、課次數、最近修改教材與最近課次；教材結構維持批次查詢，沒有 N+1。

### Migration 與安全

- 新增 `20260715160000_s08_extend_curriculum_editor.sql`；只 additive 增加 `chapters.status`、`lessons.teaching_notes` 與八個受控 RPC，沒有修改 Sprint 1～7 migration、DROP、TRUNCATE、新核心 table、Storage、AI、題庫或試卷。
- 新增 `20260715183000_s08_add_lesson_ai_ready_fields.sql`；以 nullable difficulty 與安全預設 keywords 預留 Sprint 12 結構化輸入，不建立 Prompt、Embedding、生成 metadata 或 review workflow。
- RPC 固定空 search path，只使用 `auth.uid()` 與 active organization context，要求 owner/admin 並驗證 version 1 及 hierarchy；public、anon、service_role execute 均撤銷。
- Teacher/reviewer 維持 read-only，direct table write 維持拒絕；完整排序陣列由 server/database 驗證並在 parent lock 下原子更新。
- 兩筆 Sprint 8 Migration 已套用至 `educrat-development`；local／remote history 均包含 `20260715160000`、`20260715183000`，Production 未套用。

### 驗收狀態

- Typecheck、Lint、Prettier、production build、Vitest 30 個測試檔／176 項與 Playwright 4 項均通過；E2E 涵蓋真實 Development 章課 CRUD／排序／刪除、未登入拒絕、手機 viewport 與 Sprint 1～7 regression。
- 隔離本機四角色 rollback RLS 驗收通過：Owner／Admin 可變更，Teacher／Reviewer 唯讀，跨租戶與匿名不可見／不可寫，direct insert 被拒絕。
- 人工桌面／手機／鍵盤與拖曳驗收尚未執行，不標記為人工驗收完成。
- 未執行 commit、push、deploy、PR、main merge 或 Sprint 9。

### 已知限制

- 版本 1 在本 Sprint 唯讀；版本 2、發布稽核、還原與跨版本複製尚未實作。
- Difficulty／keywords 已完成資料層預留，但尚未加入 Editor 表單或任何 AI 流程。
- 章刪除會一併刪除其課次，UI 已二次確認；尚未建立回收桶或 undo。
- `supabase test db --linked` 的 Docker-to-remote runner 曾在連線階段逾時；相同 migration 已在本機隔離 DB 通過四角色 SQL，遠端 RPC 由真實 E2E 驗證。

## 2026-07-15 — Sprint 7：Curriculum Foundation（自動化驗收完成）

### 新增

- 建立 `subjects`、`grades`、`publishers`、`curriculums`、`curriculum_versions`、`chapters`、`lessons`，初始科目為國語／英文／數學／自然／社會／生活，年級為一至六年級，出版社進度參考為南一／康軒／翰林。
- 建立 organization-scoped 教材名稱、科目、年級、進度參考、學年度、學期與狀態；建立教材時原子新增版本 1，舊版本不可被唯一鍵覆蓋。
- 建立 server-only Curriculum data layer、Zod validation、領域錯誤與 collection/detail Route Handlers；沒有 DELETE endpoint。
- 建立教材列表、建立、詳細、編輯頁及 CurriculumForm、Card、Table、EmptyState、Header；Dashboard 新增教材總數、最近教材與可用的建立入口。
- 新增 Curriculum validation、form、API、Migration static、Development RLS 與 Playwright E2E 規格。

### Migration 與安全

- 新增 `20260715090000_s07_create_curriculum_foundation.sql`；沒有修改 Sprint 1～6 Migration，沒有 DROP、TRUNCATE、DELETE、既有 table ALTER、Storage、AI、題庫或試卷物件。
- 七張表均 enable/force RLS。教材階層只允許目前 active organization 的 member 讀取；owner/admin 可更新明列欄位，teacher/reviewer 唯讀。
- `create_curriculum_with_initial_version()` 固定空 search path，只取 `auth.uid()` 與 active organization，不接受 caller 指定 organization／created-by；原子建立教材與初始版本。
- Linked push 已將 Sprint 7 Migration 套用至 `educrat-development`；local／remote history 均包含 `20260715090000`。遠端 table inventory 已確認七張教材表存在。

### 已知限制

- 本 Sprint 只建立教材結構與基本資料 CRUD；章／課編輯、版本發布、AI、題庫、試卷與 Storage 不在範圍。
- Teacher/reviewer 唯讀與 owner/admin 寫入已由 server/API unit、SQL contract、Development 兩帳號 RLS E2E 與隔離本機四角色 rollback transaction 驗證；未使用 Service Role 通過受測操作，也未在遠端留下不受控 membership。
- 教材 E2E fixture 不硬刪除；無 DELETE 流程前使用 deterministic 名稱重用。

### 驗收狀態

- `pnpm run typecheck`、`pnpm run lint`、`pnpm run test`、Prettier 與修改後 `pnpm run build` 已通過；Vitest 共 24 個測試檔、147 項測試通過。
- `pnpm run test:e2e` 共 4 項全部通過，涵蓋既有 regression、Curriculum UI、手機 viewport 與 Development 兩帳號真實 RLS。
- 隔離本機 RLS acceptance 驗證七張表 enable/force RLS、八個 policies、Owner／Admin 寫入、Teacher／Reviewer 唯讀、跨租戶全階層隱藏與匿名拒絕；最後完整 rollback。
- Sprint 7 自動化整合驗收完成；人工 UI／手機版驗收延後至 Milestone 2，在實際執行前不標記為人工驗收通過。
- 未執行 deploy、PR、main merge 或 Sprint 8。

## 2026-07-14 — Sprint 6：機構與補習班多租戶基礎

### 新增

- 建立 `organizations`、`organization_members`、`user_preferences`，以獨立 preference 保存 active organization，不變更既有 profiles schema。
- 建立原子 `create_organization_with_owner()`：只使用 `auth.uid()`，確認 Profile onboarding，並在同一 transaction 建立機構、owner membership 與 active preference。
- 建立受控 `switch_active_organization()`、active context fallback、最後一位 owner 保護及失效 preference 清除流程。
- 建立 Organization onboarding、settings、switcher、active organization Dashboard context 與統一 workspace route guard。
- 建立 server-only organization data layer、Zod API boundary、領域錯誤與 owner/admin server role check。
- 新增 validation、表單、switcher、route precedence、Migration 安全契約及真實 Development RLS／UI E2E 測試。

### Migration 與安全

- 新增 `20260714180000_s06_create_organizations.sql`，三張新表均啟用並強制 RLS；沒有 DROP、TRUNCATE、DELETE、profiles ALTER 或 Storage 變更。
- 新增 `20260714232000_s06_revoke_internal_function_access.sql`，修正 Supabase 預設 function ACL，四個 Trigger-only SECURITY DEFINER functions 對 public、anon、authenticated、service_role 均不可直接執行。
- 兩筆 Migration 均先 dry-run，再套用至 `educrat-development`；production 未執行。local／remote history 均為 `20260713160000`、`20260714150000`、`20260714180000`、`20260714232000`。
- 真實 RLS 測試以兩個一般 authenticated 帳號與 publishable key 驗證跨租戶隔離、匿名拒絕、直接寫入拒絕、自我升權拒絕、合法／非法切換與 duplicate rollback；未使用 Secret／Service Role Key。
- 遠端 catalog 已確認三張表 RLS／FORCE RLS、四個 policies、triggers、functions、indexes 及 `database_health() = true`。

### 已知限制

- Sprint 6 只建立第一位 owner；分校、成員邀請與細緻 RBAC 留待後續明確授權的 Sprint，不提前放寬 membership write。
- Organization Logo 只預留 `logo_path`，獨立 private bucket 與 Storage RLS 延後至 Sprint 10 評估。
- Development RLS E2E 重用固定雜湊 slug 的虛構 fixture，避免每次測試持續新增；完整安全成員清理流程待後續成員管理 Sprint 補齊。
- Security Advisor 仍列出刻意開放 authenticated 的 create／switch／context RPC，以及既存 `rls_auto_enable()` ACL 與 leaked-password protection 未啟用；後兩項需由環境管理者另行審核。
- 既有 Sprint 4 Google OAuth 與 password recovery session 綁定限制不屬本 Sprint，狀態不變。

### 驗收

- `pnpm run typecheck`、`pnpm run lint`、`pnpm run test`、`pnpm run build`、Prettier 與 `git diff --check` 已通過；Vitest 共 19 個測試檔、104 項測試通過。
- 真實 Development 多租戶 RLS 與完整 `pnpm run test:e2e` 已於 Sprint 7 技術封板重新執行，4 項全部通過，涵蓋 Organization、Profile、Avatar、Curriculum、桌面與手機 viewport regression。
- Sprint 6 資料庫已重新確認 local／remote migration history 一致，並由真實 Development RLS 與隔離本機角色測試複驗租戶邊界。
- Sprint 6 自動化整合驗收完成；人工 UI／手機版驗收延後至 Milestone 2，在實際執行前不標記為人工驗收通過。
- 未執行 deploy、PR 或 main merge。

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
