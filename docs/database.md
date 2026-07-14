# 資料庫設計

文件版本：v1.0

## 目前狀態

Sprint 3 與 Sprint 5 Migration 已套用至非 production 的 `educrat-development`。本機與遠端 migration history 一致，實際 catalog、資料列 RLS、Storage RLS、policy、trigger 與 function 均已驗證；production 未執行。

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
