# LE-001 Phase 4 — Shadow Dual-Read & Consumer Parity

Status: **Development Verified — Package Seal Baseline**

Runtime authority: **LEGACY UNCHANGED**

Database migration: **NONE**

Production: **UNTOUCHED**

## Purpose and non-cutover boundary

Phase 4 compares the existing Profile-backed learner and `class_enrollments`
authority with the future `students` and `student_class_members` authority. It
measures consumer-specific parity only. It does not change responses, ownership,
authorization, writes, or historical learner identifiers.

The following remain explicitly not started:

- dual-write;
- consumer authority cutover;
- legacy-write freeze;
- historical ID rewrite;
- legacy table deletion;
- automatic Student–Account linking;
- Production rollout.

## Architecture

`lib/learner-convergence/shadow/` contains one shared comparison layer:

- `domain.ts` defines the ten consumers, parity states, aggregate metrics,
  readiness states, scopes, and immutable results;
- `analyze.ts` validates the `le-001.v1` snapshot, resolves only effective
  verified links, compares identity/enrollment references, and produces the
  immutable `le-001.shadow.v1` result;
- `interfaces.ts` isolates the snapshot source and diagnostic sink;
- `run.ts` provides the fail-safe observation boundary and proves legacy
  results are preserved even when diagnostics fail;
- `server.ts` provides the server-only batched Supabase snapshot adapter,
  application control, sanitized aggregate logging, and Development operator
  report loader.

Dependency direction remains framework-neutral in the domain/analyzer boundary.
Only the server adapter imports Supabase and organization context services.

## Feature control and runtime safety

`LEARNER_CONVERGENCE_SHADOW_READ` defaults to `disabled`. Only `1`, `true`, or
`enabled` opts in. Disabled mode performs no membership lookup and no snapshot
query. Enabling the flag never changes legacy authority.

Each instrumented request performs at most one call to the existing
`get_learner_convergence_snapshot()` RPC. Comparison is in-memory and batched;
there is no per-Student query. Unexpected snapshot, validation, or comparison
errors become sanitized `[learner-shadow]` diagnostics and an error metric;
they do not replace a successful legacy response.

The existing RPC remains Owner/Admin-only. Teacher, Student, and Guardian
sessions are not granted broader Account-link visibility. Until a separately
approved least-privilege consumer-scoped snapshot adapter exists, those sessions
can only produce a safe shadow failure when the flag is enabled. This is an
observability readiness limitation, not permission to weaken RLS or expose
`auth.users`.

## Parity and readiness contract

Parity states include `PARITY_MATCH`, `LEGACY_ONLY`, `CANONICAL_ONLY`,
`IDENTITY_UNRESOLVED`, `AMBIGUOUS_IDENTITY`, `TENANT_MISMATCH`,
`STATUS_MISMATCH`, `MISSING_REFERENCE`, `UNSUPPORTED_LEGACY_STATE`, and
`ORPHAN_REFERENCE`.

Every consumer exposes all counts independently:

- total legacy/canonical references;
- parity matches;
- legacy-only/canonical-only;
- unresolved/ambiguous identity;
- status/tenant mismatch;
- orphan reference;
- shadow error count;
- parity rate.

`PARITY_READY` requires zero security, identity, status, orphan, data, and
shadow-error blockers. A percentage alone can never make a consumer ready.
`NO_DATA` is `NOT_READY`, not a successful parity result.

## Consumer integration order

Instrumentation follows the approved order and keeps the existing response as
authority:

1. Class read/detail: class-scoped legacy/canonical roster comparison.
2. Teacher Dashboard: scoped roster plus assignment learner references.
3. Assignment class expansion: compare after reading legacy enrollments, before
   materializing the unchanged legacy recipient IDs.
4. Assignment recipients: assignment-scoped Profile learner references.
5. Submission self-resolution: Account ID versus verified Student link.
6. Learning Events: immutable historical Profile learner reference comparison.
7. Mastery/subject projections: learner ownership comparison only; no rebuild.
8. Adaptive recommendations: learner reference comparison only; no output
   change.
9. Reporting: learner population and class membership comparison only.
10. Guardian/Parent Portal: compare only after existing guardian authorization
    succeeds and only for the authorized child scope.

## Development parity matrix

The opt-in live test used the publishable key and existing authenticated E2E
Owner/Admin account. It did not use Service Role and made no data mutation.

| Consumer                      | Legacy | Canonical | Match | Legacy only | Canonical only | Unresolved | Tenant | Status | Shadow error | Readiness           |
| ----------------------------- | -----: | --------: | ----: | ----------: | -------------: | ---------: | -----: | -----: | -----------: | ------------------- |
| Class read/detail             |      0 |         2 |     0 |           0 |              2 |          2 |      0 |      0 |            0 | BLOCKED_IDENTITY    |
| Teacher Dashboard             |      0 |         2 |     0 |           0 |              2 |          2 |      0 |      0 |            0 | BLOCKED_IDENTITY    |
| Assignment class expansion    |      0 |         0 |     0 |           0 |              0 |          0 |      0 |      0 |            0 | NOT_READY / NO_DATA |
| Assignment recipients         |      0 |         0 |     0 |           0 |              0 |          0 |      0 |      0 |            0 | NOT_READY / NO_DATA |
| Submission self-resolution    |      0 |         0 |     0 |           0 |              0 |          0 |      0 |      0 |            0 | NOT_READY / NO_DATA |
| Learning Events               |      0 |         0 |     0 |           0 |              0 |          0 |      0 |      0 |            0 | NOT_READY / NO_DATA |
| Mastery / subject projections |      0 |         0 |     0 |           0 |              0 |          0 |      0 |      0 |            0 | NOT_READY / NO_DATA |
| Adaptive recommendations      |      0 |         0 |     0 |           0 |              0 |          0 |      0 |      0 |            0 | NOT_READY / NO_DATA |
| Reporting                     |      0 |         2 |     0 |           0 |              2 |          2 |      0 |      0 |            0 | BLOCKED_IDENTITY    |
| Guardian / Parent Portal      |      0 |         0 |     0 |           0 |              0 |          0 |      0 |      0 |            0 | NOT_READY / NO_DATA |

The baseline remains eight canonical Students, zero active verified Account
links, zero legacy enrollments, and two canonical enrollments. The red states
are expected evidence, not bugs to hide or data to fabricate.

## Security and privacy

- Organization scope comes from the authenticated server context and the
  trusted snapshot RPC, never a client-supplied organization ID.
- No Service Role, `auth.users` query, token, cookie, JWT, email, birthday,
  guardian PII, or full Student row enters diagnostics.
- Logs contain IDs, consumer, organization, correlation, reason, readiness, and
  aggregate counts only. Matching records are not logged one by one.
- Guardian comparison is scoped to a child that already passed the current
  guardian authorization. It does not auto-link a Student or disclose Account
  link details.
- Shadow output never participates in current authorization or customer-facing
  decisions.

## Testing and future gate

Tests cover parity match, legacy-only, canonical-only, unresolved and ambiguous
identity, status and tenant mismatches, orphan references, readiness, explicit
empty scope, feature disablement, one batched snapshot call, safe failure,
response preservation, privacy-safe logs, integration points, import boundary,
and circular dependency.

Phase 5 must be a separate architecture decision based on these results. No
consumer is authorized to cut over in Phase 4. Identity links, real legacy data,
and least-privilege consumer-scoped shadow access must be proven before any
authority switch.
