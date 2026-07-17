# ADR-010：Authorization Model

狀態：**Proposed — Awaiting Architecture Approval**
日期：2026-07-17

## Context

AP-003A已分離Account、Person、Profile、Membership與Persona，但Sprint 1～8仍以`organization_members.role`支援四個角色。未來多角色、Platform治理、Student/Guardian、School/Campus與AI工作不能安全塞入單一role欄位。

## Decision

採用`Actor + Role Assignment + Permission + Scope + Business Rule + Obligation`模型：

1. Role是版本化Permission集合，不是Person、Persona、Membership或職稱。
2. Organization與Platform assignment分離；Service Principal使用獨立workload assignment。
3. Persona可作policy必要條件，但不直接授權。
4. AI名稱只作execution profile，不是Person role或Service Principal。
5. Authorization canonical decision在server；UI只改善體驗，RLS是最終資料邊界。
6. Role、Permission、Scope、Entitlement與Business Rule分開評估。

## Rejected alternatives

- 單一`isAdmin`／`isOwner`：不能表達Scope、期限、SoD與Audit，拒絕。
- Persona直接授權：會把教育身份與Permission耦合，拒絕。
- Platform role加入所有Organization Membership：破壞租戶隔離，拒絕。
- AI／worker使用真人Account：無法最小授權與追蹤，拒絕。

## Consequences

- 現有四個role需legacy adapter與shadow parity驗證。
- Role mutation受AP-002B Audit阻擋，長效／不可逆工作受AP-004阻擋。
- 未實作Scope不能向上fallback，初期會產生更嚴格的deny。
- 本ADR不建立Migration、Role table、Policy Engine或UI。
