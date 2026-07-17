# ADR-013：Policy Decision Framework

狀態：**Proposed — Awaiting Architecture Approval**
日期：2026-07-17

## Context

授權散落於UI、Route、Service、RPC與RLS會造成語意漂移。EduCraft AI需要單一可解釋的server decision contract，同時保留Domain business invariant與Database隔離。

## Decision

1. Canonical pipeline為Authentication → Identity lifecycle → Session freshness → Membership／Persona → Role Assignment → Permission → Scope → Tenant／Resource → Entitlement → Lifecycle／Hold → Business Rule → SoD → Re-auth／Approval → Decision → Audit obligation。
2. Decision為`ALLOW`、`DENY`、`CONFLICT`、`REQUIRE_REAUTH`或`REQUIRE_APPROVAL`。
3. Deny優先；沒有matching policy或資料缺失fallback為DENY。
4. ALLOW必須帶effective scope、conditions、expiry、masking與obligations；執行層未履行obligation不得執行。
5. API在Domain Service前決策，Domain Service重驗business invariant，RPC重驗`auth.uid()`與tenant，RLS作最後防線。
6. Client傳入role、permission、user／person／organization ownership只能作不可信input，不能作authority。

## Conflict policy

- Explicit deny與allow衝突時deny。
- SoD、同Person多Account或多assignment矛盾時CONFLICT。
- 只有catalog明定且有approval workflow時，CONFLICT才可轉`REQUIRE_APPROVAL`。
- 完成re-auth／approval後必須重新評估，不可把舊decision改成allow。

## Consequences

- Decision可被測試、Audit與安全分析，但不取代RLS或Domain rules。
- 通用公開permission-check API可能形成resource oracle，預設只提供server-internal contract。
- AP-002B需保存高風險decision receipt；AP-004處理長工作中的checkpoint重驗與撤銷傳播。
- 本ADR不建立Policy Engine、Middleware、API、JWT、Session或Audit writer。
