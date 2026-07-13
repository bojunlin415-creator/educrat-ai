# 專案協作規範

本文件適用於所有人員與自動化開發代理。若 Sprint 指令與本文件衝突，應採用較嚴格且不擴張 Sprint 範圍的規則，並在回報中指出差異。

## 開始 Sprint 前

1. 依序完整閱讀：
   - `README.md`
   - `AGENTS.md`
   - `docs/product-spec.md`
   - `docs/system-design.md`
   - `docs/database.md`
   - `docs/changelog.md`
2. 盤點現有功能、測試、相依套件、工作區變更與 Sprint 前置條件。
3. 說明預計修改範圍、資料庫影響、風險及驗證方式後再開始。
4. 保留使用者既有變更，不得覆寫或清除不屬於本 Sprint 的內容。

## 永久工程規則

- 每次只處理指定 Sprint，不大幅重寫專案或刪除既有功能。
- TypeScript 必須維持 strict mode；禁止使用 `any`，除非附上無法避免的具體原因與範圍註解。
- 所有外部輸入皆視為不可信任資料，必須在伺服器端以 Zod 或等效 schema 驗證。
- 所有 Supabase 資料表必須啟用 RLS，並依操作建立最小權限 policy 與跨租戶測試。
- OpenAI API Key、Supabase Service Role Key 與其他私密金鑰只能在伺服器端使用，不得進入 client bundle、回應或 log。
- 所有 AI 輸出必須使用結構化格式，通過 schema、領域規則及品質檢核後才能保存或顯示為可用內容。
- 教材匯出前必須通過品質檢查；`fail` 不得匯出，`warning` 必須由教師明確確認。
- 主要功能必須提供 loading、empty、error、success 狀態，並支援桌面、平板與手機。
- 不得將出版社課文、題庫、教師手冊、插圖、答案或其他未授權內容加入程式、資料庫、測試資料或提示詞。
- 出版社只能作為公開教學進度參考，不得宣稱為出版社官方教材或已獲背書。
- 不得自行修改正式環境資料、執行 production migration、commit、push 或 deploy。

## Git 工作規範

目前若尚未建立 Git 儲存庫，不得在未取得指示時自行初始化。

### Branch 命名

- 功能：`feat/sprint-<編號>-<簡短名稱>`
- 修正：`fix/<議題編號或簡短名稱>`
- 文件：`docs/<簡短名稱>`
- 維護：`chore/<簡短名稱>`

名稱使用小寫 kebab-case，例如 `feat/sprint-03-supabase-foundation`。禁止直接在 `main` 或 production branch 開發。

### Commit message

採 Conventional Commits：

```text
<type>(<scope>): <imperative summary>
```

允許的主要 type：`feat`、`fix`、`docs`、`test`、`refactor`、`chore`、`perf`、`ci`。範例：`docs(sprint-02): define engineering standards`。每次 commit 應保持單一目的，禁止提交金鑰、`.env.local`、建置產物或未授權教材。

### Migration 命名

```text
YYYYMMDDHHMMSS_s<兩位Sprint編號>_<動詞>_<資源>.sql
```

例如：`20260713153000_s03_create_profiles.sql`。Migration 必須可在隔離環境重複驗證；不得更改已套用的歷史 Migration，應建立新的修正 Migration。

## Definition of Done

Sprint 只有在下列條件全部滿足時才算完成：

- 指定驗收條件完成，且沒有擴張到其他 Sprint。
- 所有新增輸入具備伺服器端驗證；所有新增資料表具備 RLS、policy 與測試。
- 權限、私密資料、內容授權及 AI 結構化輸出符合專案規則。
- 主要互動具備 loading、empty、error、success 狀態及響應式版面。
- 新增或修改邏輯有與風險相稱的單元、整合或 E2E 測試。
- `docs/changelog.md` 與受影響文件已更新。
- 已檢查 diff，沒有無關修改、未註解的 `any`、敏感資訊或未授權內容。
- 下列命令全部通過：

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

- 完成報告列出修改檔案、Migration、測試、安全檢查、已知限制、人工操作及下一步。

## Sprint 完成回報

每次至少回報：完成狀態、完成內容、新增與修改檔案、資料庫與 API 異動、四項品質檢查、E2E 狀態、安全檢查、已知限制、人工操作，以及是否執行 Migration、commit、push、deploy。
