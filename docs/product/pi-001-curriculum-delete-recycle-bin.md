# PI-001 Curriculum Delete & Recycle Bin Integration

狀態：Implementation Completed — Awaiting Product Review

## Executive summary

PI-001 將 AP-002F Recycle Bin Foundation 接入 Curriculum 產品流程，完成教材封存、移入回收桶、回收桶還原與受控永久刪除。這是 Curriculum-only 的產品整合，不擴及 Lesson、Worksheet、Assessment、AI、Student、Class、Organization Closing 或 Account deletion。

## Scope

已完成：

- Curriculum detail danger zone。
- Curriculum list lifecycle actions。
- `/curriculums/recycle-bin` 回收桶頁面。
- Soft delete 欄位：`deleted_at`、`deleted_by`、`deletion_reason`。
- Normal list/detail/API 自動排除 `deleted_at is not null` 的教材。
- Recycle bin 專用查詢只顯示目前 active organization 的 deleted curricula。
- Archive／restore archived／soft delete／restore deleted／permanent delete route handlers。
- AP-004 authorization runtime integration through trusted server context。
- AP-002F restore／permanent deletion evaluator product adapter。
- AP-002B AuditWriter adapter and append-only curriculum lifecycle audit table。

未完成：

- Lesson／Worksheet／Assessment lifecycle。
- Re-authentication UI or receipt verification。
- Background job execution for large purge work。
- Platform Admin review console。
- Organization closing or account deletion workflows。
- General-purpose recycle bin across all entities。

## Lifecycle model

Current legacy curriculum states remain:

- `draft`
- `active`
- `archived`

PI-001 adds recycle state through `deleted_at` instead of changing the existing status enum:

- Normal record: `deleted_at is null`
- Recycle bin record: `deleted_at is not null`

Rules:

- `draft` can be moved to recycle bin.
- `active` must be archived before recycle-bin deletion.
- `archived` can be restored to `active`.
- `archived` can be moved to recycle bin.
- Recycle-bin restore clears delete metadata and preserves the underlying status.
- Permanent deletion is only available for records already in recycle bin.

## Authorization

PI-001 does not trust client role or organization id. Product code builds a trusted authorization context from:

- authenticated account id,
- active organization membership,
- server-resolved organization role.

Permissions:

- `curriculum.archive`
- `curriculum.delete`
- `curriculum.restore`
- `curriculum.permanently_delete`
- `recycle_bin.read`

Only `organization_owner` and `organization_admin` receive these product grants in PI-001. Teacher and reviewer remain read-only.

## Recycle Bin Foundation integration

`lib/recycle-bin/` remains framework-neutral and product-neutral. PI-001 adds a Curriculum adapter outside the foundation:

- maps deleted curriculum rows to `RecycleEntry`,
- evaluates restore through `evaluateRestore()`,
- evaluates permanent deletion through `evaluatePermanentDeletion()`,
- fails closed when protected dependencies, retention, or legal hold inputs block purge eligibility.

## Audit integration

PI-001 adds `curriculum_lifecycle_audit_events` as an append-only table for curriculum lifecycle receipts. Events:

- `CURRICULUM_ARCHIVED`
- `CURRICULUM_RESTORED`
- `CURRICULUM_SOFT_DELETED`
- `CURRICULUM_PERMANENTLY_DELETED`

The product adapter uses AP-002B `AuditWriter` to produce a receipt and hash chain material before appending. Metadata is allowlisted and does not include curriculum content, prompts, answers, API keys, tokens, or secrets.

## Database

Migration:

- `supabase/migrations/20260728120000_pi001_add_curriculum_recycle_bin.sql`
- `supabase/migrations/20260728123000_pi001_use_active_curriculum_name_uniqueness.sql`
- `supabase/migrations/20260728124000_pi001_inline_curriculum_lifecycle_role_checks.sql`

Additive changes only:

- `curriculums.deleted_at`
- `curriculums.deleted_by`
- `curriculums.deletion_reason`
- recycle-bin indexes,
- append-only curriculum lifecycle audit table,
- fixed-search-path lifecycle RPCs.
- active-only curriculum name uniqueness, scoped by organization.
- caller-bound lifecycle RPC role checks for archive, restore, recycle-bin delete, and controlled permanent delete.

No historical Sprint migration is modified. No production operation is performed by this package.

## Known limitations

- Deleted curricula no longer reserve active curriculum names after the PI-001 follow-up migration is applied. Restore remains fail-closed: if a new active curriculum already uses the recycled curriculum name in the same organization, restore returns a safe domain error instead of exposing a database error.
- Permanent deletion is synchronous and limited to the current Curriculum hierarchy. Future large purges should move to AP-004 background jobs.
- Re-authentication policy foundation exists, but PI-001 does not implement a re-auth UI or receipt.
- Audit persistence is Curriculum-specific, not the final platform-wide audit center.
- Dependency checks currently block published curriculum versions; future Worksheet／Assessment／Learning History dependencies must be added before those domains launch.

## Product review checklist

1. Owner/admin sees lifecycle actions.
2. Teacher/reviewer do not see mutation actions.
3. Draft curriculum can move to recycle bin.
4. Active curriculum must be archived before deletion.
5. Deleted curriculum disappears from normal list and detail URL.
6. Deleted curriculum appears in `/curriculums/recycle-bin`.
7. Restore returns curriculum to normal list.
8. Permanent deletion requires typed confirmation and protected dependency checks.
9. Lifecycle operations write audit receipts.
