# LE-001 Phase 5D — Assignment Class Expansion Cutover

Status: **Development Verified — Canonical Primary with Legacy Fallback**

Runtime consumer: **Assignment Class-target learner expansion only**

Selected control mode: **`CANONICAL_PRIMARY_LEGACY_FALLBACK`**

Database migration: **NONE**

Production: **UNTOUCHED**

## Authority boundary

Phase 5D changes only the population expanded when an Assignment targets one
or more Classes:

`authorized Class IDs → student_class_members → students`

The result uses `students.id` as the canonical candidate identity and
`student_class_members.id` as membership evidence. The following authorities
remain unchanged:

- `assignment_students.student_id` still means the legacy Profile/Account
  recipient identifier;
- Submission eligibility and ownership remain Profile/Account keyed;
- Assignment analytics, Reporting assignment metrics, and historical
  recipient rows remain legacy/compatibility data;
- there is no dual-write, legacy freeze, recipient rewrite, or historical
  backfill.

Assignment is therefore **PARTIALLY CANONICAL**, not fully canonical.

## Previous and current query path

Previously, `assignClasses()` validated Classes, inserted
`assignment_classes`, queried active `class_enrollments.student_id`, and wrote
those Profile identifiers directly to `assignment_students`.

Phase 5D performs the expansion before Assignment or target persistence:

1. resolve authenticated Teacher/Owner/Admin and active Organization using the
   existing Assignment service boundary;
2. query all requested active Classes in one tenant-scoped batch;
3. deny missing, inactive, archived, cross-tenant, or unassigned-Teacher
   Classes before reading learners;
4. reuse the sealed Phase 5A roster source for one batched
   `student_class_members` read and one batched `students` read;
5. deduplicate by canonical Student while preserving Class and membership
   origin IDs;
6. evaluate the legacy recipient compatibility boundary;
7. persist `assignment_classes` and legacy recipients only when the current
   recipient table can represent every candidate safely.

The service no longer reads `class_enrollments` directly. Legacy expansion is
encapsulated only in the reversible authority adapter.

## Managed/accountless learners and materialization

A valid active canonical Student is retained as an expansion candidate even
without an Auth Account, Profile, or Student Account Link. No Profile or
Account identifier is fabricated and no candidate is removed from the
expansion result merely because the legacy recipient table cannot represent
it.

The current least-privilege runtime does not enumerate
`student_account_links`. There is no Teacher-safe, candidate-scoped verified
mapping contract in the sealed database. Consequently, any non-empty
canonical expansion without a verified compatibility result stops before an
Assignment, `assignment_classes`, or `assignment_students` write and returns
the typed domain outcome `recipient_identity_unavailable` (HTTP 409). This is
an expected Phase 5D compatibility limitation, not a generic 500.

The API message is safe and does not disclose Student identity, link state,
database errors, or tenant data. Phase 5E must provide the separately approved
recipient authority before accountless candidates can be materialized.

## Status, deduplication, and privacy

- Only active Classes, active `student_class_members`, and active Students are
  candidates.
- `left` canonical memberships and inactive/left legacy enrollments are
  excluded from current population. Historical mismatches remain diagnostic
  evidence only.
- A Student in multiple targeted Classes appears once as a recipient
  candidate, with immutable sorted Class and membership origin IDs.
- The expansion projection contains only tenant, Class, membership, canonical
  Student, source, and internal compatibility reference IDs.
- It does not expose name, birthday, guardian data, Profile, Account link,
  `auth.users`, token, session, or auth metadata.

## Control, fallback, and rollback

`learner_assignment_canonical_expansion` supports and independently tests:

1. `LEGACY_ONLY`
2. `LEGACY_PRIMARY_CANONICAL_SHADOW`
3. `CANONICAL_PRIMARY_LEGACY_FALLBACK`
4. `CANONICAL_ONLY`

Phase 5D selects canonical-primary with legacy fallback. A valid empty
canonical population is authoritative and does not fall back. Only a typed
canonical runtime/service failure may replace authority with the legacy
source. Authorization, RLS, tenant, Class lifecycle, integrity, status, and
identity failures do not fall back, and sources are never merged.

`LEARNER_ASSIGNMENT_CLASS_EXPANSION_AUTHORITY_MODE=LEGACY_ONLY` is the
immediate no-write rollback. Unknown values fail safely to legacy-only.
Rollback does not rewrite recipients, learners, assignments, or history.

Structured `[assignment-class-expansion-authority]` events include mode,
tenant, correlation, optional Assignment ID, Class/candidate/mapping/unresolved
counts, returned authority, fallback, and shadow error. They contain no PII or
credential data.

## Development evidence

The linked read-only test authenticated against `educrat-development`
(`gqurnljrvwyhruhutvni`) and found two historical canonical Class memberships,
both `left`. Current active Assignment expansion evidence is therefore:

- canonical candidates: 0
- legacy candidates: 0
- matches: 0
- expected/unexpected canonical-only: 0 / 0
- legacy-only: 0
- identity unresolved: 0
- compatibility mapped: 0
- status mismatch: 0
- tenant mismatch: 0
- shadow errors: 0
- fallback count: 0

Deterministic tests cover Owner/Admin, assigned/unassigned Teacher,
cross-tenant/archived/inactive Classes, active/left membership, zero/one/many
learners, managed/accountless candidates, canonical-only and mapped learners,
legacy-only compatibility, duplicate prevention, all four modes, fallback,
rollback, privacy, API error mapping, and architecture boundaries.

Development has no safe active Assignment/roster fixture for live Owner/Admin,
assigned/unassigned Teacher, cross-tenant, or managed/accountless mutation
flows. Those live mutation cases are **NOT EXECUTED — FIXTURE UNAVAILABLE**;
no fixture, Account link, Assignment recipient, or learner record was created.
For this reason `CANONICAL_ONLY` remains closed.

## Remaining Assignment convergence

- Phase 5E: `assignment_students` canonical recipient authority
- Phase 5F: Submission self-resolution and ownership
- later packages: Learning Event, mastery, adaptive, Reporting assignment
  metrics, Guardian/Parent, and historical Profile-keyed reference convergence

Phase 5E is not started.
