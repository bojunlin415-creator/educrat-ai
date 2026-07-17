# EP-001：Development E2E Test Isolation

狀態：Completed — Validation Passed
範圍：Development Playwright fixture only

## 問題

原 Curriculum E2E 以測試 Email 雜湊產生固定教材名稱，並在固定 Organization 內重用歷史教材。教材名稱具有 organization-scoped、case-insensitive unique constraint；先前測試留下的更新名稱會使下一次 PATCH 失敗，測試因而錯誤依賴 Development Database 的既有狀態。

## Run-scoped fixture

- 每次測試以 timestamp、worker index、process id 與 Node `randomUUID()` 建立可辨識的 run ID。
- Curriculum 原名稱、更新名稱與衝突名稱都由相同 run ID 產生，同一次測試內可預測，不同執行與 worker 之間不衝突。
- 名稱只使用安全的英數、hyphen、空白與固定中文用途文字，並在 helper 內檢查 120 字產品上限。
- 測試永遠建立本次 run 的教材，不查找或重用歷史 Curriculum，也不假設 Development Database 為空。

## 重複名稱驗證

測試會在同一次 run 建立兩份名稱不同的 Curriculum，再嘗試將第一份更新為第二份的名稱。正式 API 必須回傳 HTTP 409 與安全的 duplicate-name 訊息；成功更新則使用第三個 run-scoped 名稱，並以 API response、導向、畫面標題與重新整理後狀態交叉驗證。

## Cleanup decision

EP-001 採策略 A「唯一命名，不清理」。本 Package：

- 不建立或使用 Service Role cleanup。
- 不新增 bypass RLS endpoint、DELETE RPC 或 transaction shortcut。
- 不刪除使用者、Organization 或既有 Development 資料。
- 不修改 Curriculum uniqueness、API、RLS、Migration 或 lifecycle。

Run-scoped fixture 會累積少量 Development-only 測試資料。長期環境容量、可追蹤 cleanup、保留期限與安全執行方式記錄為 **EP-002：E2E Environment Lifecycle／Cleanup Strategy**；EP-002 需另案設計，不屬於本修正。

## 驗證門檻

1. 原 profile／Curriculum spec 單獨連續執行三次。
2. 完整 Playwright 連續執行兩次，皆為 4/4。
3. 單執行緒 Unit／Integration、typecheck、lint、build、Prettier、diff 與敏感資訊掃描通過。
4. Local／Remote Migration history 不變，Production 不操作。

## Final validation

- Curriculum 單項驗證：1/1 通過。
- 完整 Playwright：連續兩次 4/4 通過。
- 單執行緒 Unit／Integration：31 個測試檔、182 項測試通過。
- Typecheck、Lint、Build、Prettier、`git diff --check` 與敏感資訊掃描通過。
- Local／Remote Migration history 一致；未修改 Database schema、Migration 或 Production。
