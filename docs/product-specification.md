# Educrat-AI Product Specification Rebaseline

- Status: **Proposed — Awaiting Architecture Approval**
- Date: 2026-08-10
- Scope: English Intelligence, Math Intelligence, and Generation-Only Subjects
- Implementation status: CAP-001 now provides the versioned subject capability registry and fail-closed guard. English/Math intelligence, academic references, courses, CEFR/exams, and learner convergence remain unimplemented.

## 1. Product definition

Educrat-AI is an AI-assisted teaching, learning, diagnosis, and original-content generation platform. The repository name and existing UI name `EduCraft AI` remain compatibility identifiers until a separately approved naming package changes them.

The product has three capability levels:

1. **English Intelligence Platform** — a proficiency-, course-, skill-, assessment-, and learning-oriented platform for children through adults.
2. **Math Intelligence Platform** — a full learning-intelligence platform beginning with Taiwan elementary grades 1–6.
3. **Generation-Only Subjects** — Chinese, Science, Social Studies, and Life Curriculum initially support original material generation, teacher editing, and document export only.

Capabilities are enabled by a centralized, versioned subject capability profile. Subject behavior must not be implemented through scattered subject-name conditionals.

## 2. Product invariants

- AI assists the workflow; teachers retain authority for review and publication.
- Tenant data is resolved from authenticated server context. A client-supplied organization ID is never authority.
- Global academic references are separate from organization-owned learning and content data.
- AI providers are replaceable and consume versioned, allowlisted contracts.
- AI output is untrusted until schema, domain, safety, and quality validation pass.
- Published learning materials and historical evidence are immutable; later changes create versions.
- Copyrighted textbook content, teacher manuals, question banks, illustrations, and answer keys are not copied, stored, embedded, or reproduced without a verified license.
- Publisher metadata may be used only in a governed reference/compatibility boundary. Core Domain and AI context consume neutral Curriculum Reference and approved Knowledge mappings.
- Every primary experience supplies meaningful loading, empty, error, and success states on desktop, tablet, and mobile.

## 3. Subject capability model

### 3.1 Controlled capability vocabulary (`cap-001.v1`)

| Category                    | Capability keys                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content / authoring         | `content_generation`, `worksheet_generation`, `assessment_generation`, `answer_generation`, `explanation_generation`, `teacher_editing`, `pdf_export`, `word_export`                  |
| Learning delivery           | `assignment_distribution`, `online_answering`, `course_delivery`, `live_course`, `recorded_course`                                                                                    |
| Grading / intelligence      | `automatic_grading`, `skill_diagnosis`, `mastery_tracking`, `misconception_diagnosis`, `personalized_remediation`, `adaptive_recommendation`, `progress_reporting`, `learning_alerts` |
| English future intelligence | `proficiency_framework`, `cefr_tracking`, `exam_preparation`, `speaking_assessment`, `pronunciation_assessment`, `writing_assessment`, `learning_passport`                            |
| Math future intelligence    | `knowledge_graph`, `prerequisite_graph`, `math_mastery`, `math_misconception_analysis`                                                                                                |

New keys require review, documentation, tests, a profile version increment, and a safe default of disabled.

### 3.2 Capability states

- `approved`: the product roadmap permits a subject to support the capability in a future reviewed package.
- `IMPLEMENTED`: current code provides the capability; `isSubjectCapabilityAvailable()` may return true.
- `PARTIAL`: foundation exists but the complete, subject-safe product capability is unavailable.
- `NOT_IMPLEMENTED`: no current runtime. An unapproved subject/capability also remains unavailable.

Capability availability never grants a user permission. The canonical decision is:

```text
subject capability approved and IMPLEMENTED
AND organization entitlement available
AND actor permission allowed
AND resource scope valid
AND lifecycle/business rules allowed
```

### 3.3 Subject profiles

The profile records the approved **target capability** separately from its runtime rollout state. “Target enabled” never means the current repository already implements or activates that capability.

| Subject         | Product mode                  | Approved capabilities                                                                                                    | Currently available capabilities                                                                     |
| --------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| English         | English Intelligence Platform | Content/authoring, all delivery, selected learning intelligence, and English future intelligence per CAP-001 matrix      | Content generation, worksheet generation, answer/explanation generation, teacher editing, PDF export |
| Math            | Math Intelligence Platform    | Content/authoring, assignment/answering, selected learning intelligence, and Math future intelligence per CAP-001 matrix | Content generation, worksheet generation, answer/explanation generation, teacher editing, PDF export |
| Chinese         | Generation-Only               | Eight content/authoring capabilities only                                                                                | Content generation, worksheet generation, answer/explanation generation, teacher editing, PDF export |
| Science         | Generation-Only               | Eight content/authoring capabilities only                                                                                | Content generation, worksheet generation, answer/explanation generation, teacher editing, PDF export |
| Social Studies  | Generation-Only               | Eight content/authoring capabilities only                                                                                | Content generation, worksheet generation, answer/explanation generation, teacher editing, PDF export |
| Life Curriculum | Generation-Only               | Eight content/authoring capabilities only                                                                                | Content generation, worksheet generation, answer/explanation generation, teacher editing, PDF export |

The code-owned immutable registry lives in `lib/subjects/`. `PARTIAL` never counts as available. Subscription, organization entitlement, permission, scope, lifecycle, and RLS remain separate gates. The complete approved and implementation matrices are in `docs/architecture/cap-001-subject-capability-registry.md`.

## 4. English Intelligence Platform

### 4.1 Audience and pathways

English is not grade-only. It supports children through adults through reusable pathways:

- Kids English
- School English
- General English
- Conversation English
- Business English
- GEPT
- TOEIC
- future certification and professional pathways

### 4.2 Proficiency spine

CEFR is the shared proficiency spine: `Pre-A1`, `A1`, `A2`, `B1`, `B2`, `C1`. A learner may also have school grade, exam target, course enrollment, and organization placement state; none replaces CEFR.

Canonical English concepts are reusable. A concept such as Present Perfect is represented once and mapped independently to school curriculum, CEFR B1, GEPT Intermediate, TOEIC Part 5, and a Business English course. Pathways and exams do not clone the concept.

### 4.3 Skill dimensions

Vocabulary, spelling, grammar, sentence patterns, reading, listening, speaking, pronunciation, writing, communication, and test strategy are controlled skill dimensions. Evidence must retain dimension, rubric/schema version, learning context, and provenance.

### 4.4 Incremental capabilities

The architecture must allow placement, proficiency estimation, learning paths, live/recorded courses, pre/post-class activities, assignments, grading, speaking/pronunciation/writing feedback, weakness diagnosis, remediation, CEFR/exam progress, certificates, learning passport, dashboards, reports, and alerts. These are not implemented by this rebaseline.

## 5. Math Intelligence Platform

Initial implementation scope is Taiwan elementary grades 1–6, semesters 1–2. Nan-I, Kang Hsuan, and Han Lin may be represented as governed progress-reference metadata only; the Knowledge Graph and original content remain authoritative.

The logical navigation hierarchy is:

```text
subject → grade → semester → curriculum reference → unit → lesson
        → knowledge point → learning objective → prerequisite
        → question type → difficulty
```

Publisher/version selection must resolve server-side to a neutral Curriculum Reference and approved knowledge-point mappings. Publisher identity, copyrighted text, proprietary question banks, lesson prose, and layout must not enter AI context.

The platform may incrementally add generation, teacher editing, assignment, answering, grading, misconception diagnosis, mastery, remediation, progress, class analytics, decision support, alerts, and parent reports. Junior/senior high curriculum data is deferred.

## 6. Generation-Only Subjects

Chinese, Science, Social Studies, and Life Curriculum initially support:

- grade, semester, governed progress reference, unit, content type, question type, and difficulty selection;
- original teaching-material, worksheet, test, answer, and explanation generation;
- teacher editing;
- PDF and Word export.

Online answering, grading, mastery, diagnosis, remediation, ability radar, adaptive paths, and long-term subject analytics remain disabled by capability profile. Shared contracts must allow later enablement without redesigning tenant, learner, content, or evidence boundaries.

## 7. AI learning experience

AI participates across diagnosis → recommendation → lesson planning → original content generation → assignment → grading → weakness diagnosis → remediation → progress tracking → teacher decision support. Every recommendation must expose evidence, uncertainty or rule basis, a next action, and human authority.

Teacher information hierarchy:

```text
summary → trends → alerts → affected learners → recommendation → action
```

Student information hierarchy:

```text
today's tasks → course progress → ability progress → weaknesses
→ recommendation → next action
```

Large tables are secondary drill-down tools rather than the primary dashboard experience.

## 8. Learning passport product boundary

The future passport composes immutable or versioned evidence from courses, lessons, attendance, assignments, attempts, results, skill/mastery history, CEFR progress, certificates, teacher feedback, AI recommendations, remediation, and long-term progress.

- Global reference: subjects, frameworks, levels, skills, knowledge points, objectives, and rubrics.
- Organization-scoped: courses/editions, classes, assignments, organization materials, reports, and access audit.
- Enrollment-scoped: module progress, attendance, course assignments, course completion, and certificate eligibility.
- Student-scoped: learning events, assessment history, mastery history, feedback, recommendations, and passport projection.

Cross-organization sharing is not enabled. A passport projection may not bypass organization authorization, guardian relationship, minor-data policy, or tenant RLS.

## 9. Acceptance boundary

This specification defines the future direction and records only CAP-001 as implemented application foundation. It does not claim that English Intelligence, Math Intelligence, academic reference schema, course delivery, learning passport, or new mappings are implemented or database-validated. CAP-001 itself creates no database objects.
