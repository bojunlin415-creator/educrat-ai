# 測試計畫

文件版本：v1.0  
目前工具：TypeScript、ESLint、Vitest、Testing Library、Playwright、Next.js production build

## 目標

測試用來保護功能、租戶隔離、資料完整性、教材正確性、匯出門檻及商務流程。不得為了讓檢查通過而刪除合理測試、降低 strict 設定或繞過驗證。

## 測試層級

### 靜態檢查

- `pnpm run typecheck`：TypeScript strict、無隱性不安全型別。
- `pnpm run lint`：Next.js、React、可存取性及工程規範。
- `pnpm run format:check`：格式一致性；不取代 lint。
- `pnpm run build`：production 編譯、路由與 Server／Client 邊界。

### 單元測試

使用 Vitest，適合：

- Zod schema 與資料正規化。
- 權限 helper 與狀態轉換。
- Blueprint、配分、難度及科目規則。
- 數學答案計算與 property-based scenarios。
- 品質檢查、重試、成本及額度計算。
- UI 元件狀態與可存取性互動。

### 整合測試

適合驗證：

- Route Handler／Server Action 的輸入、授權、錯誤與回應。
- Supabase RLS、constraint、trigger 與 repository。
- AI job 搭配 mock provider 的完整狀態流。
- Webhook 簽章、冪等性及 ledger 更新。
- 教材品質狀態是否正確阻擋匯出。

整合測試使用隔離資料庫與虛構資料，不連接 production。

### E2E 測試

使用 Playwright，至少涵蓋桌面與手機 viewport：

- 首頁、登入、登出與受保護路由。
- 建立機構、邀請與角色權限。
- 教材建立、AI 工作狀態、編輯、品質確認與匯出。
- 額度不足、provider 失敗、資料為空與權限拒絕。
- 跨租戶 URL 或識別碼存取被拒絕。

正式瀏覽器測試不得依賴不穩定的真實 AI 或付款服務，應使用可控測試 provider。

### 人工與領域驗證

- 響應式版面、列印、PDF、DOCX、中文與數學符號。
- 鍵盤操作、焦點、螢幕閱讀器標籤及色彩對比。
- 教師對題目、解析、年級、難度與教學適切性的審核。
- 法務對來源、出版社名稱、聲明與疑似相似內容的審核。
- 金流、退款、發票、備份、復原與回滾演練。

## 必要安全案例

- 未登入者無法讀取受保護資料。
- 使用者只能存取自己有 membership 的機構資料。
- 角色降級、停權或移除後權限立即失效。
- 前端竄改 organization id、role、price、quota 或付款結果仍被伺服器拒絕。
- 每張 Supabase 表的 `select`、`insert`、`update`、`delete` RLS 正反案例。
- API 對 malformed JSON、未知欄位、邊界值、過大 payload 與重複請求的處理。
- Secret 不出現在 client bundle、HTML、API error、log 或測試快照。
- Prompt injection 不能要求揭露 Prompt、忽略內容政策或重製未授權教材。
- 匯出端點不能繞過 quality `fail` 或未確認 `warning`。

## AI 與教材品質測試

- 所有 provider 回應先以 `unknown` 進入 schema 驗證。
- Schema version 不符、缺欄位、錯誤 enum、超長內容或答案不一致時拒絕寫入正式題庫。
- 固定測試案例追蹤 Prompt 版本回歸，但不把偶然模型文字當成唯一 snapshot。
- 數學採確定性規則與大量邊界／property-based 測試重新驗算。
- 國語與英文檢查文章可答性、唯一答案、長度、年級與目標範圍。
- 自然與社會正式開放前需建立有來源的事實測試集及教師抽驗。
- 重複、禁止內容與相似風險案例必須能產生正確 pass／warning／fail。

## 測試資料規則

- 只使用虛構教師、學生、機構與教材內容。
- 不使用真實個資、production dump、出版社題目或課文。
- 測試固定時間、亂數 seed 與 mock response，避免 flaky test。
- 測試完成後清除隔離資料；測試不得依賴執行順序。

## 每個 Sprint 的最低門檻

1. 新增或修改邏輯有與風險相稱的測試。
2. Bug 修正先建立或補上可重現問題的測試。
3. 所有主要狀態與錯誤路徑有測試或明確的人工驗證紀錄。
4. 下列命令全部通過：

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

5. 涉及主要使用流程時執行 E2E；若瀏覽器或外部測試環境尚未準備，必須明確列為限制與人工待辦，不可宣稱已通過。

## 目前基線

Sprint 1 已建立：

- Button 互動與 loading 單元測試。
- 登入 schema 有效／無效輸入測試。
- 首頁、登入頁及 Dashboard 的 Playwright navigation spec。

Sprint 2 僅修改文件，不新增產品邏輯；仍需執行完整四項品質檢查，確認文件與設定變更沒有影響建置。

Sprint 3 新增：

- Supabase 公開環境變數有效／無效輸入單元測試。
- profiles Migration 靜態安全契約測試，確認 RLS、policy、grant、trigger 與 health function。
- 已在 non-production Supabase 完成未登入拒絕、使用者讀寫自己、跨使用者隔離與無直接刪除權限驗證。

Sprint 4 新增：

- 註冊、密碼確認及 callback redirect 白名單 schema 測試。
- Auth provider 錯誤安全映射測試。
- 可替換記憶體 rate limiter 的限制、重設與 key 隔離測試。
- E2E 規格更新為未登入 Dashboard 必須導向登入頁。
- Email 登入、callback、session、登入／未登入 redirect 與登出已在 development 驗證；Google OAuth 尚待人工驗收。
- 密碼復原雖完成基本人工流程，recovery session 與目前登入帳號的綁定仍需高優先安全修正，不列為完全通過。

Sprint 5 新增：

- Profile Zod schema 的正規化、空電話、語言／時區 allowlist 與錯誤輸入測試。
- Avatar JPEG／PNG／WebP 檔頭、MIME 不一致、大小限制與安全物件路徑單元測試。
- Profile form 的 client 驗證、成功狀態與不支援圖片預先拒絕測試。
- Avatar Storage migration 安全契約測試及真實 own／跨使用者／匿名 RLS 整合驗證。
- Playwright 真實帳號 E2E：onboarding、個人資料更新、伺服器拒絕錯誤輸入、Avatar 上傳／移除、工作台名稱與登出保護。

Sprint 6 新增：

- Organization Zod schema、slug 正規化、保留字與邊界值單元測試。
- Organization onboarding／settings／switcher 的 loading、success、error、唯讀權限與切換互動測試。
- Migration 靜態安全契約：新表 RLS enable／force、最小 grant、fixed-search-path RPC、原子 owner 建立、最後 owner 保護、active preference fallback 與無破壞性 SQL。
- 真實 Development Supabase RLS E2E 使用兩個一般 authenticated 帳號與 publishable key，驗證 own read、跨租戶隱藏、匿名拒絕、直接 insert／membership mutation 拒絕、跨租戶切換拒絕、合法切換及 duplicate rollback；禁止以 Service Role 通過測試。
- Playwright UI E2E 驗證第一個機構建立、Dashboard context、owner settings、Organization Switcher、桌面／手機與 Sprint 5 Profile／Avatar regression。
- Supabase Security Advisor 與直接 function ACL 查詢驗證 Trigger-only SECURITY DEFINER functions 不可由 API roles 呼叫；需供登入者使用的 create／switch／current-context RPC 保留 authenticated execute，並以 `auth.uid()` 與 membership 檢查限制結果。

為避免 Auth provider rate limit 造成非產品錯誤，真實 Auth/RLS E2E 以單一 worker 執行。RLS fixture 使用 development-only 虛構帳號與可重複的雜湊 slug；沒有安全的成員刪除流程前不以破壞性 SQL 清理，會重用固定 fixture 而不持續新增資料。Teacher／reviewer 的遠端 membership 管理與正式清理流程須由後續成員管理 Sprint 補齊，Curriculum Editor 不擴張 membership 權限。

Sprint 7 新增：

- Curriculum Zod schema 測試：有效建立／更新、非法 UUID、學年度、學期、狀態、未知 organization 欄位與機構角色權限。
- Curriculum Form 測試：建立、編輯、client validation、success routing 與初始版本欄位狀態。
- Collection／detail API 測試：list、create、update、invalid input、未登入、not-found 與 teacher/reviewer forbidden 安全回應。
- Migration 靜態安全契約：七張表 RLS enable／force、active organization policy、owner/admin mutation、原子 RPC、資料庫 seed、無 direct insert/delete、無歷史 table ALTER 與無 Storage／題庫／試卷。
- Development RLS E2E：以兩個一般帳號與 publishable key 驗證教材建立與版本 1、重複名稱、direct insert 拒絕、owner update、active organization 切換、跨租戶隱藏與匿名拒絕，已通過。
- 隔離本機 SQL RLS acceptance：以同一組 Migration、`authenticated`／`anon` 資料庫角色及 JWT subject claim 驗證 Owner／Admin 可建立與修改、Teacher／Reviewer 唯讀、另一 active tenant 全階層不可見，以及匿名拒絕；測試資料置於單一 transaction 並完整 rollback，已通過。
- Playwright UI：教材列表、空狀態、建立、詳細、修改、重複名稱、非法資料、桌面／手機及登出 regression，共 4 項已通過。

`20260715090000` 已套用至 `educrat-development`，local／remote history 一致。遠端七張教材表已確認存在；Development 真實兩帳號 RLS、隔離本機四角色 RLS、Vitest 24 檔 147 項、Playwright 4 項及修改後 production build 均已通過。邀請／角色管理 UI 仍屬後續 Sprint，因此四角色 fixture 只在本機 rollback transaction 建立，不在遠端留下不受控 membership。

Sprint 8 新增：

- Chapter／Lesson Zod schema：建立、修改、刪除、完整排序、非法 UUID、重複排序 ID、狀態與欄位邊界。
- Chapter／Lesson API：未登入、owner/admin 受控變更、teacher/reviewer forbidden、not-found、衝突與安全錯誤映射。
- Migration static：只新增 Sprint 8 欄位與 fixed-search-path RPC，不修改 Sprint 1～7 migration、不新增核心 table、不放寬 direct write。
- AI-ready Migration static：difficulty nullable 1–5、keywords 安全預設與正規化限制；確認沒有 Prompt、Embedding、生成或 review workflow 物件。
- Editor component：章分頁 lazy render、展開後才 render 課次、唯讀模式與可存取控制。
- 隔離本機 SQL RLS：Owner／Admin CRUD 與排序、Teacher／Reviewer 唯讀、跨 organization 隱藏、匿名拒絕、direct insert 拒絕、刪除後連續排序，全部置於 transaction 並 rollback。
- Playwright 真實 Development 流程：新增／修改／排序／刪除章與課、版本 1 唯讀、未登入 API 拒絕、手機 viewport，以及 Sprint 1～7 完整 regression，共 4 項通過。

`20260715160000` 與 `20260715183000` 已套用至 `educrat-development`，local／remote history 一致。Vitest 30 個測試檔／176 項、Playwright 4 項及修改後 production build 均已通過。`supabase test db --linked` 的 Docker-to-remote runner 曾在連線階段逾時，因此四角色 SQL 使用套用相同 migration 的本機隔離 DB 驗證；遠端 RPC 與 schema 由 migration history 及真實應用 E2E 交叉驗證。

AR-001 新增：

- Display Adapter unit test：既有三筆 legacy row 映射為教學進度模板 1／2／3，序列化結果不得包含原始品牌名稱，也不得形成對外品牌對照表。
- Legacy API request contract：`publisherId` 仍可提交，但 server schema 必須正規化為 `curriculumReferenceId`。
- Legacy API response contract：保留 `publisher_id`／`publisher` 欄位形狀，但 name/code 必須是中性相容值；同時提供 `reference.displayName`。
- UI static scan：`app/` 與 `components/` 不得使用 Publisher 文案或 raw source name。
- AI policy static scan（未來 AI Sprint）：Prompt context 不得包含 publisher identity keys。
- AR-001 不建立 Migration；既有七筆 local／remote history 不得改變。

### Milestone 2 人工驗收待辦

Sprint 6、Sprint 7 與 Sprint 8 的自動化整合驗收已完成。以下項目仍須由產品負責人操作實際裝置，且在完成前不得標記為人工驗收通過：

- 桌面與手機實際操作 Organization onboarding、settings 與 switcher。
- 桌面與手機實際操作 Curriculum 列表、空狀態、建立、詳細與編輯流程。
- 桌面與手機實際操作 Curriculum Editor 的章／課新增、修改、刪除、展開／收合與拖曳排序。
- 只用鍵盤驗證 Tree 焦點、方向鍵展開／收合及上下排序按鈕。
- 確認實際裝置的導覽、按鈕、欄位、錯誤訊息、loading 與成功回饋沒有破版或操作障礙。
- 由產品負責人記錄人工驗收日期、裝置、瀏覽器、結果與待修項目。
