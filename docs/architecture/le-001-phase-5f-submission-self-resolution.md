# LE-001 Phase 5F — Submission Self-Resolution Canonical Cutover

Status: **Implementation and Development Verification Complete — Awaiting Package Seal**

Target self-identity authority: **`CANONICAL_PRIMARY_LEGACY_FALLBACK`**

Target new-write authority: **canonical only, no automatic legacy retry**

Production: **UNTOUCHED**

## Current submission identity

`assignment_students.student_id` and `assignment_submissions.student_id` are
foreign keys to `profiles.id`. In the sealed AS-001 contract they therefore
mean the authenticated Account/Profile compatibility identity, not
`students.id`. Student eligibility, self-read, draft save, submit, RLS, and the
one-submission constraint all currently compare that value with `auth.uid()`.

Historical rows must keep that meaning. Phase 5F must never write a canonical
Student UUID into either legacy column.

## Schema decision

### A. Current PK/FK model

- `assignment_submissions.id` is the Submission primary key.
- `(assignment_id, student_id)` is unique.
- `student_id` references `profiles.id` and is required.
- Assignment and Organization are stored on every Submission.

### B. Legacy `student_id` semantics

The value is a Profile/Auth-account compatibility key. It is not a learner
record and cannot identify a managed/accountless Student.

### C. Existing `assignment_students` dependency

Legacy student eligibility and lifecycle state are materialized in
`assignment_students`. Phase 5E may create a verified mirror for linked
canonical recipients, but a canonical recipient is valid without that mirror.

### D. Canonical recipient dependency

`assignment_student_recipients.student_id` always means `students.id` and its
composite tenant foreign keys bind Assignment, Student, and Organization.

### E. Historical compatibility

Existing Submission rows are not updated, deleted, relabeled, or heuristically
mapped. Rows without authoritative ownership remain
`LEGACY_ONLY_HISTORICAL`. A verified learner may acquire canonical ownership
only as part of an authenticated, successful Submission mutation.

### F. Candidate designs

1. Add nullable canonical columns to `assignment_submissions`.
2. Add a separate canonical ownership relation.
3. Reinterpret `student_id` for new rows.

Option 3 is forbidden because it mixes UUID semantics. Option 1 still couples
canonical ownership to a legacy Profile FK and makes policy intent less clear.

### G. Selected design

Phase 5F adds `assignment_submission_canonical_ownerships`. Each row binds one
Submission to one canonical Assignment recipient and one `students.id` through
same-tenant composite foreign keys. The legacy Submission row remains intact
for compatibility, while the ownership relation is authoritative for every
new canonical self-submission.

### H. RLS implications

Student self-read uses an active, verified, in-window Account link and the
canonical ownership relation. Manager reads retain the existing scoped
Assignment rule. Canonical writes execute only through a fixed-search-path
RPC that derives Account, Organization, Student, and recipient server-side.
The client supplies only Assignment ID, structured content, and action.

### I. Delete and cascade implications

All new ownership foreign keys use `ON DELETE RESTRICT`. No Submission,
recipient, Student, Account link, or historical row is cascade-deleted.

### J. Rollback implications

The runtime control can return to `LEGACY_ONLY` without a down migration or
data rewrite. Canonical ownership rows remain preserved. Historical Profile
IDs are never rewritten, and canonical write failure never triggers an
automatic Profile-keyed write.

## Trusted self-resolution

The canonical chain is:

```text
auth.uid()
  -> active organization membership
  -> one active, verified, effective student_account_links row
  -> active students.id
  -> assignment_student_recipients
  -> assignment_submission_canonical_ownerships
```

Email, name, birthday, student number, school, grade, Profile display data,
and Class coincidence are never used for identity resolution. Missing,
revoked, expired, ambiguous, wrong-tenant, and non-recipient conditions fail
closed with typed errors.

## Read and write authorities

- **Submission Self Identity:** canonical Account-link resolution.
- **Eligibility:** canonical Assignment recipient.
- **New Write:** canonical ownership, no legacy write fallback.
- **Historical Read:** legacy compatibility where no canonical ownership
  exists.
- **Teacher Grading:** existing Assignment-manager scope; no organization-wide
  Teacher expansion.

Mapped Phase 5E compatibility recipients require a currently active verified
link even when the historical projection is queried. Revoked or expired links
cannot regain recipient or Submission access through the legacy fallback.

## Development verification

Migration `20260907120000_le001_canonicalize_submission_self_resolution.sql`
is applied only to `educrat-development` (`gqurnljrvwyhruhutvni`). Local and
Development history are synchronized at 31/31 and the post-apply dry-run is up
to date. Authenticated ACL, direct Submission write denial, internal helper
denial, ownership-table denial, student-only RPC denial for an Owner, and
anonymous denial passed live verification.

Controlled Development-only fixtures marked
`LE001_PHASE5F_E2E_59bb8d0f90d1` verified the complete canonical path. Five
temporary Auth accounts exercised linked Student, accountless Student,
expired link, non-recipient, and assigned Teacher contexts. The successful
path resolved exactly one `CANONICAL` recipient, created and read back one
Submission, persisted the matching `students.id` in
`assignment_submission_canonical_ownerships`, and required zero
`assignment_students` rows.

Fail-closed verification returned the expected typed database errors for a
missing link, expired link, revoked link, non-recipient, cross-tenant access,
and injected Student authority. Anonymous execution was denied by the RPC
grant. The assigned Teacher saw the scoped Submission while the same Teacher
saw zero rows for an unassigned Assignment. Revocation blocked future writes
while the historical Submission and canonical ownership remained preserved.
All temporary Auth and domain fixtures were then removed; marker counts for
accounts, Students, Assignments, and links returned to zero. Production was
not touched. Runtime authority remains
`CANONICAL_PRIMARY_LEGACY_FALLBACK`; this verification does not authorize
`CANONICAL_ONLY`.

## Deferred analysis concerns

Phase 5F proves canonical Student ownership for every new canonical
Submission and provides a stable Submission identity. Analysis remains
blocked from treating the payload as assessment evidence: the current model
has no first-class attempt aggregate, question-level answer schema,
correctness/score evidence, per-attempt timestamps, or enforced
knowledge-point mapping. Learning Events, Mastery, Adaptive, Reporting
metrics, Guardian/Parent Portal, and historical Profile-keyed analytics are
unchanged. These gaps belong to a future explicitly authorized canonical
Learning Events and Analysis Foundation package.
