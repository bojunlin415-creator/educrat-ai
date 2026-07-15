# 資料庫設計

文件版本：v1.0

## 目前狀態

Sprint 3、Sprint 5、兩筆 Sprint 6、Sprint 7 Curriculum Foundation 與 Sprint 8 Curriculum Editor Migration 已套用至非 production 的 `educrat-development`。Sprint 8 已完成真實 Development Editor E2E，以及套用同一組 Migration 的隔離本機 Owner／Admin／Teacher／Reviewer RLS 驗收。Production 未執行。

## profiles

用途：保存使用者可編輯的個人資料；登入憑證與 Auth 狀態仍由 `auth.users` 管理。

| 欄位                 | 型別        | 必填 | 限制／預設                     |
| -------------------- | ----------- | ---- | ------------------------------ |
| id                   | uuid        | 是   | PK，FK → `auth.users.id`       |
| display_name         | text        | 否   | 1–80 字元                      |
| avatar_url           | text        | 否   | 最長 2,048 字元                |
| phone                | text        | 否   | 6–30 字元                      |
| locale               | text        | 是   | 預設 `zh-TW`，格式 constraint  |
| timezone             | text        | 是   | 預設 `Asia/Taipei`，1–100 字元 |
| onboarding_completed | boolean     | 是   | 預設 false                     |
| created_at           | timestamptz | 是   | UTC 建立時間                   |
| updated_at           | timestamptz | 是   | trigger 自動維護               |

刪除 `auth.users` 時以 cascade 移除 profile。直接刪除 profile 未授權；未來帳號刪除必須走具稽核的伺服器流程。

### profiles 權限與 RLS

- RLS：`enable` 且 `force`。
- `anon`：無 table grant，無 policy。
- `authenticated select`：只能讀取 `auth.uid() = id` 的列。
- `authenticated insert`：只能新增 `auth.uid() = id`，且不能指定建立／更新時間。
- `authenticated update`：只能更新自己的可編輯欄位，不能更改 id 或時間欄位。
- `delete`：無 grant、無 policy。

所有 policy 明確指定 `to authenticated` 並使用 `(select auth.uid())`。Migration 先 revoke 預設權限，再依欄位授予最小權限。

## organizations

用途：代表補習班或教育機構的 tenant boundary。一般查詢只顯示目前使用者具有 active membership、organization status 為 active 且未 soft-delete 的資料。

| 欄位          | 型別        | 必填 | 限制／預設                                       |
| ------------- | ----------- | ---- | ------------------------------------------------ |
| id            | uuid        | 是   | PK，`gen_random_uuid()`                          |
| name          | text        | 是   | 去除前後空白，2–120 字元                         |
| slug          | text        | 是   | unique，小寫英數與 hyphen，3–48 字元，拒絕保留字 |
| business_name | text        | 否   | 2–160 字元                                       |
| tax_id        | text        | 否   | 2–20 字元                                        |
| phone         | text        | 否   | 6–30 字元                                        |
| email         | text        | 否   | 最長 254 字元；應用層再以 Zod 驗證 email         |
| address       | text        | 否   | 2–300 字元                                       |
| logo_path     | text        | 否   | 私有機構 Logo 路徑預留，Sprint 6 不上傳          |
| status        | text        | 是   | `active`／`suspended`／`archived`                |
| created_by    | uuid        | 是   | FK → `auth.users.id`，`ON DELETE RESTRICT`       |
| created_at    | timestamptz | 是   | UTC 建立時間                                     |
| updated_at    | timestamptz | 是   | trigger 自動維護                                 |
| deleted_at    | timestamptz | 否   | soft delete；有值時 status 必須 archived         |

Slug 在 Sprint 6 建立後不可由一般 update API 修改，避免未來 URL、公開連結與稽核識別失效。Organization 沒有 client-side insert/delete policy；建立必須走原子 RPC，soft delete 與 status 生命週期待管理 Sprint 實作。

`created_by` 採 `ON DELETE RESTRICT`，因此仍擁有 organization 的 Auth 使用者不能直接刪除帳號；後續帳號刪除流程必須先完成 owner 移轉或受控的 tenant 關閉。Logo 上傳與獨立 private bucket 延後至 Sprint 10 評估，不能共用個人 Avatar bucket。

## organization_members

用途：保存使用者在每個 organization 的 membership、角色與狀態。

| 欄位            | 型別        | 必填 | 限制／預設                                                      |
| --------------- | ----------- | ---- | --------------------------------------------------------------- |
| id              | uuid        | 是   | PK                                                              |
| organization_id | uuid        | 是   | FK → `organizations.id`，`ON DELETE RESTRICT`                   |
| user_id         | uuid        | 是   | FK → `auth.users.id`，`ON DELETE CASCADE`                       |
| role            | text        | 是   | owner／admin／teacher／reviewer；另預留 branch/student/guardian |
| status          | text        | 是   | `active`／`invited`／`suspended`／`removed`                     |
| joined_at       | timestamptz | 否   | active membership 必須有值                                      |
| created_at      | timestamptz | 是   | UTC 建立時間                                                    |
| updated_at      | timestamptz | 是   | trigger 自動維護                                                |

`organization_id + user_id` 唯一。Sprint 6 不給 client 任何 membership insert/update/delete grant，防止自行加入、提升角色或移除 owner；建立機構時只由 RPC 建立建立者的 owner membership。最後一位 active owner 由 trigger 保護，新的 organization 在 transaction commit 前必須具有 active owner。

## user_preferences

用途：保存使用者自己的應用 context。active organization 不加入 `profiles`，讓未來 active branch、session 或 device preference 能獨立延伸，不耦合個人身分資料。

| 欄位                   | 型別        | 必填 | 限制／預設                                    |
| ---------------------- | ----------- | ---- | --------------------------------------------- |
| user_id                | uuid        | 是   | PK、FK → `auth.users.id`，`ON DELETE CASCADE` |
| active_organization_id | uuid        | 否   | FK → `organizations.id`，`ON DELETE SET NULL` |
| created_at             | timestamptz | 是   | UTC 建立時間                                  |
| updated_at             | timestamptz | 是   | trigger 自動維護                              |

一般使用者只有 own select，不能直接 write。`switch_active_organization()` 驗證 membership 與 organization 狀態後才 upsert；membership 被移除／停權，或 organization 被停用／soft-delete 時，trigger 會清空失效 preference。`get_active_organization_id()` 會在 preference 無效或為空時 fallback 至最早加入的有效 organization。

## Organization RLS 與 RPC

- 三張 Sprint 6 表皆 `ENABLE` 且 `FORCE ROW LEVEL SECURITY`，anon 無 table 權限。
- `organizations`：active member 可讀；active owner/admin 只能更新明確授權的基本欄位。Teacher/reviewer 無 update 權限。
- `organization_members`：active member 可讀同一 organization 的 membership；所有直接 write 維持拒絕。
- `user_preferences`：只能讀自己的列；active organization write 只能走 RPC。
- `is_active_organization_member()` 與 `has_organization_role()` 使用 fixed empty `search_path` 的 `SECURITY DEFINER`，避免 policy 互查造成 RLS recursion。
- `create_organization_with_owner()` 只使用 `auth.uid()`，要求 Profile onboarding 已完成，驗證名稱與 slug，並原子建立 organization、owner membership、preference；只授權 authenticated execute。
- `switch_active_organization()` 不接受 user id／role，只能切換至 caller 自己的 active membership；只授權 authenticated execute。
- 所有 SECURITY DEFINER function 都 revoke public execute；應用流程不使用 Service Role。

## Curriculum Foundation

Sprint 7 新增下列正規化結構：

| 資料表                | 用途                   | 租戶邊界／主要限制                                 |
| --------------------- | ---------------------- | -------------------------------------------------- |
| `subjects`            | 科目參照               | 全域參照；active organization member 唯讀          |
| `grades`              | 國小一至六年級參照     | 全域參照；active organization member 唯讀          |
| `publishers`          | 可擴充的出版社進度參照 | 全域參照；不是 enum，不表示授權或官方背書          |
| `curriculums`         | 機構教材基本資料       | 直接帶 `organization_id`；機構內名稱不分大小寫唯一 |
| `curriculum_versions` | 不覆蓋的教材版本       | `curriculum_id + version` 唯一                     |
| `chapters`            | 版本下的有序章         | 章號與排序在同一版本內唯一                         |
| `lessons`             | 章下的有序課與學習目標 | 課號與排序在同一章內唯一；預估時間 1–600 分鐘      |

Sprint 8 以 additive migration 擴充既有結構：`chapters.status` 使用 `draft`／`active`／`archived` 受控值（Editor 將 active 顯示為「已發布」）；`lessons.teaching_notes` 為最多 5,000 字的機構內部教學備註；`lessons.difficulty` 是 nullable 的 1–5 級年級相對難度；`lessons.keywords` 預設為空陣列，最多 30 個、每個 1–80 字、去除前後空白且不分大小寫唯一。沒有新增教材核心資料表。

`difficulty` 與 `keywords` 是人類教學分類，不是 AI score、Prompt、Embedding 或生成 metadata。欄位位於 Lesson，會自然隨 `curriculum_version → chapter → lesson` 版本化，並沿既有 hierarchy RLS 取得 organization scope，因此 Sprint 12 不需搬移 Lesson 主資料。

`curriculums` 額外保存 `name`，用於人類辨識、機構內重複名稱檢查與列表搜尋；其餘核心欄位為 subject、grade、publisher、school year、semester、status、created-by 與 timestamps。名稱唯一性以 `(organization_id, lower(name))` index 實作。

### Curriculum RLS 與建立流程

- 七張表全部 `ENABLE` 且 `FORCE ROW LEVEL SECURITY`，先撤銷 anon/authenticated 預設權限。
- 共用參照表只有 select grant；沒有 browser insert/update/delete。
- 教材、版本、章、課的 select policy 都要求資料所屬 organization 等於 `get_active_organization_id()`，且 caller 是 active member。
- `curriculums` 只授權 owner/admin 更新明列的基本欄位；organization id 與 created-by 不在欄位 grant 中。Teacher/reviewer 只有 select。
- Client 沒有 curriculum insert；`create_curriculum_with_initial_version()` 從 `auth.uid()` 與 active context 取得使用者與 organization，驗證 active references 與 owner/admin role，再原子建立教材及版本 1。
- RPC 固定空 `search_path`、撤銷 public/anon execute，只授權 authenticated；不接受 `organization_id`、`created_by` 或任意 user id。
- Curriculum 本身仍沒有 DELETE API。章與課的 CRUD／排序只能經 Sprint 8 受控 RPC；direct table write 仍沒有 authenticated grant 或 write policy。
- 本 Sprint 不建立 Storage、AI、題庫或試卷資料表。

### Curriculum Editor RPC

- `create_chapter()`、`update_chapter()`、`delete_chapter()`、`reorder_chapters()`。
- `create_lesson()`、`update_lesson()`、`delete_lesson()`、`reorder_lessons()`。
- 八個 RPC 均為 fixed empty `search_path` 的 `SECURITY DEFINER`，只授權 authenticated execute；public、anon、service_role 均被明確撤銷。
- 每次變更都重新驗證 `auth.uid()`、active organization、active owner/admin membership、version 1 與實際 parent hierarchy。Caller 不能傳入 organization、role、user 或 created-by。
- 排序陣列必須包含同一父層完整且不重複的 ID，最多 500 筆；資料庫鎖定版本／章後以兩階段更新避免 unique order 衝突。
- 刪除章節會在同一 transaction 刪除其課次並壓縮章排序；刪除課次會壓縮該章課次排序。Teacher/reviewer 維持 select-only。

## avatars Storage bucket

用途：保存使用者個人圖片。Bucket 設為 private，`profiles.avatar_url` 只保存伺服器產生的物件路徑，不保存永久公開網址。

- Bucket id：`avatars`。
- 大小限制：2 MB（2,097,152 bytes）。
- MIME allowlist：`image/jpeg`、`image/png`、`image/webp`。
- `select`／`insert`／`update`／`delete`：只允許 authenticated 使用者操作第一層資料夾等於 `auth.uid()` 的物件。
- `anon`：沒有 policy，不能讀取私有圖片。
- 應用層會再驗證宣告 MIME 與實際檔頭；Storage bucket 限制是第二道防線。
- 顯示圖片使用 authenticated server client 產生一小時 signed URL，不使用 Service Role。

## 共用資料庫函式

### set_updated_at()

- `security invoker`，固定空 `search_path`。
- 由 `profiles_set_updated_at` trigger 維護 `updated_at`。
- 不授權一般角色直接執行。

### database_health()

- `stable`、`security invoker`，固定空 `search_path`。
- 只回傳 `true`，不讀取 table、session 或使用者資料。
- 僅授權 `anon` 與 `authenticated` execute，供低敏感度健康檢查使用。

## 資料領域規劃

未來資料模型依下列領域分批建立，不代表現在已有這些資料表：

- 身分與租戶：profiles、organizations、branches、organization_members、roles、permissions。
- 課程與來源：subjects、grade_levels、curriculum_standards、knowledge_points、curriculum_units、source_records。
- 內容與生成：questions、worksheets、versions、ai_jobs、prompt_versions、quality_reviews。
- 匯出與稽核：exports、audit_logs、content_provenance。
- 商務：plans、subscriptions、usage_ledger、payment_events。
- 未來教學：classes、students、assignments、attempts、responses、skill_profiles、parent_reports。

實際欄位、constraint、index、保留策略與 RLS 必須在建立該表的 Sprint 中補齊並通過審查。

## 多租戶原則

- 機構資料以 `organization_id` 隔離，跨機構讀寫預設拒絕。
- 使用者可屬於多個機構，但每次操作必須具有明確 current organization context。
- 不信任前端傳入的角色或擁有權；授權由 session、membership 與 RLS 共同判斷。
- 全域參考資料必須明確區分 public read、platform admin write 與 organization-owned records。
- Service Role 只供必要且受控的伺服器工作，不得作為一般請求繞過 RLS 的捷徑。

## 後續設計門檻

新增 Supabase 資料表前必須：

1. 在本文件記錄欄位、關聯、索引、資料保留與刪除策略。
2. 啟用 Row Level Security（RLS）。
3. 為 `select`、`insert`、`update`、`delete` 分別建立最小權限 policy；未授權操作維持拒絕。
4. 加入跨租戶隔離及未登入拒絕的測試。
5. 在本機或隔離環境驗證 Migration，不自行套用至 production。
6. Service Role Key 僅限可信任的伺服器工作負載，不得交付前端。

## Schema 共通規範

- 主鍵原則上使用 UUID；外部可見識別碼另設不可猜測或經驗證的欄位。
- 時間使用 `timestamptz` 並以 UTC 儲存，介面依使用者時區顯示。
- 可變資料包含 `created_at`、`updated_at`；必要時記錄 actor 與不可變事件。
- 關鍵狀態使用資料庫 constraint 或 enum 限制，不只依靠 TypeScript。
- JSONB 僅存結構彈性且有 schema version 的資料，不用來逃避正常化與關聯設計。
- 個資、金流及 AI 使用資料需定義最小保留期間、刪除與稽核策略。
- 所有常用外鍵、租戶篩選與唯一性需求須評估 index；Migration 需附查詢理由。

## RLS 最低要求

每張表須逐一記錄：

- 是否啟用及強制 RLS。
- `select`、`insert`、`update`、`delete` 的允許角色與條件。
- platform scope、organization scope、user scope 的判斷方式。
- 未登入、跨租戶、停權成員與角色變更後的行為。
- 測試案例及使用 Service Role 的合法例外。

前端隱藏、API 檢查或 TypeScript 型別都不能取代 RLS。

## Migration 規範

- 位置：`supabase/migrations/`，由 Supabase CLI 作為唯一 Migration 來源。
- 命名：`YYYYMMDDHHMMSS_s<兩位Sprint編號>_<動詞>_<資源>.sql`。
- 每個 Migration 必須描述目的、風險、RLS、回復策略及驗證方式。
- 不修改已套用的 Migration；修正應建立新檔案。
- 先於 local 或隔離環境驗證，再由獲授權人員依手冊套用 staging／production。
- 禁止開發代理自行執行 production migration。

## Seed 與環境

- Seed 僅使用虛構資料，不得包含真實帳號、學生個資或出版社受保護內容。
- Local、test、staging、production 使用不同專案與憑證。
- 課綱與公開進度資料匯入後預設為 draft，經來源及內容審核才能發布。

## Migration 紀錄

- Sprint 1：無。
- Sprint 2：無。
- Sprint 3：`20260713160000_s03_create_profiles.sql`，已套用至 `educrat-development`。
- Sprint 4：無新 Migration；身分驗證使用 Supabase Auth 既有 schema。
- Sprint 5：`20260714150000_s05_create_avatar_storage.sql`，建立私有 Avatar bucket 與 user-folder Storage policies，已套用至 `educrat-development`。
- Sprint 6：`20260714180000_s06_create_organizations.sql`，建立 organizations、organization_members、user_preferences、RLS helpers、原子建立／切換 RPC 與最後 owner／preference triggers；Development 套用狀態以 CLI migration history 為準。
- Sprint 6 安全修正：`20260714232000_s06_revoke_internal_function_access.sql`，明確撤銷 Trigger-only SECURITY DEFINER functions 對 public、anon、authenticated、service_role 的直接執行權；已由 function ACL 查詢與 Security Advisor 複驗。
- Sprint 7：`20260715090000_s07_create_curriculum_foundation.sql`，建立參照資料、教材版本階層、RLS、最小 grant 與原子建立 RPC；已套用至 `educrat-development`，並完成遠端 table inventory、Development 真實 RLS E2E 與隔離本機四角色 SQL RLS 驗收。
- Sprint 8：`20260715160000_s08_extend_curriculum_editor.sql`，新增章狀態、課次教學備註與八個受控 CRUD／排序 RPC；已套用至 `educrat-development`，並完成真實 Editor E2E 與隔離本機四角色 rollback RLS 驗收。
- Sprint 8 AI-ready reserve：`20260715183000_s08_add_lesson_ai_ready_fields.sql`，新增 optional difficulty、受限 keywords 與 immutable constraint helper；不含 AI 執行物件，已套用 Development，並完成 backward-compatibility RLS 驗收。

目前 Development local／remote history 均為 `20260713160000`、`20260714150000`、`20260714180000`、`20260714232000`、`20260715090000`、`20260715160000`、`20260715183000`。Production 未套用任何本專案 Migration。

## Supabase CLI 結構

- `supabase/config.toml`：本機 Supabase CLI 設定，不包含正式環境密碼或金鑰。
- `supabase/migrations/`：唯一 Migration 目錄；不得在其他路徑維護第二份副本。
- `supabase/.temp/`：CLI 連結狀態，由 `supabase/.gitignore` 排除，不得提交。
- `supabase migration list --linked`：比對本機與已連結非 production 專案的 migration history。
- `supabase db push --linked --dry-run`：只預覽待套用 migration；實際 push 前仍須確認環境並取得授權。

## Sprint 3 驗證狀態

- 靜態測試確認 RLS enable／force、自有資料 policy、最小 grant、無 delete 權限及 updated_at trigger。
- `educrat-development` catalog 確認 9 個欄位、PK、`auth.users(id)` cascade FK、三個 own policies、trigger 與 `database_health()`。
- 全回滾交易確認 own insert／select／update、跨使用者隔離、匿名拒絕與 `updated_at` trigger；測試後未留下 Auth 或 profile 資料。
- Sprint 5 不新增 `auth.users` trigger；使用者在首次 onboarding 由 authenticated Route Handler 建立自己的 profile，避免背景 trigger 隱藏應用狀態。

## Sprint 5 驗證狀態

- 靜態測試確認 bucket private、2 MB、MIME allowlist 與 select／insert／update／delete user-folder policies。
- 一般使用者實測 own upload／read／delete 成功，第二帳號跨資料夾讀寫與匿名讀取均遭拒絕。
- Storage 實測拒絕錯誤 MIME 與超過 2 MB 的物件；測試物件已清除。
- Profile API 使用既有欄位級 grant 的分離 insert／update，不放寬為整表 UPDATE，也不修改已套用的 Sprint 3 Migration。
