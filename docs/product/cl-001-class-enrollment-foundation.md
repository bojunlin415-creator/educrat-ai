# CL-001 Class & Enrollment Foundation

Status: Implementation Completed — Awaiting Product Review

CL-001 establishes the class and enrollment foundation that AS-001 needs for
teacher-owned class assignment. It does not add attendance, timetable,
learning analytics, dashboards, parent reports, or AI recommendation.

## Architecture

- `lib/classroom/` contains the class domain, enrollment domain, validation,
  service layer, and safe API response boundary.
- Class APIs live under `/api/classes`.
- Persistence is additive through
  `20260730100000_cl001_create_class_enrollment_foundation.sql`.
- Assignment integration adds `assignment_classes`, while assignments remain
  bound to a fixed published Curriculum Version.

## Class Domain

`classes` records:

- `organization_id`
- `name`
- `code`
- `description`
- `school_year`
- `semester`
- `subject`
- `grade`
- `teacher_id`
- `status`
- timestamps

Status values:

- `active`
- `inactive`
- `archived`

Each class has exactly one primary teacher in CL-001. Assistant teacher support
is reserved for a later package.

## Enrollment Domain

`class_enrollments` records:

- `organization_id`
- `class_id`
- `student_id`
- `joined_at`
- `left_at`
- `status`

Status values:

- `active`
- `inactive`
- `left`

A student can join zero or more classes. A class can have zero or more
students. Cross-tenant enrollment is rejected.

## Assignment Integration

Assignments can now target:

- individual students through `assignment_students`;
- one class or multiple classes through `assignment_classes`.

When a class is assigned, current active class enrollments are materialized into
`assignment_students` so the student assignment foundation remains the student
delivery source. Assignment still never resolves `latest` curriculum.

## Authorization

- Student: can view only their own active class enrollments.
- Teacher: can manage only classes where they are the primary teacher.
- Organization owner/admin: can manage all classes and enrollments in the
  organization.
- Cross tenant: fail closed through service checks and RLS.

## Audit

CL-001 adds classroom audit events:

- `CLASS_CREATED`
- `CLASS_UPDATED`
- `CLASS_ARCHIVED`
- `ENROLLMENT_CREATED`
- `ENROLLMENT_REMOVED`

Audit metadata must not store attendance, timetable, analytics, parent report,
or AI recommendation content.

## Boundaries

CL-001 does not implement:

- attendance;
- timetable;
- learning analytics;
- dashboard;
- parent portal;
- AI recommendation;
- assistant teachers;
- grading or report workflows.
