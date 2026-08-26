# AS-001 Assignment Foundation

Status: Implementation Completed — Awaiting Product Review

AS-001 establishes the first curriculum assignment foundation for EduCraft AI.
It lets teachers and organization administrators bind a published curriculum
version to student work without introducing AI analysis, dashboards, parent
reports, or learning analytics.

## Architecture

- `lib/assignment/` contains the Assignment domain, validation boundary,
  service layer, error model, and API response helpers.
- Assignment APIs live under `/api/assignments`.
- Database persistence is additive through
  `20260729150000_as001_create_assignment_foundation.sql`.
- All assignment writes are server-side and tenant-scoped.

## Domain Model

`assignments` records:

- `organization_id`
- `curriculum_id`
- `curriculum_version_id`
- `title`
- `description`
- `assigned_by`
- `publish_at`
- `due_at`
- `status`
- timestamps

`curriculum_version_id` is a fixed reference. Assignment never resolves
`latest`, and published versions are not mutated by AS-001.

## Student Assignment

`assignment_students` records one row per assigned student:

- `assignment_id`
- `student_id`
- `assigned_at`
- `opened_at`
- `submitted_at`
- `status`

Status values:

- `not_started`
- `in_progress`
- `submitted`
- `overdue`

Class and multi-class assignment expansion is reserved for a later Class
domain package. AS-001 does not create a class table.

## Submission Foundation

`assignment_submissions` stores one submission per student per assignment.
The current model stores structured JSON content and supports draft save and
submit. AI grading, analytics, teacher comments, scoring workflow, and report
generation are intentionally not implemented.

## Validation

AS-001 rejects:

- missing or malformed assignment payloads;
- `dueAt < publishAt`;
- dynamic `latest` curriculum version references;
- draft, review, archived, deleted, or mismatched curriculum versions;
- modifications to submitted student work.

## Authorization

- Student: can see and submit only their own assignment rows.
- Teacher: can manage assignments they created.
- Organization owner/admin: can manage all assignments in the organization.
- Cross-tenant access: fail closed through service checks and RLS.

Teacher class scoping is prepared as a product rule, but full Class scope
resolution is deferred until the Class/Enrollment package exists.

## Audit

AS-001 adds assignment audit events:

- `ASSIGNMENT_CREATED`
- `ASSIGNMENT_UPDATED`
- `ASSIGNMENT_ASSIGNED`
- `ASSIGNMENT_SUBMITTED`

Audit metadata must not store full submission content, answers, AI prompts,
or dashboard analytics.

## Boundaries

### LE-001 Phase 5D learner authority

Assignment is **PARTIALLY CANONICAL**. Class-target learner expansion now uses
active `student_class_members` and `students`, with canonical Student
deduplication and reversible legacy fallback. Recipient materialization in
`assignment_students` and Submission identity remain legacy Profile/Account
authorities. A canonical candidate without an authoritative legacy recipient
mapping returns `recipient_identity_unavailable` before any Assignment target
or recipient write; it is never silently dropped or written with the wrong ID
semantics.

AS-001 does not implement:

- AI analysis;
- learning analytics;
- parent reports;
- dashboards;
- AI recommendations;
- class/enrollment persistence;
- grading workflow;
- notification delivery.
