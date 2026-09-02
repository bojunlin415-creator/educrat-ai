# 資料庫設計

文件版本：v1.0

## 目前狀態

Sprint 3、Sprint 5、兩筆 Sprint 6、Sprint 7 Curriculum Foundation、Sprint 8 Curriculum Editor 與 Sprint 8 Classes & Students Migration 已套用至非 production 的 `educrat-development`。Classes & Students 已完成真實 Development catalog、rollback-only Owner／Admin／Teacher RLS、API／UI E2E 與 audit 驗收。Production 未執行。

AR-001 不新增或套用 Migration。既有 `publishers` 與 `curriculums.publisher_id` 保持原樣，只作 legacy compatibility；目標 `curriculum_references`、`knowledge_sources`、`curriculum_reference_mappings`、新 FK、backfill 與 dual-write 設計已由 ADR-003 核准，但資料庫實作仍須後續獨立 Migration 工作授權。

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

> AR-001 說明：上表的 `publishers` 已被定義為 legacy table，不再是新 Domain。新程式不可直接將其 name/code 傳到 UI 或 AI；移轉採新增 table／FK 與 dual-write，不 Rename 或 Drop。

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

> AP-002 治理風險：上述 delete RPC 是 Sprint 8 的 legacy 行為，目前沒有 Teaching／Learning／Assessment 下游資料。未來一旦存在 protected history，就不得繼續使用直接硬刪除。後續需先以 additive lifecycle v2、dependency scan、archive/trash/restore 與 Audit 取代 caller，再由新的 forward-only Migration 撤銷 authenticated execute；不得修改 Sprint 8 Migration 或 Drop 函式。

## Platform Governance Migration Design（AP-002 Accepted Architecture）

AP-002 不建立 Migration，只提出未來契約。推薦 Hybrid approach：Organization、Account、Membership 與 Curriculum family 的 canonical state 由 typed companion/domain state 保存；共用 workflow 由 `lifecycle_requests`、`deletion_requests`、`retention_policies`、`retention_holds`、`recycle_bin_entries` 與 append-only `audit_events` 承擔。平台角色預留 `platform_roles` 與 `platform_role_assignments`，但不與 `organization_members` 合併。

未來 additive proposal：

- `organization_lifecycle`：1:1 Organization canonical state、state version 與 state timestamps；legacy `organizations.status/deleted_at` 保留。
- `account_governance`：Account state、privacy/deletion workflow reference；不保存 password/token。
- `membership_lifecycle`：補足 ARCHIVED 與 workflow metadata；legacy Membership status 保留。
- `lifecycle_requests`／`deletion_requests`：transition、reason、impact、policy、approval、grace、execution 與 tombstone reference。
- `retention_policies`／`retention_holds`：版本化規則、jurisdiction、scope 與 override。
- `recycle_bin_entries`：restore workflow metadata，不是所有 Domain 的 canonical source。
- `audit_events`：append-only、allowlisted metadata、partition/external archive ready。

所有新 public table 必須 ENABLE/FORCE RLS、預設撤銷 direct write、FK 優先 `ON DELETE RESTRICT`。Platform authorization 使用獨立 helper 與 case-scoped capability，不得以 active organization helper 或 Service Role 當一般管理 session。永久刪除函式不 grant 給 browser roles，只供核准後的受控 job。

Backfill 只從已知 legacy 狀態建立 canonical state；unknown value 停止。先 dual-read、再 dual-write compatible states；新狀態只寫 canonical layer。Rollback 關 flag、停 job、保留新增資料並以 correction Migration 修正，不 Drop、Truncate、改 ID 或重寫歷史。

此設計為 **Accepted — Architecture Approved**，但尚未實作；目前資料庫 schema 與 Migration history 均未因 AP-002 變動。

AP-002 Amendment 不改變上述 Migration Design。Account／Person linking、Persona reference 與 identity lifecycle 已由 AP-003A 核准為架構基線；`platform_roles`／`platform_role_assignments`、re-auth 與 policy decision schema 再由 AP-003B 核准，不得由 AP-002 先行建表。Event Catalog 也只定義 future contract，不建立 Outbox、Queue 或 Consumer table。

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
- 未來治理（AP-002 Accepted Architecture，尚未實作）：platform role assignments、typed lifecycle state、lifecycle/deletion requests、retention policies/holds、recycle bin workflow、append-only audit events。

實際欄位、constraint、index、保留策略與 RLS 必須在建立該表的 Sprint 中補齊並通過審查。

## Sprint 8 Classes & Students Foundation

- `classes` 沿用 CL-001 aggregate，forward-only 補入 nullable `school`，不重建或刪除既有班級資料。
- `students` 是 organization-scoped canonical student record，以 `(organization_id, student_no)` 保證同租戶學號唯一。
- `student_class_members` 以 composite foreign key 同時驗證 class、student 與 organization，避免 client 以跨租戶 ID 建立關係。
- 三張新表皆啟用並強制 RLS。Owner/Admin 可管理全部；Teacher 可管理學生資料，但班級 membership mutation 只限自己負責的 active class。
- `class_student_audit_events` 只保存 actor、organization、target、action、timestamp 與非敏感 metadata，不保存 token、credential 或完整學生內容。
- `20260811153000_s08_harden_classes_students_foundation.sql` 是 applied foundation 的 forward-only 修正：membership mutation 同時要求 active class 與 active role；authenticated 只能寫入明列的 mutable columns，不能搬動 tenant／identity／system timestamp；canonical audit 由 transaction-coupled trigger 產生，authenticated 不可直接偽造 audit event。
- `class_enrollments` 暫時保留作既有 Assignment、Analytics 與 Dashboard 相容邊界；本 Sprint 不做破壞性 rename 或 data rewrite。

## Product Architecture Rebaseline（Proposed — Not Implemented）

2026-08-10 的 English／Math／Generation-Only 架構重新基準只提出正規化 ownership 與關聯，不建立或套用 Migration，也不表示下列 logical entity 已存在。

### Ownership classes

| Ownership                           | Logical records                                                                                                                                                                                     | Database boundary                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Global reusable reference           | Subject、capability vocabulary/profile version、proficiency framework/level、curriculum framework/version、academic concept、skill、knowledge point、objective、prerequisite、question type、rubric | Platform-governed versioned reference；tenant 無 direct write；不得保存未授權教材全文。                     |
| Restricted provenance/compatibility | Knowledge source、license、legacy Publisher mapping、reference ingestion/review                                                                                                                     | Admin/legal-only；不可進一般 API、UI 或 AI context。                                                        |
| Organization-scoped                 | Course/edition、class、organization material/version、assignment、report/cache、audit access projection                                                                                             | 必帶 `organization_id`；ENABLE/FORCE RLS；server resolve tenant；FK/unique/index 含 tenant。                |
| Enrollment-scoped                   | Course/class enrollment、module progress、attendance、course assignment、completion、certificate eligibility                                                                                        | 同時驗證 organization、learner 與 course/class；不能只信任 enrollment ID。                                  |
| Student-scoped evidence             | Attempt、response、grading result、error classification、skill evidence、mastery history、recommendation/remediation history、passport projection                                                   | Append-only 或 versioned；Student self、assigned educator、active verified guardian 才可讀適當 projection。 |
| Provider execution                  | Generation request/job、provider result envelope、usage、export job                                                                                                                                 | Server-only、versioned prompt/schema/model、最小內容、明確 retention；不保存 secret/token。                 |

### Normalization rules

1. School grade、CEFR、exam level、course level 與 mastery level 是不同 dimension，不共用一個 `level`／`grade` 欄位。
2. English concept 只建立一次，再透過 mapping 關聯 pathway、CEFR、exam、course、skill 與 objective。
3. Curriculum Reference 只 mapping canonical Knowledge Point；不得將外部教材章課直接複製成平台 Lesson。
4. Course、Class 與 Enrollment 分離。成人英語 Course 可以沒有 grade、semester 或 Class。
5. Generated Material／Question、Teacher Revision、Assignment、Assessment Attempt、Response、Grading Result、Skill Evidence 與 Mastery Projection 分離。
6. Learning Passport 是具 lineage 的 authorized projection，不是第二套 authority table，也不啟用跨 organization 分享。
7. 所有 reference、mapping、prompt、schema、rubric 與 capability profile 都必須可版本化或 supersede，不原地改寫歷史語意。

### Sprint 8 learner/enrollment compatibility gate

目前 `students.id` 與 `student_class_members.student_id` 使用 organization-scoped roster ID；既有 `class_enrollments.student_id`、`assignment_students.student_id`、`assignment_submissions.student_id`、`learning_events.student_id` 與多個 projection 則使用 `profiles.id`。兩者不可直接視為同一 ID。

後續只允許 forward-only convergence：

1. 定義 canonical Student↔Person↔Account link；Managed Student 可無 Account。
2. 產生 read-only parity/inventory，列出可唯一連結、缺 link、歧義與跨租戶衝突。
3. 未知或歧義 link fail closed，不以姓名、Email 或學號跨 organization 猜測。
4. 先 adapter／shadow read，再經核准的 additive backfill 與 consumer-by-consumer cutover。
5. 最後才停止 legacy write；不 Drop、Rename、重寫歷史 Migration 或刪除舊 enrollment/history。

S8V-001 已正面確認 linked target 為 `educrat-development`／`gqurnljrvwyhruhutvni`，且 local／remote history 同時包含 `20260806100000` 與 forward-only correction `20260811153000`。Development catalog assertions、單一 transaction 最後 ROLLBACK 的角色／跨租戶測試、真實 authenticated API／UI E2E 與 audit event 查核均已通過；受控 E2E rows 最後維持 archived，臨時 Teacher membership 已精確移除。Production 未查詢、未套用、未部署。

靜態 review 另確認該 Migration 的 Student management policy 目前以 active staff／organization scope 為主，尚未把 Teacher 收斂至自己負責的 Class／Course。由於 Student row 含生日、性別、學校與學號等未成年資料，後續必須用新的 forward-only policy migration 加上 assigned-scope relationship 與跨班級測試；不得回頭改寫 Sprint 8 Migration，也不得在完成前宣稱 Teacher least-privilege 已滿足。

### LE-001 Phase 1–2 additive link schema

- `student_account_links` 只描述「此 Account 在此 Organization 是否可作為此 canonical Student identity」，不取代 Student lifecycle、Organization Membership 或 class enrollment。
- composite FK `(student_id, organization_id)` 保證 tenant consistency；partial unique indexes限制每個 organization 內 Student 與 Account 各自只有一個 active link，但允許同 Account 在不同 organization 有獨立 verified context。
- `account_id`、`created_by` 與 audit actor 暫時直接參照 `auth.users.id ON DELETE RESTRICT`。這不授予 authenticated 讀取 `auth.users`，並阻止 Account deletion cascade 破壞 link／Student history；未來 Person/tombstone package 必須先建立正式 reassignment 才能解除 hard-delete blocker。
- `student_account_link_audit_events` 保存 controlled action、ID、correlation 與 minimal metadata；無 token、email、birthday 或 Student content。
- direct authenticated mutation 全部撤銷；create/revoke 只可透過 fixed-search-path trusted RPC，並從 `auth.uid()` 與 active organization 解出權威 context。
- `get_learner_convergence_snapshot()` 為 Owner/Admin-only read-only parity boundary；不執行 backfill。`resolve_canonical_student_for_authenticated_account()` 無 client identity parameters。
- migration `20260818120000_le001_create_student_account_links.sql` 是 additive 且不更動歷史 migration；已只套用 `educrat-development`／`gqurnljrvwyhruhutvni`。套用後 history 同步、dry-run up to date，且 linked Development 驗證確認兩張 table、七個 indexes、ENABLE/FORCE RLS、最小 grants、tenant constraints 與 trusted RPC lifecycle；Production 未套用。

現有 `profiles` 只有 own-row read policy；需要顯示其他成員／學生名稱的管理流程不可藉此放寬為全表 read。後續應建立 tenant-validated minimal projection 或 fixed-search-path RPC，只暴露業務所需欄位，並保留 `auth.users` 不可由 authenticated 直接查詢的邊界。

### LE-001 Phase 3 controlled backfill boundary

- Phase 3 沒有新增 Migration、table、column、policy、grant 或 RPC，也沒有修改 `20260818120000_le001_create_student_account_links.sql`。
- Backfill planner 只接受 repository-owned verified relationship ID；Email、姓名、生日、學校、年級與學號不在 authority input。
- Development live review 顯示 8 位 canonical Student、0 eligible Profile Student、0 existing link、0 legacy enrollment、2 canonical enrollment、0 cross-tenant mismatch。Roster audit 的 Owner actor 只代表操作人，不能當作 Student identity。
- 因此 Account-link deterministic set 與 legacy-to-canonical enrollment backfill set皆為 0；`student_account_links`、audit、`student_class_members` 與 `class_enrollments` 沒有 Phase 3 historical mutation。
- Future concrete migration backfill adapter 必須使用受控 operator authority、`migration_verified` provenance 與 audit correlation receipt；不得讓一般 browser caller 自稱 migration provenance。Consumer authority、dual-read/write 與 legacy freeze 保持未開始。

### LE-001 Phase 4 shadow read boundary

- Phase 4 沒有新增或修改 Migration、table、column、index、constraint、policy、grant、trigger 或 RPC；既有 `20260818120000_le001_create_student_account_links.sql` 保持不變。
- Shadow server adapter只呼叫既有 Owner/Admin-only `get_learner_convergence_snapshot()`，並在記憶體依 consumer scope比較 legacy/canonical references；不寫入任何 learner、enrollment、assignment、analytics、guardian或audit table。
- Runtime authority仍是 Profile-backed learner與`class_enrollments`。`students`／`student_class_members`只作shadow comparison，不參與目前response、authorization或write。
- Development read-only verification確認8位 canonical Student、0 active verified link、0 legacy enrollment、2 canonical enrollment、0 tenant mismatch；沒有執行backfill或historical mutation。
- Teacher／Student／Guardian consumer若未來需要長期開啟shadow，必須先建立另外核准的least-privilege scoped snapshot adapter；不得授予`auth.users` read、放寬Account-link RLS或使用Service Role。

### LE-001 Phase 5 cutover readiness boundary

- Phase 5 是 code/document planning package，沒有新增或修改 Migration、table、column、index、constraint、policy、grant、trigger或RPC；`20260818120000_le001_create_student_account_links.sql`保持不變。
- `students.id`與`student_class_members.id`仍只是future canonical authority；Profile learner與`class_enrollments`仍是runtime compatibility authority。沒有dual-write、consumer cutover、legacy write freeze或historical rewrite。
- Future schema prerequisites只能由5A～5J各自提出forward-only migration，例如Assignment dual-reference、Learning Event canonical reference／mapping provenance、Guardian canonical child reference；Phase 5不建立speculative schema。
- Class roster與Assignment targeting可支援managed/accountless Student；Submission self resolver仍要求active organization內唯一有效verified Account link。Guardian relationship不以Account link取代或自動建立。
- Future least-privilege adapter只可提供tenant、Student／Enrollment／Link／Relationship technical ID與status；不開放Profile PII、`auth.users`、token、credential或broader Teacher organization roster。

### LE-001 Phase 5A Class roster read boundary

- **No Migration**：Phase 5A 沒有新增或修改 table、column、index、constraint、RLS、grant、function、trigger 或歷史 migration。
- Class detail canonical roster 先以 active organization 與 Class tenant 限定 `student_class_members`，只讀 `status = active`，再以單一 batched `students.id IN (...)` 取得 minimal projection；無 per-Student query、Profile query、Account-link query 或 `auth.users` read。
- Existing canonical Student RLS 尚有 organization-wide active staff scope；Phase 5A 不將其宣稱為 Teacher product authority。Class detail server adapter 會在讀 roster 前額外驗證 assigned active Class，一般 Student table RLS 收旂仍留待獨立 forward-only hardening package。
- Linked Development read-only evidence 為 canonical enrollment 2、legacy 0、expected managed canonical-only 2，unexpected/tenant/identity/status/shadow error 全部 0；目前 active canonical roster 0。未 backfill、未寫入 fixture、Production 未操作。

### LE-001 Phase 5B Teacher Dashboard learner population boundary

- **No Migration**：Phase 5B 沒有新增或修改 table、column、index、constraint、RLS、grant、function、trigger或歷史migration。
- Teacher Dashboard先取得active scoped Class IDs，再以一個`student_class_members`查詢取得active membership，並以一個`students.id IN (...)`查詢取得active canonical Student minimal projection；不做per-Class、per-Student、Profile、Account-link或`auth.users`查詢。
- Canonical Student／membership只作目前learner population與per-Class count。`class_enrollments`與Profile learner ID仍是Reporting、Assignment、Submission與Analytics metric compatibility boundary；legacy ID不得送至browser。
- Managed/accountless Student可進入population而不建立Profile或Account link。left membership不列入current population；cross-tenant、RLS、authorization與canonical integrity錯誤不允許fallback。
- Phase 5B沿用現有RLS與Phase 5A assigned-Class server gate，不放寬Teacher organization-wide Student access。若未來需收斂general Student policy，必須另建forward-only hardening package。

### LE-001 Phase 5C Reporting learner population boundary

- **No Migration**：Phase 5C沒有新增或修改table、column、index、constraint、RLS、grant、function、trigger或歷史migration。
- RP-001 Teacher Reporting先驗證active organization/membership與精確Class scope，再重用Phase 5A batched `student_class_members`＋`students` current roster；不做per-Student Profile、Account-link或`auth.users` read。
- `students.id`是新Reporting population的canonical learner key。既有`student_subject_summary`、`learning_events`、assignment/submission、mastery、adaptive與歷史Profile-keyed資料不重寫；只有authoritative verified mapping存在時才能作compatibility metric read。
- Current population只含active membership/Student；left row只保留為歷史證據。Archived Class的current population為空，Owner/Admin既有historical report access不因此擴大Teacher scope。
- Development唯讀證據為current canonical/legacy population 0/0、tenant/shadow/unexpected mismatch 0；歷史snapshot的2筆left canonical enrollment不列入current population。沒有persistent fixture、backfill、資料write或Production操作。

### LE-001 Phase 5D Assignment class expansion boundary

- **No Migration**：Phase 5D沒有新增或修改table、column、index、constraint、RLS、grant、function、trigger或歷史migration。
- Class-target Assignment先以active organization與現有Owner/Admin/assigned-Teacher規則批次驗證Classes，再重用Phase 5A `student_class_members`＋`students` roster source。只含active membership/Student；left/inactive/archived/cross-tenant target fail closed。
- `assignment_students.student_id`仍維持legacy Profile/Account recipient語意，Submission ownership亦未改。Phase 5D不寫canonical Student ID至該欄位、不改recipient schema、不dual-write、不重寫歷史資料。
- 目前sealed schema沒有Teacher-safe candidate-scoped Account-link mapping。非空canonical expansion無法安全materialize時，在任何Assignment/target/recipient寫入前回傳typed `recipient_identity_unavailable`。Phase 5E才可另行審查recipient authority。
- Development唯讀current candidate evidence為canonical/legacy 0/0；兩筆歷史canonical membership均為left並排除。沒有persistent fixture、backfill、資料write或Production操作。

### LE-001 Phase 5E Assignment recipient canonicalization boundary

- Migration `20260831120000_le001_canonicalize_assignment_recipients.sql`只套用Development，新增`assignment_student_recipients`、`assignment_recipient_classes`與server-only`assignment_recipient_legacy_compatibility`；沒有backfill、DROP、歷史migration修改或Production操作。
- Canonical recipient以`students.id`為唯一learner key；Assignment／Student／Class／membership皆以organization composite FK強制同tenant，`(assignment_id, student_id)` unique確保idempotency，所有關係均`ON DELETE RESTRICT`。
- 三表均ENABLE/FORCE RLS。authenticated沒有直接INSERT/UPDATE/DELETE；compatibility table沒有直接SELECT。internal persistence helper也撤銷public/anon/authenticated/service_role execute。
- `create_assignment_with_canonical_recipients`在一個transaction建立Assignment、Class target、canonical recipient、provenance、可選verified legacy mirror與audit；`add_assignment_canonical_recipients`共用相同validation。Caller不能提供actor或organization authority。
- Compatibility只接受同tenant、active且verified/in-window的`student_account_links`、存在Profile與active Student membership。無link的managed Student仍可canonical寫入，不建立Profile、Auth user或Account link。
- `get_assignment_recipient_projection`只輸出canonical-safe recipient；無mapping的歷史Profile recipient標記`LEGACY_ONLY_HISTORICAL`，不回傳raw Profile/Account/link ID。`assignment_students`與`assignment_submissions`schema/RLS/identity語意未修改。
- Development migration history為30 local / 30 remote、dry-run up to date；三張新表、RPC與ACL live verification通過，目前canonical/legacy recipient均為0且無unexpected backfill。

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
- AN-001：`20260730130000_an001_create_learning_analytics_foundation.sql`，新增 `learning_events`、`student_knowledge_mastery`、`student_subject_summary`、`teacher_class_summary` 與 `learning_audit_events`。`learning_events` 為 append-only，summary tables 是可重建 projection；全部新表啟用 RLS 與 FORCE RLS。Production 未套用。
- AI-002：`20260730160000_ai002_create_adaptive_learning_foundation.sql`，新增 `learning_recommendations`、`learning_paths` 與 `learning_recommendation_audit_events`。Recommendation 必須基於既有 learning analytics；全部新表啟用 RLS 與 FORCE RLS。Production 未套用。
- RP-001：`20260730190000_rp001_create_reporting_foundation.sql`，新增 `report_audit_events` 與 optional `report_cache`。Reporting 不新增新的 analytics source table、不修改 `learning_events`／summary tables；全部新表啟用 RLS 與 FORCE RLS。Production 未套用。
- TD-001：`20260730210000_td001_create_teacher_dashboard_audit.sql`，新增 `teacher_dashboard_audit_events`。Teacher Dashboard 不新增 Learning tables、不修改 Analytics schema；新表啟用 RLS 與 FORCE RLS。Production 未套用。
- PP-001：`20260803110000_pp001_create_parent_portal_foundation.sql`，新增最小 `student_guardians` verified relationship boundary 與 `parent_portal_audit_events`。`student_guardians` 只授予 authenticated select，無 client insert/update grant；guardian 只能讀取自己 active relationship，owner/admin 可讀取管理摘要。Parent Portal 不新增 Learning source table、不修改 `assignment_submissions`、不建立 Parent Dashboard cache；全部新表啟用 RLS 與 FORCE RLS。Production 未套用。
- GV-001：`20260803113000_gv001_create_guardian_verification_consent.sql`，擴充 `student_guardians` lifecycle／verification／consent／revocation 欄位，新增 `guardian_invitations` hash-only token table、`accept_guardian_invitation()` RPC 與 `revoke_guardian_relationship()` RPC。Invitation 由 owner/admin 建立，guardian accept 需 verified email match、single-use token、consent version 與 server-side RPC；relationship revocation 也只能由 owner/admin 透過 RPC 執行並寫入 audit。不保存 raw token、不建立 email provider、不放寬 `student_guardians` client write。Production 未套用。
- TD-001 RLS 修正：`20260803153000_td001_fix_classroom_rls_recursion.sql`，替換 `classes`、`class_enrollments` 與 `assignment_classes` 會互相觸發的 RLS relationship checks，改由 `is_class_primary_teacher()` 與 `is_class_enrolled_student()` 受控 helper 判斷 teacher/student class scope。Production 未套用。
- TD-001 Assignment RLS 修正：`20260817134500_td001_fix_assignment_rls_recursion.sql`，替換 `assignments`、`assignment_students` 與 `assignment_submissions` policy 內會循環觸發的跨表查詢，改由 tenant-scoped、fixed-search-path `SECURITY DEFINER` helper 判斷 assignment manager、recipient、organization 與 submission eligibility。Migration 僅套用至 Development；FORCE RLS、role scope、active organization 與 cross-tenant boundary 維持不變，Production 未套用。
- UX-001：`20260803140000_ux001_create_access_control_management.sql`，新增 `access_control_audit_events`、`write_access_control_audit()`、`assign_organization_member_role()`、`remove_organization_member_role()` 與 `set_organization_member_access_status()`。Role/status mutation 只允許 owner/admin server-side RPC，包含理由、tenant scope、self-elevation/self-mutation protection、owner protection 與 admin escalation limits。`ROLE_CONTEXT_SWITCHED` audit 可由 active member 記錄，但不得寫其他 access mutation audit。Production 未套用。

目前 Development migration history 需依已 Git Sealed package 逐次確認；Production 不得由開發代理自動套用任何本專案 Migration。

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

## AP-003A Identity Migration Design（Approved Architecture Baseline — Not Executed）

AP-003A 不變更 schema 或 Migration history。推薦保留 `profiles.id = auth.users.id` 作 Account-linked compatibility，未來以 additive `persons` + `account_person_links` 建立 canonical Person；正常情況維持一對一，受控 linking／merge 才允許一 Person 連多 Account。Managed Student／Guardian 可先有 Person／Persona 而沒有 Account，Email 不作 Person ID。

候選 entity 包含 `persons`、`account_person_links`、`personas`、`guardian_relationships`、`identity_merge_records`；`auth_identity_metadata`、`person_profiles` 與 `service_principals` 只有在具體 authority／query 需求核准後才建立。AP-003A 不提前建立完整 Role／Permission table，該部分由 AP-003B 決定。

遷移只允許 additive phases：Person/link backfill → shadow dual-read → managed Persona → feature-gated dual-write → AP-003B policy/RLS cutover → forward hardening。Legacy `profiles`、Membership、單一 role、last-owner protection、active organization preference、Auth/Profile IDs 與 Sprint 7/8 行為保留，不 rename/drop。任何 identity link 歧義、cycle、跨租戶 projection 或 parity 差異阻擋 rollout。

## AP-003B Authorization Migration Design（Proposed — Not Executed）

AP-003B 沒有建立 Migration 或變更 schema。提案採 versioned hybrid：Permission keys 由受 code review 的版本化 catalog 定義並以 digest/version materialize；role definitions、role-permission versions、assignments、delegations、platform assignments、CASE grants、re-auth receipts、policy/approval metadata 才是未來 DB runtime state。

現有 `organization_members.role` 繼續是 authority；`organization_owner`、`organization_admin`、`teacher`、`reviewer` 未來採 deterministic backfill，先 shadow evaluate，再在 Audit、RLS、last-owner與 parity gate 通過後進入 atomic dual-write。active organization 仍只是 workspace preference，不能用作權限證據。未知 legacy role、Campus／Student／Guardian reserved role 或對應不明時 fail closed。

所有候選 table 必須 additive、`ENABLE/FORCE RLS`、最小 grant、受控 fixed-search-path RPC、不可由 client 指定 actor/role/tenant authority；不 rename/drop 舊欄位，不修改歷史 Migration。完整候選 entity、index、constraint、forward correction 與 rollout gate 見 `docs/data/authorization-migration-design.md`。

新 public table 必須 ENABLE/FORCE RLS、最小 grants；link／merge mutation 預設走 fixed-search-path 受控 flow，以 `auth.uid()` resolve Account，不接受 caller 自稱 Account／Person／Organization authority。現有 `profiles` 與 Membership 的 Account cascade FK 使 hard delete 保持關閉，直到 forward-only identity/dependency hardening完成。完整方案見 `docs/data/identity-migration-design.md`。
