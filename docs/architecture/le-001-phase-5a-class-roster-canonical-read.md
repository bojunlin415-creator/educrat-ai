# LE-001 Phase 5A — Class Roster Canonical Read Cutover

Status: **Development Verified — Canonical Primary with Legacy Fallback**

Runtime consumer: **Class detail GET only**

Selected control mode: **`CANONICAL_PRIMARY_LEGACY_FALLBACK`**

Database migration: **NONE**

Production: **UNTOUCHED**

## Authority change

The Class detail roster previously read `class_enrollments`, where
`student_id` is a legacy Profile/Account identifier. Phase 5A changes only the
roster returned by `GET /api/classes/[classId]` to read canonical
`student_class_members` and canonical `students`.

`students.id` is now the roster learner identity for this consumer and
`student_class_members.id` is the roster membership identity. A Student does
not need an Auth Account, Profile, or Student Account Link to appear. No
Account/Profile identity is fabricated.

PATCH, archive, roster mutation, Class listing, Teacher Dashboard, Assignment,
Submission, Learning Events, Mastery, Adaptive, Reporting, Guardian, and Parent
Portal consumers remain unchanged.

## Least-privilege boundary

The server resolves authenticated actor, active organization, active
membership, and Class tenant before loading a roster. It never accepts a
client organization identifier.

- Organization Owner/Admin may read a Class in the active organization.
- Teacher may read only an active Class whose `teacher_id` equals the
  authenticated Account ID.
- Another Teacher's Class, an unassigned Class, a cross-tenant Class, an
  archived/inactive Class for Teacher, or an inactive membership fails closed.
- Owner/Admin may retain existing read visibility for archived Classes; this
  does not make the Class editable or assignable.

The product adapter exposes only Student ID, student number, name, optional
English name, grade, Student status, membership ID/status, joined time, and
left time. It does not query or serialize `auth.users`, `profiles`, Student
Account Links, birthday, gender, school, guardian data, credentials, or tokens.

The underlying general Student table policy remains an existing broader
organization-staff boundary. Phase 5A does not weaken it or claim it is the
canonical Teacher product rule. The Class detail adapter performs the stricter
assigned-Class check before its minimal canonical projection. A future,
separately authorized RLS hardening package remains responsible for general
Student table access.

## Status and query semantics

Only `student_class_members.status = active` is included. `left` is excluded
from the active roster; no legacy `inactive` state is silently mapped to
canonical active/left. An active membership whose Student is missing,
cross-tenant, or not active is an integrity failure and fails closed into the
approved fallback mode.

The canonical path performs one Class lookup, one bounded membership query,
and, when non-empty, one batched Student query. It never performs a per-Student
query. An empty canonical roster is a valid empty result and does not trigger
fallback.

## Control, fallback, and rollback

The Phase 5 control `learner_class_roster_canonical_read` supports the approved
equivalent modes:

1. `LEGACY_ONLY`
2. `LEGACY_PRIMARY_CANONICAL_SHADOW` (the approved canonical-shadow state)
3. `CANONICAL_PRIMARY_LEGACY_FALLBACK` (the approved canonical-primary-with-
   fallback state)
4. `CANONICAL_ONLY`

Phase 5A selects canonical-primary with legacy fallback. Fallback happens only
when the canonical source throws a genuine runtime/service failure. Count
difference or a valid empty canonical roster never triggers fallback, and the
two authorities are never merged. The safe structured
`[class-roster-authority]` event records technical IDs, counts, actor role,
mode, correlation, and `canonical_read_failure`; it contains no Student PII or
internal database error.

`LEARNER_CLASS_ROSTER_AUTHORITY_MODE=LEGACY_ONLY` is the immediate runtime
rollback. Invalid overrides fail safely to legacy-only. Changing the control
does not mutate learner or enrollment data.

## Managed/accountless parity

The read-only Development snapshot for `educrat-development`
(`gqurnljrvwyhruhutvni`) recorded:

| Metric                                     | Count |
| ------------------------------------------ | ----: |
| Canonical enrollment                       |     2 |
| Legacy enrollment                          |     0 |
| Expected canonical-only managed learner    |     2 |
| Unexpected canonical-only                  |     0 |
| Legacy-only                                |     0 |
| Identity conflict                          |     0 |
| Status mismatch                            |     0 |
| Tenant mismatch                            |     0 |
| Shadow error                               |     0 |
| Current active canonical roster membership |     0 |

For this roster consumer, a same-tenant canonical Student with a valid
canonical membership and no conflicting effective link may be an expected
managed/accountless learner. This exception does not apply to authenticated
self-access, Submission, Guardian, or Parent Portal consumers.

## Verification and remaining gate

Unit and architecture tests cover Owner/Admin, assigned Teacher, unassigned
Teacher, inactive Teacher membership, cross-tenant Class, archived Class,
active/left semantics, empty/multiple/accountless records, parity conflicts,
all control modes, genuine-error fallback, canonical-only fail-closed behavior,
rollback, immutable results, bounded queries, and forbidden identity/PII
sources.

Development browser/API verification covers anonymous denial, real Owner
same-tenant Class detail, minimal roster response, archived Class read
semantics, and a second-tenant 404. Development has no safely reusable Admin or
assigned/unassigned Teacher fixture, so those live cases are **NOT EXECUTED —
FIXTURE UNAVAILABLE**; their deterministic service/security tests pass.

Because the full live Admin and assigned/unassigned Teacher gate is not
available, `CANONICAL_ONLY` remains blocked. The selected primary-with-fallback
mode is reversible and does not authorize Phase 5B.

## Database and migration

No table, column, index, constraint, RLS policy, grant, function, trigger,
backfill, or Migration changed. Existing local and linked Development migration
history must remain synchronized. Production was not queried or modified.

## Remaining legacy consumers

The following retain legacy authority until their own package passes parity,
security, fallback, and rollback gates: Class mutations and legacy enrollment
write compatibility, Teacher Dashboard, Assignment expansion and recipients,
Submission self-resolution, Learning Events, Mastery/Subject projections,
Adaptive Recommendations, Reporting, Guardian verification, and Parent Portal.

Phase 5B is not started.
