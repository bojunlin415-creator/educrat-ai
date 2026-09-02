# LE-001 Phase 5E — Assignment Recipient Canonicalization

Status: **Development Verified — Canonical Primary with Legacy Fallback**

Runtime consumer: **new Assignment recipient identity and manager read model**

Selected read authority: **`CANONICAL_PRIMARY_LEGACY_FALLBACK`**

Selected write authority: **`CANONICAL_WITH_VERIFIED_LEGACY_PROJECTION`**

Development migration:
**`20260831120000_le001_canonicalize_assignment_recipients.sql`**

Production: **UNTOUCHED**

## Architecture decision

The historical `assignment_students.student_id` references `profiles.id` and
is also the eligibility/ownership boundary used by `assignment_submissions`.
Changing that column to sometimes mean `students.id` would make one UUID field
carry two incompatible identities and would invalidate its existing foreign
key, RLS, and Submission semantics.

Two additive options were reviewed:

1. add a nullable canonical column to `assignment_students`; or
2. create a canonical recipient aggregate with explicit compatibility.

The second option was selected. A nullable column would leave the legacy
primary key, lifecycle status, and Submission relationship coupled to a
Profile that a managed learner does not have. The separate aggregate keeps
the canonical snapshot independent, makes the compatibility mapping
verifiable, and leaves every historical Profile-keyed row unchanged.

## Canonical schema

`assignment_student_recipients` is the new-recipient authority:

- `student_id` always means `students.id`;
- `(assignment_id, student_id)` is unique and makes repeated expansion
  idempotent;
- composite foreign keys require Assignment, Student, and recipient to share
  one Organization;
- recipient rows use snapshot-at-assignment semantics and are not deleted when
  a learner later leaves a Class;
- no foreign key points to `auth.users` or requires a Profile.

`assignment_recipient_classes` captures all Class and active
`student_class_members` origins. A learner expanded from several targeted
Classes remains one recipient with several provenance rows. Existing targets
can therefore be reasoned about without losing the remaining origin.

`assignment_recipient_legacy_compatibility` is server-only. It records a
legacy projection only when one active, verified, in-window
`student_account_links` record, Profile, and active Student organization
membership agree in the same tenant. It is not granted to `authenticated` and
is never returned to the browser.

The migration performs no backfill, update, delete, or rewrite of
`assignment_students`. All foreign keys use `ON DELETE RESTRICT`; recipient,
Submission, and learning history cannot be cascade-deleted through this
package.

## Transaction and write authority

`create_assignment_with_canonical_recipients` creates the Assignment, target
Classes, canonical recipients, provenance, optional verified compatibility,
and append-only Assignment audit events in one database transaction.
`add_assignment_canonical_recipients` applies the same recipient snapshot
rules to an existing Assignment.

Both public RPCs resolve `auth.uid()` and the active Organization on the
server. Owner/Admin may manage tenant Assignments. A Teacher may manage only
their own Assignment and their assigned active Classes. The caller does not
supply Organization or actor authority.

The RPC re-reads the current active canonical Class roster and compares it
with the Phase 5D candidate snapshot. A changed roster returns the typed
`recipient_snapshot_changed` conflict rather than silently omitting or adding
learners. Direct Students must be active and belong to the same Organization.

The default write authority is canonical. A verified legacy mirror is added
only where the authoritative link exists, to preserve the current Submission
path. A managed/accountless Student is still persisted canonically and the
missing mirror is not an error. Canonical write failure is never retried as a
legacy write, because that could lose accountless learners or create partial
authority.

## Read authority and compatibility

`get_assignment_recipient_projection` returns one normalized internal model:

- canonical recipient ID or null for an unmapped historical row;
- canonical Student ID or null for an unmapped historical row;
- `CANONICAL`, `CANONICAL_WITH_LEGACY_COMPATIBILITY`, or
  `LEGACY_ONLY_HISTORICAL`;
- recipient status, immutable Class origins, and assigned time.

It never returns raw Profile, Account, or Account-link IDs. Historical
`assignment_students` rows that have no authoritative mapping remain visible
as `LEGACY_ONLY_HISTORICAL`; the system does not fabricate a Student from
email, name, birthday, school, grade, student number, or Class coincidence.

Canonical-primary reads fall back only for a typed runtime/service
availability failure. Authorization, RLS, tenant, identity, constraint, and
validation failures remain fail closed. Sources are not merged in the
application adapter. `LEGACY_ONLY` provides a logical rollback without data
rewrite, down-migration, or deletion of canonical records.

## Managed learner and Submission boundary

A canonical Student with an active Class membership can be assigned without
an Auth Account, Profile, or Account link. No synthetic identity is created.
Deterministic service and migration tests verify that canonical persistence
happens before and independently of the optional compatibility branch.

Phase 5E does not make an accountless learner able to sign in or submit.
Student self-access, `assignment_submissions.student_id`, Submission RLS, and
the existing `assignment_students` eligibility check remain Profile/Account
keyed. Verified mapped recipients retain the legacy mirror required by that
path. Submission self-resolution is reserved for Phase 5F.

Teacher Dashboard and Reporting learner populations remain the sealed Phase
5B/5C canonical-primary implementations. Their historical Assignment metrics
are still legacy/compatibility metrics; Phase 5E does not label those metrics
canonical.

## RLS and least privilege

All three new tables have RLS enabled and forced. Ordinary authenticated
clients receive no direct INSERT, UPDATE, or DELETE grants. Manager SELECT is
tenant scoped and uses existing Organization/Assignment authorization. The
compatibility table has no direct authenticated SELECT grant. The internal
persistence helper is revoked from `public`, `anon`, `authenticated`, and
`service_role`; only the reviewed server-side RPC boundary can invoke the
write transaction.

No policy uses `USING (true)`, reads `auth.users`, accepts client-supplied
tenant authority, or broadens Student self-access.

## Development evidence

The migration was applied only to `educrat-development`
(`gqurnljrvwyhruhutvni`). Local and remote histories contain 30 synchronized
migrations and the post-apply dry-run reports the database is up to date.

Catalog and authenticated live verification found:

- canonical recipients: 0
- legacy historical recipients: 0
- compatibility mapped: 0
- managed/accountless persisted recipients: 0
- provenance rows: 0
- duplicate, tenant mismatch, unresolved, fallback, write-fallback, and
  shadow-error counts: 0

The safe projection RPC exists and returns `assignment_not_found` for an
unknown tenant-scoped Assignment. Anonymous execution and direct reads of the
compatibility table are denied with SQLSTATE `42501`. The Development roster
currently has no active Assignment candidate; the managed/accountless live
write is therefore **NOT EXECUTED — FIXTURE UNAVAILABLE**. It is covered by
deterministic service, transaction-contract, tenant-FK, idempotency, and
security tests without creating persistent learner or Assignment fixtures.

The full single-worker Vitest run passed 1,028 tests. Production build passed
when executed with the local process/port permission required by Turbopack.
Playwright completed 11 tests successfully; two unrelated Guardian Portal
cases could not start because `E2E_GUARDIAN_EMAIL` is absent, and three cases
were skipped by their existing fixture gates. No Assignment or Phase 5E E2E
case failed. Repository-wide Prettier still reports seven pre-existing Access
Control files; every Phase 5E changed file passes Prettier.

Development database lint reports existing `extensions` pgTAP resolution
findings and the pre-existing `accept_guardian_invitation` reference to a
missing `parent_portal_audit_events.student_id` column. It reports no Phase 5E
function issue; those unrelated findings are not modified by this package.

`CANONICAL_ONLY` remains closed because Admin, assigned/unassigned Teacher,
cross-tenant mutation, and managed/accountless live fixtures are unavailable.

## Remaining convergence

Assignment is **PARTIALLY CANONICAL**:

- canonical: Class expansion, new recipient identity/persistence, Class
  provenance, and manager recipient read model;
- legacy/compatibility: historical recipients, Submission ownership and
  self-resolution, Assignment learner metrics, and historical Profile-keyed
  references.

The next dependency package is Phase 5F Submission Self-Resolution Canonical
Cutover. It is not started by Phase 5E.
