# LE-001 Phase 3 — Controlled Backfill & Enrollment Parity

Status: **LE-001 Phase 3 — DEVELOPMENT VERIFIED AND PACKAGE SEALED**

Baseline: LE-001 Phase 1–2 commit `f990651732de1aaadcdef28bb1272831a442ae71`

## Scope and authority

Phase 3 adds server/operator-only, framework-neutral planning and execution contracts for deterministic Account–Student link backfill and legacy-to-canonical enrollment parity. It does not expose a browser API, change runtime authority, start dual-read/dual-write, or cut over Assignment, Submission, Analytics, Reporting, Teacher Dashboard, Guardian, or Parent Portal consumers.

The authority direction remains:

```text
Account / Profile compatibility identity
  --explicit verified evidence only-->
students.id

class_enrollments
  --deterministic legacy-to-canonical backfill only-->
student_class_members
```

Canonical rows are never fabricated back into legacy Profile enrollment. Existing legacy history is not removed or overwritten.

## Candidate evidence and classification

`classifyLearnerCandidate()` accepts only repository-owned relationship evidence:

- verified operator selection;
- trusted existing mapping;
- verified Account claim;
- trusted Membership relationship whose learner identity was already established;
- another repository identity reference;
- explicit managed-accountless marker.

It intentionally has no Email, name, birthday, school, grade, or student-number fields. Unknown fields fail strict validation. Every candidate receives exactly one classification:

- `DETERMINISTIC_VERIFIED`
- `MANAGED_ACCOUNTLESS`
- `AMBIGUOUS`
- `NO_VALID_CANDIDATE`
- `CROSS_TENANT_INVALID`

`analyzeBackfillCandidates()` also rejects duplicate correlation IDs and detects one Account claiming multiple Students, or one Student receiving multiple Account candidates, within a tenant. Cross-organization use of the same Account remains valid when each organization has independent authoritative evidence.

## Dry-run and execution

The immutable plan is the dry-run artifact. It includes only canonical Student ID, candidate Account ID when present, organization ID, classification, machine-readable reason, proposed action, and correlation ID. No PII is required.

`executeVerifiedLearnerBackfill()`:

1. refuses an unsafe plan;
2. processes only `DETERMINISTIC_VERIFIED` rows;
3. performs one candidate at a time;
4. returns idempotent success for an exact active link;
5. returns `active_link_conflict` without revoking/replacing a conflicting link;
6. requires `migration_verified` provenance and a matching immutable audit correlation receipt.

Persistence remains an injected operator gateway. There is no public API or generic database bypass. A future concrete gateway must use a separately reviewed trusted database mutation boundary; it must not grant a browser caller the ability to assert migration provenance.

## Enrollment parity

`analyzeEnrollmentParity()` classifies every resolvable relation as:

- `PARITY_MATCH`
- `LEGACY_ONLY`
- `CANONICAL_ONLY`
- `STATUS_MISMATCH`
- `TENANT_MISMATCH`
- `IDENTITY_UNRESOLVED`

Only `active → active` and `left → left` are deterministic. Legacy `inactive` always produces `STATUS_MISMATCH`. `executeDeterministicEnrollmentBackfill()` processes only `LEGACY_ONLY` rows with an authoritative learner link, same organization/class, deterministic status, and no canonical conflict. It preserves the supplied legacy timestamp, source ID, and correlation ID at the gateway boundary and is idempotent on rerun.

## Development Phase 3A evidence

Linked target was positively identified as `educrat-development` / `gqurnljrvwyhruhutvni`. The authenticated Owner-scoped snapshot contained:

| Metric                                                 | Initial value |
| ------------------------------------------------------ | ------------: |
| Canonical Students                                     |             8 |
| Canonical Enrollments                                  |             2 |
| Eligible Profile Students                              |             0 |
| Account Links                                          |             0 |
| Legacy Enrollments                                     |             0 |
| Assignment/Submission/Learning/Guardian legacy records |             0 |
| Cross-tenant identity mismatches                       |             0 |

The sole active organization membership is the Organization Owner that created the controlled Sprint 8 roster fixtures. Roster audit proves only the actor who performed the operation; it does not prove that the actor is the Student. There is no student-role Membership, verified claim, existing mapping, link, or managed-accountless marker.

Therefore all eight Students are `NO_VALID_CANDIDATE`; none are deterministic, ambiguous, explicitly managed-accountless, or cross-tenant-invalid. No Development Account link was written.

The two canonical-only memberships are both `left` and have no authoritative learner identity. Both are classified `IDENTITY_UNRESOLVED` with canonical-only review `identity_unresolved`. No legacy Profile enrollment was fabricated and no canonical enrollment was written.

## Current Development review IDs

All rows belong to organization `d22648de-6785-45e2-89cc-dd5fdfa1c2a6`.

| Canonical Student ID                   | Classification       | Account ID |
| -------------------------------------- | -------------------- | ---------- |
| `6d387fce-d809-4691-9f5b-06af70b8f458` | `NO_VALID_CANDIDATE` | none       |
| `7d2c3578-75db-486e-b17c-88e617a0159a` | `NO_VALID_CANDIDATE` | none       |
| `830c56f9-052c-4d8f-ad7b-2abb8ff32bc9` | `NO_VALID_CANDIDATE` | none       |
| `aa313f8d-ca69-4b0c-9ce9-a107c740843f` | `NO_VALID_CANDIDATE` | none       |
| `b1bc7477-4808-43f1-95e7-9f31e56cbb49` | `NO_VALID_CANDIDATE` | none       |
| `c75d2964-60c6-43e5-b408-36dcecb91a90` | `NO_VALID_CANDIDATE` | none       |
| `e2b2b033-0d49-4763-82e7-952424a5647b` | `NO_VALID_CANDIDATE` | none       |
| `f9a68661-10e3-4bb7-bed9-f3729f292b32` | `NO_VALID_CANDIDATE` | none       |

Canonical-only memberships reviewed:

- `546f26d2-d423-4599-90e2-1f90c442fdbe` — `IDENTITY_UNRESOLVED`
- `f4864b95-8069-4c41-8c92-2d77cf25e0a4` — `IDENTITY_UNRESOLVED`

## Security and release gates

- no Service Role, fake Auth Account, PII matching, client organization authority, or verification self-assertion;
- no historical migration modification and no Phase 3 data migration;
- existing ENABLE/FORCE RLS, tenant constraints, audit history, and self resolver remain unchanged;
- a cross-tenant candidate, duplicate authority, receipt mismatch, unknown field, or provider anomaly fails closed;
- Production is neither queried nor modified.

## Final release metrics

| Metric                           | Final value |
| -------------------------------- | ----------: |
| Canonical Students               |           8 |
| Verified Account Links           |           0 |
| Managed Accountless Students     |           0 |
| Unresolved Missing Links         |           8 |
| Ambiguous Links                  |           0 |
| No-valid-candidate Links         |           8 |
| Cross-Tenant Identity Mismatches |           0 |
| Legacy Active Enrollments        |           0 |
| Canonical Active Enrollments     |           0 |
| Legacy-Only Enrollments          |           0 |
| Canonical-Only Enrollments       |           2 |
| Status Mismatches                |           0 |
| Tenant Mismatches                |           0 |
| Enrollment Parity Rate           |           0 |
| Backfilled Links                 |           0 |
| Backfilled Enrollments           |           0 |
| Backfill Conflicts               |           0 |
| Dual-write Failures              |           0 |

## Deferred

- Consumer authority: **UNCHANGED**
- Shadow dual-read: **NOT STARTED**
- Dual-write: **NOT STARTED**
- Legacy freeze: **NOT STARTED**
- Destructive cleanup: **NOT AUTHORIZED**
- LE-001 Phase 4: not started
