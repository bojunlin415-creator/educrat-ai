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
- 尚待非 production Supabase 環境的 RLS 整合測試：未登入拒絕、使用者讀寫自己、使用者無法存取他人、無法直接刪除。

Sprint 4 新增：

- 註冊、密碼確認及 callback redirect 白名單 schema 測試。
- Auth provider 錯誤安全映射測試。
- 可替換記憶體 rate limiter 的限制、重設與 key 隔離測試。
- E2E 規格更新為未登入 Dashboard 必須導向登入頁。
- 尚待非 production Supabase：Email confirmation、Google PKCE、登出 cookie、密碼復原、已登入／未登入 redirect 與 session 持久化 E2E。
