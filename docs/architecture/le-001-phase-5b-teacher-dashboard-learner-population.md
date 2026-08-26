# LE-001 Phase 5B — Teacher Dashboard Learner Population Cutover

Status: **Development Verified — Canonical Primary with Legacy Fallback**

Runtime consumer: **Teacher Dashboard class learner population only**

Selected control mode: **`CANONICAL_PRIMARY_LEGACY_FALLBACK`**

Database migration: **NONE**

Production: **UNTOUCHED**

## Authority change

Before Phase 5B, Teacher Dashboard assembled each Class learner population by
calling the Class detail service, which read Profile-backed
`class_enrollments`. It also used those Profile identifiers to load legacy
report metrics. Phase 5B separates these concerns:

- Current learner population and per-Class learner counts now come from
  canonical `student_class_members` and `students`.
- Assignment, submission, learning event, mastery, adaptive, reporting, and
  alert metrics remain on their existing compatibility authority.
- Legacy Profile identifiers used internally for compatible metric reads are
  replaced with opaque `metricReference` values before any browser response.

The Dashboard is therefore **partially canonical**, not fully canonical.

## Scoped canonical population

The server first resolves the authenticated Account, active organization,
active membership, role, and active scoped Classes. The population adapter
revalidates every Class before querying a roster:

- Organization Owner/Admin may read active Classes in the active organization.
- Teacher may read only assigned active Classes.
- Suspended membership, unassigned Class, inactive/archived Teacher Class, and
  cross-tenant Class fail closed before a roster query.

The adapter reuses the Phase 5A roster source instead of defining another
Student authority. Multiple scoped Class IDs are loaded with one bounded
`student_class_members` query and one bounded `students` query. It performs no
per-Class, per-Student, Profile, Account-link, or `auth.users` lookup.

Only active canonical memberships and active canonical Students are included.
Left memberships are excluded. A valid managed/accountless Student remains in
the population without an Account, Profile, or Student Account Link.

## Safe response boundary

The learner-population response is restricted to Class ID, canonical Student
ID, canonical membership ID, statuses, and the display name required by the
existing Dashboard. It does not expose birthday, gender, school, guardian
data, Account ID, Account-link ID, raw Profile record, credentials, authority
mode, or parity diagnostics.

If the canonical source has a genuine runtime/service failure, the approved
legacy fallback projection masks the legacy Profile learner ID and display
name. Legacy metric reads remain internal and emit only opaque metric
references.

## Control, fallback, and rollback

The dedicated control is
`learner_teacher_dashboard_canonical_population`. It supports:

1. `LEGACY_ONLY`
2. `LEGACY_PRIMARY_CANONICAL_SHADOW`
3. `CANONICAL_PRIMARY_LEGACY_FALLBACK`
4. `CANONICAL_ONLY`

Phase 5B selects canonical-primary with legacy fallback. A valid empty
canonical population is authoritative and never falls back. RLS denial,
authorization denial, tenant mismatch, invalid Class, and canonical integrity
failure fail closed. Only `CANONICAL_RUNTIME_FAILURE` can trigger fallback.
The two populations are never merged.

`LEARNER_TEACHER_DASHBOARD_POPULATION_AUTHORITY_MODE=LEGACY_ONLY` is the
immediate no-write rollback. An invalid operational override fails safely to
legacy-only. Neither cutover nor rollback rewrites learner data.

Structured `[teacher-dashboard-learner-authority]` observations contain mode,
organization, correlation, Class and population counts, returned authority,
shadow error count, and fallback state. They contain no Student name, Account
data, token, cookie, credential, or database error.

## Metric compatibility

Current class accuracy, student performance, weak knowledge, assignment,
submission, learning trend, mastery, adaptive recommendation, and alert
metrics still depend on legacy reporting/analytics contracts. Phase 5B does
not join them to canonical Students by name, email, student number, birthday,
school, or grade. Canonical learners without an authoritative compatibility
mapping appear in roster population/counts without fabricated analytics.

## Query and security verification

Deterministic tests cover all four modes, runtime-only fallback, valid empty
population, canonical integrity fail-closed behavior, rollback, immutable
results/events, assigned/unassigned Teacher scope, suspended membership,
Owner/Admin scope, cross-tenant rejection, archived Class semantics,
managed/accountless Student inclusion, masked legacy fallback, no PII logs,
and batched multi-Class reads.

Linked Development (`educrat-development`, project ref
`gqurnljrvwyhruhutvni`) read-only evidence recorded 9 canonical Students, 2
canonical enrollments, 0 legacy enrollments, 0 matches, 2 expected
managed/accountless canonical-only memberships, 2 identity-unresolved
compatibility references, 0 tenant mismatch, 0 shadow errors, and 0 current
active roster memberships. The historical canonical-only rows do not require
a Profile for current roster authority, but they remain unresolved for legacy
metric identity.

Real Development browser/API verification passed anonymous denial, Owner
same-tenant Dashboard load, safe canonical response, rendered Teacher
Dashboard, and second-tenant denial. The package created no persistent fixture
and cleanup count is 0. Development has no safely reusable Organization Admin
or assigned/unassigned Teacher fixture, so those live cases are **NOT EXECUTED
— FIXTURE UNAVAILABLE**; deterministic least-privilege tests pass.

`CANONICAL_ONLY` remains gated until the unavailable role fixtures and stable
runtime behavior are verified. Phase 5B does not introduce a migration or
weaken RLS.

## Remaining legacy Dashboard subdomains

- Assignment population
- Submission population
- Learning Events and timeline
- Mastery and subject summary
- Adaptive recommendations
- Reporting metrics
- Alerts/insights derived from compatibility analytics
- Guardian and Parent Portal

Phase 5C is not started.
