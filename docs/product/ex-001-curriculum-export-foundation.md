# EX-001 Curriculum Export Foundation

狀態：Implementation Completed — Awaiting Product Review

## Summary

EX-001 建立第一版教材匯出能力，支援從已儲存的 Curriculum Version 產生 runtime PDF，並提供 Browser Print Preview。匯出資料來源固定為 `CurriculumExportDocument`，renderer 不直接讀取 Curriculum entity、AI preview 或 provider response。

## Scope

- Export core：`lib/curriculum-export/`
- PDF renderer：A4 portrait、黑白列印友善、頁碼、頁首與作答欄位
- Export modes：`worksheet`、`answer-sheet`、`combined`
- API：`GET /api/curricula/{curriculumId}/versions/{versionId}/export?mode=...`
- Browser print：`/curriculums/{id}/versions/{versionId}/print?mode=...`
- Audit：`CURRICULUM_EXPORTED`

## Architecture Boundary

Export core 不依賴 React、Next.js、browser API、Supabase、Database 或 PDF library。產品 adapter 位於 `lib/curriculum/export.ts`，負責 authenticated user、active organization、membership、role、tenant boundary、stored version loading 與 audit writing。

## Export Modes

- `worksheet`：題目與作答空白，不顯示答案。
- `answer-sheet`：題目、答案與解析。
- `combined`：先輸出 worksheet，再 page break 輸出 answer sheet。

題號固定依已儲存版本中的原始順序建立，`questions + challengeQuestions` 連續編號，挑戰題不重新從 1 開始。

## Data Source

只允許匯出已儲存 Curriculum Version。若 version 有 `curriculum_ai_drafts`，使用其 structured content；若無 AI draft，使用已儲存章節／課次建立 fallback worksheet document。不得匯出未儲存 preview、AI raw response、prompt 或 provider metadata。

## Security

- 不建立 public storage。
- 不永久保存 PDF。
- PDF 於 request runtime 產生。
- Cross-tenant 或 missing version 以 `not_found` fail closed。
- Audit metadata 僅保留 curriculumId、curriculumVersionId、exportMode 與 outputFormat，不保存 PDF binary、完整教材內容或答案。

## Limitations

- PDF renderer 為第一版 runtime renderer，尚未提供 DOCX、題型版面模板、品牌樣式、批次匯出或 background export。
- Browser print 使用同一份 `CurriculumExportDocument`，但實際紙張輸出仍受瀏覽器列印設定影響。
- Export permission 目前由 owner/admin/teacher 透過 AP-004 授權 adapter 檢查；細緻 scope 與 publish quality gate 留待後續 package。
