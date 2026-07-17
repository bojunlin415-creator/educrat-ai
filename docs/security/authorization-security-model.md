# AP-003B Authorization Security Model

Status: **Proposed — Awaiting Architecture Approval**

This document defines the security boundary for the proposed authorization architecture. It does not implement middleware, sessions, tokens, RLS, APIs, or runtime policy evaluation.

## Trust boundaries

| Layer                 | Trusted responsibility                                               | Explicitly untrusted input                                             |
| --------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| UI                    | Present available actions and explain denial states                  | Hidden buttons, claimed role, active organization, resource ownership  |
| API / Server Action   | Authenticate, validate DTO, request canonical policy decision        | Client-provided actor, role, persona, scope, organization, entitlement |
| Policy Decision Point | Resolve assignments, scope, conditions, and obligations              | Cached client claims and incomplete relationship hints                 |
| Domain Service        | Revalidate lifecycle, ownership, dependency, and business invariants | An earlier `ALLOW` as permission to violate domain invariants          |
| Database / RLS        | Enforce final tenant and row boundary with minimum grants            | UI/API filtering as proof of isolation                                 |
| Audit                 | Record governed decisions and high-risk outcomes                     | Secrets, credentials, full sensitive payloads, unrestricted PII        |

## Mandatory principles

1. **Least privilege** — grant only the atomic permissions and scope needed for the task.
2. **Default deny** — missing identity, assignment, scope, relationship, policy, or resource evidence results in denial.
3. **Explicit grant** — no access is inferred from job title, display label, profile, e-mail domain, or paid plan.
4. **No implicit owner** — being a creator, organization owner, or platform operator does not bypass resource, lifecycle, or approval rules.
5. **Scope and organization isolation** — a permission without a valid effective scope grants nothing; cross-tenant access requires governed `CASE` access.
6. **Auditability** — high-risk allows, denials at security thresholds, assignment changes, delegation, and emergency use produce an audit obligation.
7. **Immediate revocation** — suspended accounts, removed memberships, revoked assignments, expired grants, or closed cases stop authorizing new requests.
8. **Temporary by design** — delegation, elevated access, case access, and emergency access require bounded capabilities and expiry.
9. **Separation of duties** — a requester cannot self-approve high-risk role mutation, ownership override, irreversible deletion, retention release, audit export, or protected publishing.
10. **AI is constrained execution** — AI operates only through allowlisted tools under a human/workflow authorization context; it is never an administrator or session holder.

## Decision precedence

The following conditions override a matching role permission:

- invalid or expired session;
- suspended, archived, anonymized, or deleted account state where policy denies operation;
- inactive membership or persona;
- tenant mismatch or absent relationship evidence;
- expired delegation, case grant, or re-authentication receipt;
- unavailable entitlement, except required data-access/export obligations;
- resource lifecycle state that forbids the action;
- dependency, retention, or legal hold;
- last-owner protection;
- separation-of-duties conflict;
- missing mandatory approval or audit capability.

Conflicting explicit policies resolve to the more restrictive decision. A conflict that cannot be deterministically resolved returns `DENY` with a policy-conflict reason and security telemetry; it never falls back to a role label.

## Delegation and temporary permission

- Delegation is an assignment derived from a delegator's currently effective capabilities; it cannot exceed or outlive them.
- Delegation specifies permission allowlist, scope, purpose, issuer, recipient, start, expiry, and revocation state.
- Owner, platform-role, permanent-deletion, retention-release, break-glass review, and credential-management powers are non-delegable by default.
- Suspension or revocation of the source assignment invalidates derived delegations.
- A temporary permission does not mutate the recipient's permanent role.

## Re-authentication and session freshness

Risk bands remain policy data rather than UI constants:

| Level | Example                                                 | Minimum architecture response                                                             |
| ----- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 0     | ordinary authorized read                                | valid session                                                                             |
| 1     | ordinary content edit                                   | valid session and current membership                                                      |
| 2     | role change, member suspension, export                  | scoped fresh-auth receipt and reason where required                                       |
| 3     | ownership transfer, deletion request, case access       | fresh authentication, explicit confirmation, audit, possible approval                     |
| 4     | platform-role mutation, permanent deletion, break glass | strongest available re-authentication, dual approval, time-bound receipt, immutable audit |

A receipt is bound to Account/Person, action family, target scope/resource, policy version, issue time, expiry, correlation ID, and replay protection. Password and OAuth accounts use provider-appropriate re-authentication; MFA remains a future hook.

## Case-scoped and emergency access

Platform Support has no standing all-organizations permission. A `CASE` grant requires a real case, approved capability and resource allowlists, tenant, reason, masking policy, start/expiry, approver, and audit correlation ID. Every use is auditable.

Break glass is separate from normal case access:

- only for a defined emergency category;
- narrowly scoped and short lived;
- reason and re-authentication required;
- cannot silently disable RLS or become a reusable token;
- triggers immediate alert and mandatory post-event review;
- cannot erase or approve its own audit record.

Production break-glass access remains blocked until AP-002B immutable audit and AP-004 event/job/notification foundations are implemented and independently tested.

## Service Principal and AI boundaries

- A Service Principal is a non-human subject with one purpose, explicit workload role, resource allowlist, credential lifecycle, scope, and audit identity.
- It cannot inherit a Person, Persona, Membership, or Platform Admin role.
- Human accounts cannot be reused as background workers.
- AI Assistant, AI Reviewer, and AI Generator are policy-constrained execution profiles, not Service Principals or authorization subjects.
- A tool invocation carries the initiating subject or workflow authorization receipt; the AI cannot manufacture, broaden, transfer, or persist that authority.
- AI cannot receive publisher identity, secret material, unrestricted student records, role mutation, audit export, approval, protected publishing, or irreversible lifecycle permissions.

## Entitlement boundary

Entitlement answers whether a purchased plan offers a feature. Authorization answers whether this subject can perform this action in this scope. A final allow requires both where applicable, plus lifecycle and policy conditions. Payment never grants administration, and loss of entitlement never authorizes deletion or prevents policy-required export/access.

## Security validation required before implementation

- permission catalog integrity and typo rejection;
- role-to-permission snapshot and version tests;
- scope traversal and cross-tenant negative tests;
- inactive account/membership/persona and expired-grant tests;
- RLS tests independent of API/UI decisions;
- last-owner and separation-of-duties tests;
- re-auth receipt binding and replay tests;
- JIT case masking and expiry tests;
- Service Principal credential and workload-scope tests;
- decision/audit correlation without sensitive-payload leakage.
