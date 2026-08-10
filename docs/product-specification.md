# Educrat-AI Product Specification Rebaseline

- Status: **Proposed — Awaiting Architecture Approval**
- Date: 2026-08-10
- Scope: English Intelligence, Math Intelligence, and Generation-Only Subjects
- Implementation status: Architecture and planning only; no runtime capability is created by this document.

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

### 3.1 Controlled capability vocabulary

| Capability key             | Meaning                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| `content_generation`       | Generate original teaching materials from approved academic context. |
| `assessment_generation`    | Generate original exercises and assessments.                         |
| `answer_explanation`       | Produce answer keys and explanations subject to validation.          |
| `teacher_editor`           | Permit teacher review and revision before publication.               |
| `document_export`          | Export reviewed, saved, versioned content.                           |
| `online_answering`         | Accept learner responses online.                                     |
| `automatic_grading`        | Grade supported response types with traceable rules.                 |
| `skill_diagnosis`          | Convert evidence into skill/knowledge weakness signals.              |
| `mastery_tracking`         | Maintain rebuildable mastery projections and history.                |
| `personalized_remediation` | Recommend evidence-based remediation.                                |
| `progress_reporting`       | Provide authorized learner/class/organization reports.               |
| `speaking_assessment`      | Assess speaking against a versioned rubric.                          |
| `writing_assessment`       | Assess writing against a versioned rubric.                           |
| `course_delivery`          | Deliver live/recorded course modules and lessons.                    |
| `certification`            | Track eligible course/exam outcomes and certificates.                |

New keys require review, documentation, tests, a profile version increment, and a safe default of disabled.

### 3.2 Capability states

- `disabled`: unavailable and server-side rejected.
- `pilot`: available only to explicitly entitled tenants/cohorts.
- `enabled`: available when entitlement, permission, scope, lifecycle, and policy checks also pass.

Capability availability never grants a user permission. The canonical decision is:

```text
subject capability enabled
AND organization entitlement available
AND actor permission allowed
AND resource scope valid
AND lifecycle/business rules allowed
```

### 3.3 Target profiles and rollout state

The profile records the approved **target capability** separately from its runtime rollout state. “Target enabled” never means the current repository already implements or activates that capability.

| Capability                                       | English target        | Math target              | Chinese / Science / Social Studies / Life Curriculum target |
| ------------------------------------------------ | --------------------- | ------------------------ | ----------------------------------------------------------- |
| Content and assessment generation                | enabled progressively | enabled                  | enabled                                                     |
| Answers, explanations, teacher editor, export    | enabled progressively | enabled                  | enabled                                                     |
| Online answering and grading                     | enabled progressively | enabled                  | disabled                                                    |
| Skill diagnosis, mastery, remediation, reporting | enabled progressively | enabled                  | disabled                                                    |
| Speaking and writing assessment                  | enabled progressively | not applicable initially | disabled                                                    |
| Course delivery and certification                | enabled progressively | deferred                 | disabled                                                    |

An implementation starts new capabilities as `disabled` or explicitly entitled `pilot` until its reference data, evidence model, authorization, privacy, validation, and tests satisfy rollout gates. Math therefore has a full-learning-intelligence target while elementary implementation remains incremental.

The future runtime should expose one immutable `SubjectCapabilityProfile` per version and a pure `supports(subjectId, capabilityKey, context)` decision. Storage may later be a versioned artifact with database materialization, but this task does not select or create a persistence table.

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

This specification redefines future direction only. It does not claim that English Intelligence, Math Intelligence, subject capability runtime, academic reference schema, course delivery, learning passport, or new mappings are implemented or database-validated.
