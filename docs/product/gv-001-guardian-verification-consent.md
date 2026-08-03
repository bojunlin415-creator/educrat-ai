# GV-001 Guardian Verification & Consent Foundation

狀態：Implementation Completed — Final External Verification Required

GV-001 是 PP-001 的補完 Package，建立安全、可稽核的 guardian invitation、verification、consent 與 relationship activation flow。

## Lifecycle

Guardian relationship lifecycle：

```text
pending → verified → active → revoked
```

第一版採 Organization-issued invitation。Relationship 進入 `active` 前必須保存：

- organization approval：`requested_by` / invitation creator
- identity verification：受邀 Email 與登入帳號 verified email 一致
- guardian consent：`consent_granted_at` + `consent_version`
- activation：`activated_at` + `activated_by`

## Invitation Model

新增 `guardian_invitations`：

- `organization_id`
- `student_id`
- `guardian_email_normalized`
- `relationship_type`
- `token_hash`
- `status`
- `expires_at`
- `created_by`
- `accepted_at`
- `consumed_by_account_id`
- `consent_version`

Raw token 只在建立邀請時回傳給 authorized admin，用於 Development / future email delivery boundary；Database、Audit 與 Log 均不得保存 raw token。

Invitation status：

- `pending`
- `accepted`
- `expired`
- `revoked`

## Acceptance Flow

```text
Organization Owner/Admin
  → POST /api/guardian-invitations
  → receives one-time invitation link
Guardian signs in with same verified email
  → /guardian-invitations/accept?token=...
  → preview minimal child information
  → explicit consent
  → POST /api/guardian-invitations/accept
  → accept_guardian_invitation RPC
  → guardian membership + active relationship + audit
  → /dashboard/parent
```

Acceptance is server-side and fail closed. Client never sends `guardianId`, `studentId`, `organizationId`, verification status, active status, or relationship state.

## Security Boundary

- No client self-elevation.
- No direct client insert/update to `student_guardians`.
- Invitation token persisted only as SHA-256 hash.
- Token is single-use.
- Expired, revoked, accepted, unknown, wrong-email, unconfirmed-email and malformed token fail closed.
- Existing non-guardian membership in the same organization causes role-conflict fail closed. This preserves current single-role `organization_members` compatibility until AP-003 multi-role cutover.
- Teacher is not implicitly guardian.
- Relationship-specific access remains required by PP-001.

## API

- `POST /api/guardian-invitations`
- `GET /api/guardian-invitations/preview?token=...`
- `POST /api/guardian-invitations/accept`
- `POST /api/guardian-relationships/[relationshipId]/revoke`

No email provider is implemented. The invitation link is returned to authorized admin as an integration boundary for Development/manual verification and future notification delivery.

## GV-001E E2E Fixture Architecture

Formal browser verification lives in `tests/e2e/guardian-parent-portal.spec.ts`.
It requires Development-only fixture accounts and students:

- `E2E_AUTH_EMAIL` / `E2E_AUTH_PASSWORD`：Organization Owner/Admin account.
- `E2E_GUARDIAN_EMAIL` / `E2E_GUARDIAN_PASSWORD`：verified guardian account that has no pre-existing active relationship.
- `E2E_WRONG_GUARDIAN_EMAIL` / `E2E_WRONG_GUARDIAN_PASSWORD` or `E2E_RLS_EMAIL` / `E2E_RLS_PASSWORD`：wrong-email / cross-tenant account.
- `E2E_GV_STUDENT_ID` and `E2E_GV_SECOND_STUDENT_ID`：fake active student memberships in the target Development organization.
- Optional `E2E_GV_ORGANIZATION_ID`：explicit target organization when the admin has more than one active organization.

The spec uses the formal admin API to create invitations and the formal guardian UI/API to accept them. It never uses Service Role, direct `student_guardians` insert, direct active status update, RLS disablement, fixed production data, or a test backdoor.

## Development-only Invitation Link Retrieval

The first safe retrieval boundary is the existing `POST /api/guardian-invitations` response. Only an authenticated Organization Owner/Admin can create an invitation and receive the one-time raw link. The raw token is not persisted, not written to audit, not returned to unauthorized users, and is not serialized into the acceptance page source as a React prop.

## E2E Coverage

GV-001E covers:

- Admin invitation creation.
- Wrong-email acceptance rejection.
- Guardian verified-email acceptance.
- Explicit consent.
- Active verified relationship creation.
- Parent Portal linked child visibility.
- Summary, Assignments and Recommendations APIs.
- Multi-child selector.
- Token replay rejection.
- Cross-tenant / unrelated child rejection.
- Direct relationship / consent mutation denial.
- Admin revocation and immediate guardian access loss.
- Audit event presence and raw-token exclusion.

## Audit

GV-001 extends `parent_portal_audit_events` with:

- `GUARDIAN_INVITATION_CREATED`
- `GUARDIAN_INVITATION_ACCEPTED`
- `GUARDIAN_CONSENT_GRANTED`
- `GUARDIAN_RELATIONSHIP_CREATED`
- `GUARDIAN_RELATIONSHIP_REVOKED`

Audit metadata does not contain raw token, child report payload, answers, prompts, provider responses, or sensitive verification documents.

## Known Limitations

- No email sending.
- No guardian self-claim.
- No legal document upload.
- No consent revocation UI.
- No parent messaging or notification.
- No multi-role same-organization support; a teacher/admin account cannot also become guardian in the same organization until AP-003 role assignment cutover.
- Formal E2E requires Development fixture accounts and fake active student memberships; Production data must not be used.
