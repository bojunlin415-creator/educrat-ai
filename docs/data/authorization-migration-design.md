# AP-003B Authorization Migration Design

Status: **Proposed — Awaiting Architecture Approval**

This is a future additive migration design. AP-003B creates no migration, table, enum, RLS policy, RPC, grant, API, or production behavior.

## Decision summary

Use a **versioned hybrid model**:

- permission keys and their semantic metadata have a reviewed source-of-truth catalog in code/build artifacts in a future implementation;
- published permission catalog versions and hashes are recorded in the database for assignments and audit reproducibility;
- role definitions, role-permission mappings, assignments, delegations, and conditional grants are database data protected by RLS and controlled RPCs;
- baseline system-role templates are immutable/versioned; future enterprise custom roles may reference only supported permission keys and eligible scopes.

| Option                            | Strength                                                        | Weakness                                                      | Decision                   |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------- |
| All roles and permissions in DB   | Dynamic, SQL-visible                                            | Typo/semantic drift, unsafe live edits, difficult code review | Rejected as sole authority |
| Roles in DB, catalog only in code | Simple catalog governance                                       | Weak historical reproducibility and assignment-version audit  | Insufficient alone         |
| Versioned hybrid                  | Reviewed keys, SQL evaluation, custom roles, reproducible audit | More rollout discipline                                       | Recommended                |

## Candidate entities

Names are proposals and are not approved schema until the implementation package reviews them.

| Candidate                     | Purpose                                                                       | Key controls                                                           |
| ----------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `permission_catalog_versions` | Immutable published catalog version, digest, effective time                   | append-only, unique version/digest                                     |
| `permissions`                 | SQL-visible supported keys tied to catalog version                            | unique key/version, immutable semantics                                |
| `roles`                       | Platform, organization, academic, family, workload, or custom role definition | scope class, owner org where custom, system-template flag              |
| `role_versions`               | Immutable role-template/custom-role revisions                                 | effective interval and catalog version                                 |
| `role_permissions`            | Permission allowlist for a role version                                       | no wildcard; eligible-scope constraint                                 |
| `role_assignments`            | Time-bounded role assignment to an authorized subject and context             | subject type, org/scope, status, valid interval, assignment provenance |
| `delegations`                 | Derived bounded capabilities                                                  | source assignment, subset constraint, expiry                           |
| `platform_role_assignments`   | Isolated high-risk platform assignment                                        | approval reference, separation of duties, expiry where applicable      |
| `case_access_grants`          | JIT support/security case access                                              | case, resource/capability allowlist, masking, expiry                   |
| `reauth_receipts`             | Scoped session-freshness proof                                                | hashed/opaque reference, replay protection, short retention            |
| `policy_versions`             | Published evaluation-policy metadata                                          | immutable version, effective time, digest                              |
| `approval_requests`           | Conditional approval / dual-control record                                    | requester/approver Person conflict checks                              |

Person, Persona, and Service Principal entities remain governed by AP-003A and future identity implementation packages. AP-003B does not finalize those tables.

## Proposed constraints and indexes

- permission key format constraint for the approved `resource.action` format; adapters expose the public two-segment key while domain ownership remains metadata;
- unique active system role code per role namespace;
- unique immutable role-version number per role;
- role-permission foreign keys constrained to the same published catalog version;
- assignment subject-type check: Person, Membership, Persona, or Service Principal as explicitly allowed by role class;
- platform roles cannot reference Organization Membership as their authority record;
- workload roles can only target Service Principals;
- human organization roles require an active Membership;
- valid interval and status checks; partial indexes for active, non-expired assignments;
- indexes on subject, organization, role version, scope type/id, expiry, and case ID;
- no cascade deletion of assignment/audit history from Account, Membership, Organization, or Role;
- last-active-owner checks remain transactional and cannot be replaced by ordinary row updates.

## RLS and database boundary

Every future authorization table requires `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`. Direct mutation is denied by default.

- Organization users can read only the role metadata and assignments their effective organization policy permits.
- Platform assignments are invisible to ordinary organization queries.
- Case grants are visible only to the subject, authorized approvers/auditors, and governed platform services.
- Re-auth receipts reveal no credential or provider token and are not generally listable.
- Creation/change/revocation uses narrow RPCs or a server transaction that resolves `auth.uid()`; callers cannot select arbitrary actor, owner, organization, role authority, or approval identity.
- `SECURITY DEFINER` functions use a fixed safe `search_path`, revoke `PUBLIC`/`anon`, grant only required callers, and revalidate tenant and invariants.
- Service Role is not used by application authorization paths or tests to bypass RLS.

## Legacy role compatibility

Current authority remains `organization_members.role` with values:

| Legacy value              | Proposed baseline role                      | Compatibility rule                                                                            |
| ------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `organization_owner`      | `ORGANIZATION_OWNER`                        | Preserve last-owner protection and current CRUD behavior.                                     |
| `organization_admin`      | `ORGANIZATION_ADMIN`                        | Preserve current organization/curriculum administration behavior.                             |
| `teacher`                 | `TEACHER`                                   | Preserve current read-only curriculum behavior until a separately approved policy expands it. |
| `reviewer`                | `REVIEWER`                                  | Preserve current read-only curriculum behavior until review workflows exist.                  |
| reserved `branch_manager` | future campus/branch role                   | No runtime grant until Branch scope exists.                                                   |
| reserved `student`        | `STUDENT` role + Student Persona            | Fail closed until student relationship/scope exists.                                          |
| reserved `guardian`       | `PARENT`/`GUARDIAN` role + Guardian Persona | Fail closed until dependent relationship exists.                                              |

Display names such as **Platform Owner** map to the AP-002 compatibility authority `PLATFORM_SUPER_ADMIN`; they do not create a second supreme role.

## Additive rollout

1. **Design approval** — approve catalog, role templates, scope graph, policy contract, identity dependencies, and audit requirements.
2. **Audit first** — AP-002B provides immutable audit receipt capability before any role/lifecycle write is activated.
3. **Add schema** — future migrations add tables, checks, indexes, RLS, grants, and controlled RPCs without altering historical migrations or legacy columns.
4. **Backfill shadow state** — derive role assignments deterministically from existing memberships; record source as legacy backfill and validate counts/owners.
5. **Shadow evaluate** — legacy decision remains canonical; new engine evaluates read-only and records non-sensitive mismatch telemetry.
6. **Dual write** — controlled membership role transitions update legacy and versioned assignments atomically only after parity and rollback tests.
7. **Read cutover by feature flag** — low-risk reads first, then ordinary writes; high-risk mutations remain blocked.
8. **Legacy retirement review** — remove dependency only after zero mismatches, full RLS/security evidence, and a separately approved additive migration. Do not rename or drop the legacy role column in this package.

## Active organization and scope compatibility

`user_preferences.active_organization_id` remains navigation preference, never authorization evidence. The evaluator resolves an active Membership and resource tenant independently. Future Branch/Class/Resource scopes are additive descendants and do not broaden an Organization role by default.

## Forward correction and rollback

Database migrations are forward-only. If a new evaluator or assignment write causes defects:

- disable its feature flag;
- return reads to the legacy authority;
- stop dual writes after safely draining in-flight transactions;
- preserve new rows for audit and reconciliation;
- apply an additive correction migration or data repair with before/after evidence;
- never drop new data, rewrite a historical migration, reduce RLS, or bypass last-owner protection.

## Environment rollout gates

| Environment     | Gate                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Local           | isolated migration replay, static SQL safety, catalog/role fixtures, negative scope tests                                               |
| Development     | linked migration parity, real Auth/RLS tests, shadow-evaluation parity, last-owner and cross-tenant tests                               |
| Preview/Staging | production-like catalog version, load/cache invalidation, re-auth/case/approval integration, audit correlation                          |
| Production      | architecture/security/privacy approval, backup and rollback runbook, monitoring, zero unresolved parity errors, manual release approval |

Production permanent deletion, irreversible anonymization, platform high-risk mutation, and break-glass access stay disabled until AP-002B and AP-004 prerequisites are implemented and verified.
