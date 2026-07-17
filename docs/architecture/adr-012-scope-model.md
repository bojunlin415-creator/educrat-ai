# ADR-012：Resource Scope Model

狀態：**Proposed — Awaiting Architecture Approval**
日期：2026-07-17

## Context

只比對`organization_id`無法安全表示Campus、School、Grade、Class、Course、Resource、Self、Dependent、Assignment、Platform CASE與background Job。單一租戶範圍也會讓Teacher、Parent和Support取得過多資料。

## Decision

1. Scope是typed relationship：`PLATFORM`、`ORGANIZATION`、`CAMPUS`、`SCHOOL`、`GRADE`、`CLASS`、`COURSE`、`RESOURCE`、`SELF`、`CHILD_DEPENDENT`、`ASSIGNED`、`CASE`、`JOB`、`INTEGRATION`。
2. 每個Resource由owning Domain提供authoritative organization與lineage projection。
3. Scope向下繼承必須由Permission／Resource catalog明列，禁止子層向上繼承。
4. Parent依verified relationship與consent；Teacher依Class／Assignment；Support依CASE，不接受任意ID。
5. 尚未實作的Campus、School、Class等Scope一律fail closed，不得fallback成Organization。
6. effective scope永遠是request、assignment、relationship與resource lineage的交集。

## Consequences

- Policy查詢需穩定的resource lineage projection與index設計。
- RLS仍負責最終tenant boundary，細部Scope由server policy與Domain invariant共同執行。
- Scope資料缺失會拒絕操作，需明確access-denied reason而不是放寬。
- 本ADR不建立Scope table、Branch／School／Class schema、RLS或API。
