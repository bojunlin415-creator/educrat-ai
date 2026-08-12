# Educrat-AI Rebaseline Roadmap

- Status: **Proposed — Awaiting Architecture Approval**
- Date: 2026-08-10
- Rule: Each package requires explicit approval; no phase implies automatic migration, deployment, or Production enablement.

## Roadmap gates

| Gate               | Required evidence                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| Tenant safety      | Server-resolved organization, ENABLE/FORCE RLS, cross-tenant and inactive-membership tests.             |
| Capability safety  | Unknown/disabled subject capability fails closed in server service and UI projection.                   |
| Academic integrity | Versioned references, mapping provenance, copyright allowlist, and no publisher identity in AI context. |
| Learner identity   | One authoritative Student/Person link and one enrollment contract with measured legacy parity.          |
| Evidence integrity | Attempts/responses/grading/evidence are immutable or versioned and reproducible.                        |
| Human authority    | Teacher review precedes publication; AI never grants access or approves high-risk actions.              |
| Runtime readiness  | Typecheck, lint, tests, build, Development migration verification, and explicit manual product checks.  |

## Phase 0 — Existing baseline verification

### S8V-001 Classes & Students Development Verification

- Confirm the target is the approved non-Production Supabase project.
- Review and apply `20260806100000_s08_extend_classes_students_foundation.sql` only if missing.
- Verify tables, composite FKs, indexes, helper, grants, ENABLE/FORCE RLS, and policies.
- Verify authenticated Classes/Students API behavior and tenant isolation.
- Record that current Teacher Student-row policy is organization-wide; verify it as an observed baseline only and open a separate forward-only assigned-scope hardening package before exposing minor PII broadly.
- Record whether the migration is applied; do not infer status from local files.
- Do not redesign or edit historical migration SQL.

Exit: Development database and runtime evidence recorded; unresolved 401/schema/RLS defects receive separate minimal bugfix packages.

## Phase 1 — Shared capability and learner boundaries

### CAP-001 Subject Capability Registry Foundation

- Status: **Approved and Closed — Foundation Verified**.
- `cap-001.v1` controlled vocabulary and immutable English, Math, and Generation-Only profiles are implemented.
- Approved roadmap and current `IMPLEMENTED`／`PARTIAL`／`NOT_IMPLEMENTED` availability are separate; `PARTIAL` fails closed.
- AI generation and PDF export resolve trusted subject references before the capability guard; expected rejection uses structured HTTP 422.
- Matrix, legacy alias, unknown input, generation-only negative, import-boundary, immutability, and circular dependency tests are implemented.
- No database, migration, entitlement, course/pathway overlay, intelligence engine, or placeholder UI was added.

### LE-001 Canonical Learner & Enrollment Convergence

- Define canonical Student↔Person↔Account linkage; managed learners may have no Account.
- Define Class and Course Enrollment aggregate ownership and lifecycle.
- Inventory Profile-based `class_enrollments`, assignments, submissions, learning events, mastery, recommendations, and guardians.
- Add read-only parity adapter and discrepancy reporting before any dual write.
- Design a forward-only migration/backfill/cutover; ambiguous identities fail closed.

Exit: every learner-facing module can name its authoritative learner/enrollment ID and compatibility path.

## Phase 2 — Academic reference spine

### ARS-001 Academic Reference Foundation

- Subjects, proficiency frameworks/levels, curriculum frameworks/versions, academic concepts, skill dimensions, knowledge points, objectives, prerequisites, and question types.
- Version/supersession/provenance and multilingual display contracts.
- Global reference governance separated from organization-owned content.
- Neutral Curriculum Reference mapping; legacy Publisher boundary remains isolated.

### ENG-001 English Mapping Foundation

- English pathways, CEFR mappings, exam families/levels/sections, course-skill mappings, speaking/writing rubric contracts, vocabulary collections.
- No placement provider, speaking upload, course UI, or AI feedback yet.

### MATH-001 Elementary Math Mapping Foundation

- Grades 1–6 and semesters 1–2 mapped to canonical concepts, objectives, prerequisites, question types, and difficulty.
- Lawful minimal progress metadata may enter restricted governance; engines consume neutral mappings.
- No copyrighted textbook text, questions, answers, layout, or publisher-specific prompt.

Exit: coverage, provenance, version, and mapping tests pass with no loose academic string authority.

## Phase 3 — Course delivery and generation enforcement

- Course, edition, module, lesson, live/recorded session, enrollment, attendance, materials, and certificate contracts.
- Extend generation request from required elementary grade to typed optional school/proficiency/pathway/course contexts.
- Extend the existing generation/export enforcement to answering, grading, analytics, and remediation only after those services use a trusted canonical subject reference.
- Add Word export through the existing export contract after quality and teacher review gates.

## Phase 4 — Assessment evidence and Learning Passport

- Normalize assignment assessment definition, attempt, response, grading result, error classification, skill evidence, and rubric evidence.
- Preserve append-only history and rebuildable projections.
- Create tenant-authorized Passport projection over course, attendance, assessment, mastery, certificate, feedback, recommendation, and remediation history.
- Keep cross-organization sharing disabled.

## Phase 5 — Subject intelligence rollout

### English

- Placement and proficiency estimation.
- Course progress and learning paths.
- Speaking/pronunciation/writing feedback with privacy and retention controls.
- GEPT/TOEIC preparation, completion, certificate, and dashboard projections.

### Math

- Online answering and rule-based grading.
- Misconception evidence and prerequisite-aware mastery.
- Remediation, alerts, teacher decision support, and parent reports.

### Generation-only subjects

- Original generation, teacher editing, PDF/Word export.
- Online learning intelligence remains server-disabled until a later profile/version and approved evidence model.

## Exact next three tasks

1. LE-001 — Canonical Learner & Enrollment Convergence, after its clean baseline seal.
2. ARS-001 — Academic Reference Foundation after LE-001's authority/parity gate.
3. English/Math intelligence packages — only after their independent architecture and rollout approvals.

Do not begin English or Math intelligence engine implementation before these three tasks and ARS-001 are approved.
