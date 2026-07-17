# EduCraft AI（Education Intelligence Platform）

為台灣國小補教業者與教師打造的教育智慧平台。目前已完成平台基礎、開發規範、Supabase development schema、身分驗證、個人資料、機構多租戶基礎、教材核心結構、章節／課次編輯器，以及 Curriculum Reference 相容層；AI 功能尚未串接。AP-002 的平台治理架構與 AP-003A 的 Account、Person、Profile、Membership、Persona 身分架構皆已核准；AP-003B 的 Role、Permission、Scope 與 Policy Decision 架構目前為提案，相關 runtime 皆未實作。

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
- `/login`：Email／Password 與 Google OAuth 登入頁
- `/onboarding`：首次登入基本資料設定
- `/onboarding/organization`：首次建立機構／補習班
- `/settings/profile`：個人資料與 Avatar 管理
- `/settings/organization`：目前機構資料與使用者角色
- `/dashboard`：受保護、具 active organization context 的教材工作台
- `/curriculums`：目前機構的教材列表
- `/curriculums/new`：owner/admin 建立教材與初始版本
- `/curriculums/[id]`：教材、版本與章節詳細資料
- `/curriculums/[id]/edit`：owner/admin 編輯教材基本資料
- `/curriculums/[id]/editor`：章節與課次樹狀編輯器；teacher/reviewer 唯讀

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
supabase/migrations/ 經審查後才能套用的 Supabase CLI Migration
public/              靜態資源
```

## Supabase 開發流程

Sprint 3 已建立 SSR client、Next.js 16 Proxy、`profiles` Migration 與資料庫健康檢查。Sprint 3、5、6、7、8 的七筆 Migration 均已套用至 `educrat-development`，local／remote history 一致；Sprint 8 已完成遠端章課 CRUD 真實 E2E、隔離本機四角色 RLS 與 Playwright 驗證。Production 未執行。

1. 建立獨立的 local 或 staging Supabase 專案，不得使用 production。
2. 將 `.env.example` 複製為 `.env.local`，只填入該環境的 URL 與 Publishable Key。
3. 人工審查 [Sprint 3 profiles Migration](supabase/migrations/20260713160000_s03_create_profiles.sql)、[Sprint 5 Avatar Storage Migration](supabase/migrations/20260714150000_s05_create_avatar_storage.sql)、[Sprint 6 Organizations Migration](supabase/migrations/20260714180000_s06_create_organizations.sql)、[Sprint 6 Function ACL Migration](supabase/migrations/20260714232000_s06_revoke_internal_function_access.sql)、[Sprint 7 Curriculum Foundation Migration](supabase/migrations/20260715090000_s07_create_curriculum_foundation.sql)、[Sprint 8 Curriculum Editor Migration](supabase/migrations/20260715160000_s08_extend_curriculum_editor.sql) 與 [Sprint 8 AI-ready Fields Migration](supabase/migrations/20260715183000_s08_add_lesson_ai_ready_fields.sql)。
4. 由獲授權人員依 Supabase 工作流程套用至 local／staging。
5. Migration 套用後重新產生型別，檢查差異再取代 `lib/supabase/database.types.ts`：

```bash
pnpm dlx supabase@latest gen types typescript \
  --project-id YOUR_NON_PRODUCTION_PROJECT_ID \
  --schema public > lib/supabase/database.types.ts
```

不得自行對 production 執行 Migration。型別產生使用 publishable project id，不應在指令、文件或 log 放入 Service Role Key。

## Supabase Auth 設定

Sprint 4 已建立 Email／Password、Google OAuth、登出、忘記密碼、重設密碼與 PKCE callback。Development 環境的 Google OAuth 外部設定與人工驗收已完成：

- 環境管理者已在 Development Supabase 啟用 Google Provider。
- Google Cloud Web OAuth Client 已設定 Supabase callback URL。
- Development Supabase Site URL 與 Redirect URLs 已驗證。
- Google OAuth 登入已由產品負責人完成一次人工成功驗收。

上述紀錄不保存 Client ID、Client Secret、Key、Token 或測試帳號。其他 staging／production 環境仍須由管理者逐環境完成：

1. 在 Supabase Auth 啟用 Email provider，決定是否要求 Email confirmation。
2. 將下列網址加入 Redirect URLs：
   - `http://localhost:3000/auth/callback`
   - staging 的 `/auth/callback`
3. 啟用 Google provider，並在 Google Cloud／Supabase 設定正確的 Client ID、Secret、origin 與 callback。
4. Email 驗證與密碼重設在正式營運前需設定自有 SMTP；Supabase 測試寄信服務不適合作為 production 郵件服務。
5. 確認 `.env.local` 的 `NEXT_PUBLIC_APP_URL` 與實際 origin 完全一致。

目前 rate limit 採可替換的記憶體實作，只適合本機與單一程序測試；部署前必須換成所有 instance 共用的持久化服務。

Sprint 5 的 Avatar 使用私有 `avatars` bucket；資料庫只保存使用者自己的物件路徑，顯示時由 authenticated server client 建立短效簽名網址。只接受 JPEG、PNG、WebP，檔案上限 2 MB，瀏覽器檢查不能取代伺服器檔頭驗證與 Storage 限制。

Sprint 6 的機構建立只允許完成個人 onboarding 的登入者呼叫受控 RPC。RPC 以 `auth.uid()` 原子建立 organization、owner membership 與 active organization preference；一般 client 不能直接新增機構、成員或竄改 active context。跨機構授權同時由 server data layer 與 RLS 驗證，不以 UI 隱藏取代權限。

Sprint 7 的教材建立只允許 active organization 的 owner/admin 呼叫受控 RPC。RPC 不接受 organization id 或 created-by，會原子建立教材與版本 1；teacher/reviewer 目前只能查看。AR-001 起，既有 `publishers` 只作 legacy compatibility，server 會轉換為中性的 Curriculum Reference DTO；UI 不接收原始來源名稱。

Sprint 8 的章節／課次變更只允許 active organization 的 owner/admin 呼叫 fixed-search-path RPC。版本 1 在本 Sprint 唯讀，不能建立版本 2；排序必須提交完整且不重複的同層 ID，並由資料庫鎖定父層後原子重排。Teacher/reviewer 只能讀取目前機構的結構，不能直接寫表或呼叫變更 RPC。

為避免 Sprint 12 AI Engine 重設 Lesson schema，Sprint 8 另預留 nullable 的 1–5 級 `difficulty` 與預設空陣列的 `keywords`。兩者是版本內的中立教學屬性，不是 Prompt、Embedding、生成紀錄或 AI Metadata；目前不提供 AI 流程，也不改變既有 Lesson CRUD 行為。

## 專案文件

- [產品規格](docs/product-spec.md)：產品定位、角色、商用範圍與分期功能
- [系統設計](docs/system-design.md)：系統邊界、模組責任與長期架構
- [資料庫設計](docs/database.md)：資料治理、RLS 與 Migration 規範
- [AI 引擎設計](docs/ai-engine.md)：生成、結構化驗證與品質管線
- [版權政策](docs/copyright-policy.md)：資料來源分級與禁止內容
- [ADR-003](docs/architecture/adr-003-reference-abstraction.md)：Knowledge Graph、Curriculum Reference 與 Migration Design
- [AP-002 Platform Governance](docs/architecture/ap-002-platform-governance.md)：已核准的平台／機構治理、生命週期、Dependency、Audit 與 Migration Design（尚未實作）
- [ADR-004](docs/architecture/adr-004-lifecycle-state-machines.md)：已核准的受控生命週期狀態機
- [ADR-005](docs/architecture/adr-005-platform-vs-organization-admin.md)：已核准的 Platform 與 Organization 管理邊界
- [ADR-006](docs/architecture/adr-006-deletion-retention-audit.md)：已核准的刪除、保留與不可變稽核架構
- [ADR-007](docs/architecture/adr-007-domain-boundaries.md)：已核准的 Identity Concept、Domain authority、RACI 與 cross-domain contract
- [AP-003A Identity Domain](docs/architecture/ap-003a-identity-domain-model.md)：已核准的 Account、Person、Profile、Membership、Persona 與 linking 邊界（尚未實作）
- [ADR-008](docs/architecture/adr-008-account-person-profile-separation.md)：已核准的 Account／Person／Profile 分離與受控連結決策
- [ADR-009](docs/architecture/adr-009-persona-membership-boundary.md)：已核准的 Persona／Membership／Role 責任邊界
- [Identity Security](docs/security/identity-security-model.md)：已核准的 Identity trust、link／merge 與未成年安全基線
- [Identity Privacy](docs/privacy/identity-and-minor-data.md)：已核准的個資、Guardian 與未成年資料基線
- [Identity Migration Design](docs/data/identity-migration-design.md)：已核准但未執行的 additive、backfill、dual-read／dual-write 設計
- [Identity UX](docs/product/identity-ux.md)：已核准但未實作的 Account、Persona switch、Student claim 與 elevated identity wireframe
- [AP-003B Authorization Framework](docs/architecture/ap-003b-authorization-framework.md)：提案中的 Role、Permission、Scope、Policy Decision 與授權邊界（尚未實作）
- [Permission Catalog](docs/security/permission-catalog.md)：提案中的 224 個 `resource.action` 權限鍵與版本規則
- [Authorization Security](docs/security/authorization-security-model.md)：提案中的 trust boundary、delegation、re-auth、CASE、Service Principal 與 AI 授權限制
- [Authorization Migration Design](docs/data/authorization-migration-design.md)：提案中的 versioned hybrid、legacy role backfill 與 additive rollout
- [Capability Map](docs/product/capability-map.md)：Approved Product Capability Baseline
- [Event Catalog](docs/architecture/event-catalog.md)：Approved Contract Baseline — Not Implemented
- [Lifecycle UX Guidelines](docs/product/lifecycle-ux-guidelines.md)：已核准的 Danger Zone、關閉精靈與回收桶 wireframe
- [Platform Admin Governance](docs/security/platform-admin-governance.md)：已核准的跨租戶支援、PII 與高風險操作安全契約
- [Retention and Deletion Policy](docs/data/retention-and-deletion-policy.md)：已核准的版本化保留與刪除政策
- [Entity Lifecycle Matrix](docs/data/entity-lifecycle-matrix.md)：已核准的 33 類 Entity 完整生命週期與角色責任
- [Architecture Backlog](docs/architecture/backlog.md)：架構議題與 Package 狀態
- [AI Reference Policy](docs/ai/ai-reference-policy.md)：AI context allowlist 與 legacy identity 禁令
- [Reference Legal Policy](docs/legal/reference-policy.md)：Reference、Knowledge Mapping 與內容法律邊界
- [測試計畫](docs/test-plan.md)：測試層級、必要案例與完成門檻
- [變更紀錄](docs/changelog.md)：各 Sprint 完成內容與影響
- [協作規範](AGENTS.md)：永久工程規則與 Definition of Done

## 安全與內容原則

- 私密金鑰不可使用 `NEXT_PUBLIC_` 前綴，也不可送到瀏覽器。
- 所有外部輸入必須由伺服器端 Zod 驗證。
- 未來所有 AI 輸出都必須通過結構化 schema 與教材品質檢查。
- 不得收錄出版社課文、題庫、教師手冊或其他未授權內容；使用者介面與新 Domain 只使用中性的 Curriculum Reference。
- AI 只能依賴 Knowledge Graph、Knowledge Point 與經驗證的 Curriculum Reference，不得讀取 legacy Publisher identity。
- 不得自行執行正式環境 Migration 或修改正式資料。

## 專案狀態

- Sprint 1：專案初始化，已完成。
- Sprint 2：開發規範與文件，已完成。
- Sprint 3：Supabase SSR、profiles Migration、RLS 與健康檢查，已在 `educrat-development` 完成 schema 與 RLS 驗收。
- Sprint 4：身分驗證流程、受保護路由與 rate-limit 介面已完成；Email 登入、session、callback、登出與 Google OAuth 已在 development 驗證，密碼復原 session 綁定仍列為高優先修正。
- Sprint 5：個人資料、首次 onboarding、私有 Avatar Storage、RLS 與真實 E2E 已完成。
- Sprint 6：機構、owner membership、active organization、organization onboarding／settings／switcher、多租戶 RLS 與自動化整合驗收已完成；人工 UI／手機版驗收延後至 Milestone 2，不標記為已完成。
- Sprint 7：教材參照資料、教材／版本／章／課結構、API、頁面與 Dashboard 已完成；Development Migration、真實租戶隔離、Owner／Admin／Teacher／Reviewer RLS、Playwright、production build 與自動化整合驗收均已通過。人工 UI／手機版驗收延後至 Milestone 2，不標記為已完成。
- Sprint 8：Curriculum Editor、章節／課次 CRUD、受控排序、Dashboard 統計、API、四角色 RLS 與真實 Playwright E2E 已完成自動化驗收；人工 UI／鍵盤／手機版驗收仍待產品負責人確認。
- AR-001：ADR-003、AI／Legal Reference Policy 與非破壞性 Display Adapter 已獲有條件核准並完成命名修正；資料庫 Migration 僅完成設計，尚未建立或套用。
- AP-002：Platform Governance Foundation 與 Amendment 已取得 Final Architecture Approval；Identity Concept、ADR-004～007、Capability Map 與 Event Catalog 已成為核准基線。未建立 Migration、API、UI、Identity Framework、RBAC、Event Bus、Queue、Notification、Audit table、生命週期寫入、Platform Admin Console 或刪除功能。
- AP-003A：Identity Domain Model 已取得 **Accepted — Architecture Approved**。尚未建立 Person／Persona／Account Link table、Migration、RLS、RPC、API、UI、Invite、Student／Guardian runtime、Platform role 或完整 RBAC；Account hard delete依正式安全政策維持關閉。
- AP-003B：Role Model、224 個 Permission Catalog、Scope Model、Policy Decision 與授權安全／Migration Design 已完成文件提案，狀態為 **Proposed — Awaiting Architecture Approval**；沒有建立 runtime、Migration、RLS、API、UI、JWT 或 Session 變更。
- AP-002B → AP-002A → AP-002C → AP-004 → AP-002D → AP-002E → AP-002F → AP-002G 均尚未開始。Sprint 9 尚未開始，本階段不串接 AI、題庫或試卷。
