# LE-001 Phase 5C — Reporting Learner Population Cutover

Status: **Development Verified — Canonical Primary with Legacy Fallback**

Runtime consumer: **RP-001 Teacher Reporting learner/class population only**

Selected control mode: **`CANONICAL_PRIMARY_LEGACY_FALLBACK`**

Database migration: **NONE**

Production: **UNTOUCHED**

## Authority boundary

RP-001 is a composite consumer. Phase 5C changes only its current learner
population, Class population, and canonical learner-key plumbing:

- `students.id` is the canonical Reporting learner key.
- `student_class_members.id` is the canonical current Class-membership
  authority.
- Assignment/submission metrics, `learning_events`, mastery/subject summaries,
  adaptive recommendations, class summary projections, and historical
  Profile-keyed records keep their existing compatibility authority.
- Student, Organization, Guardian/Parent reports and persisted historical
  records are not rewritten.

Before this package, Teacher Reporting selected its learner population from
`class_enrollments.student_id` and used that Profile/Account identifier to read
`student_subject_summary`. The Reporting API also returned that legacy ID in
student ranking rows. Phase 5C now resolves the scoped Class first, loads the
current population through the sealed Phase 5A roster source, and prevents raw
Profile learner IDs from crossing the API boundary.

Reporting is therefore **PARTIALLY CANONICAL**, not fully canonical.

## Canonical population and scope

The service resolves authenticated Account, active organization, active
membership, role, and the exact tenant-scoped Class before reading population.
It reuses the Phase 5A access decision and batched roster source:

1. one bounded `student_class_members` query for scoped Class IDs;
2. one bounded `students.id IN (...)` query for the minimal Student
   projection;
3. no per-Class or per-Student Profile, Account-link, or `auth.users` query.

Organization Owner/Admin may read within the active organization. Teacher may
read only an assigned active Class. Inactive membership, unassigned Teacher,
cross-tenant Class, and invalid scope fail closed before population queries.
Managed/accountless Students remain valid canonical population members.

Current reports include active Student memberships only. `left` memberships
are excluded. Owner/Admin can retain existing historical access to an archived
Class, but its current population is empty; Teacher access to an archived
Class remains denied.

## Metric compatibility and output

The pure compatibility adapter permits only this mapping:

`canonical Student → one effective active verified Account link → one active,
same-Class, same-tenant legacy enrollment → legacy metric reference`

Name, email, birthday, student number, school, and grade are never matching
inputs. Missing or ambiguous authority produces no metric reference. It does
not fabricate zero, create a Profile, or exclude the canonical learner from
population.

The current least-privilege Reporting runtime deliberately does not enumerate
`student_account_links`; no Teacher-safe scoped link source exists in the
sealed database contract. Canonical-only learners therefore receive correct
unavailable metric semantics (`studentRanking` omits unmapped metrics) until a
separately approved scoped mapping boundary exists. The pure adapter and parity
tests prove how future verified evidence can be consumed without heuristic
linking.

For verified compatibility input, ranking uses the legacy metric record
internally but returns `students.id` as both canonical learner reference and
Student ID. In `LEGACY_ONLY` rollback mode, the API returns an opaque
`legacy-metric-N` reference and `studentId: null`; raw Profile IDs are not
exposed. Existing metric definitions and historical rows are unchanged.

## Control, fallback, and rollback

`learner_reporting_canonical_population` supports:

1. `LEGACY_ONLY`
2. `LEGACY_PRIMARY_CANONICAL_SHADOW`
3. `CANONICAL_PRIMARY_LEGACY_FALLBACK`
4. `CANONICAL_ONLY`

Phase 5C selects canonical-primary with legacy fallback. A valid empty
canonical population is authoritative and does not fall back. Authorization,
RLS, tenant, identity, scope, and integrity failures remain fail closed. Only
`CANONICAL_RUNTIME_FAILURE` can use the legacy population. Sources are never
merged.

`LEARNER_REPORTING_POPULATION_AUTHORITY_MODE=LEGACY_ONLY` provides an immediate
no-write rollback. An unknown override resolves safely to legacy-only. Neither
cutover nor rollback changes database records.

Structured `[reporting-learner-authority]` events contain mode, tenant,
correlation, Class/population counts, mapping/unavailable counts, returned
authority, shadow error, and fallback state. They contain no learner ID, name,
Profile, Account, link, token, cookie, credential, or raw database error.

## Development evidence

The linked read-only check authenticated against `educrat-development`
(`gqurnljrvwyhruhutvni`) and reported current active Reporting population:

- canonical population: 0
- legacy population: 0
- matches: 0
- expected/unexpected canonical-only: 0 / 0
- legacy-only: 0
- identity unresolved: 0
- tenant mismatch: 0
- shadow errors: 0
- compatibility-mapped metrics: 0
- canonical learners without legacy metrics: 0
- fallback count: 0

The existing historical snapshot still contains two left canonical
memberships and no legacy enrollments; they are intentionally excluded from
the current-population metrics rather than treated as active learners.

Owner/Admin/Teacher scope, assigned/unassigned behavior, archived Class,
managed/accountless, active/left, fallback, rollback, canonical-only behavior,
tenant failure, immutable diagnostics, and no-PII output are covered by
deterministic tests. Development has no safe active roster fixture for the
Admin/assigned/unassigned Teacher matrix; those live role cases are **NOT
EXECUTED — FIXTURE UNAVAILABLE**. No persistent fixture or backfill was
created.

`CANONICAL_ONLY` remains closed until those live role gates and a stable scoped
metric compatibility boundary are verified.

## Remaining compatibility domains

- Assignment class expansion and recipient identity
- Submission self identity
- Learning Event learner authority
- Mastery and subject-summary projections
- Adaptive recommendation learner authority
- Historical Profile-keyed metric references
- Guardian and Parent Portal child authority

Phase 5D is not started.
