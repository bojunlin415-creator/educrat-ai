# ADR-011：Permission Model

狀態：**Proposed — Awaiting Architecture Approval**
日期：2026-07-17

## Context

硬編碼role名稱無法成為跨Domain、可版本化與可Audit的授權語言；Boolean permission也無法表示資源、操作與deprecated策略。

## Decision

1. Permission key固定為`resource.action`，使用小寫snake_case resource與受控action。
2. Permission是原子能力；Role只引用versioned permission set。
3. Scope、Resource ID、Organization ID、Entitlement與Business Rule不編入key。
4. `delete`不代表hard delete；不可逆操作使用獨立高風險permission與governance workflow。
5. Breaking語意變更建立新key；舊key標記deprecated、停止新grant並指定replacement。
6. Catalog採版本化artifact，未來可materialize至DB供FK、查詢與Audit；runtime assignment必須保存catalog／permission-set version。

## Controlled actions

基礎action包含`create`、`read`、`update`、`manage`、`assign`、`invite`、`suspend`、`reactivate`、`archive`、`restore`、`trash`、`delete`、`publish`、`review`、`approve`、`reject`、`submit`、`grade`、`override`、`generate`、`export`、`execute`、`configure`、`transfer`、`impersonate`。新增action需Architecture Review，禁止Domain自創同義詞。

## Consequences

- 可對Permission做靜態驗證、diff、版本與Audit。
- Role顯示名稱可調整而不改Permission語意。
- Catalog不直接授權；仍需Assignment、Scope與Policy Decision。
- 本ADR不建立catalog程式、DB table、Migration或API。
