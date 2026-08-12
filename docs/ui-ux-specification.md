# Educrat-AI UI/UX Rebaseline

- Status: **Proposed — Awaiting Architecture Approval**
- Date: 2026-08-10
- Scope: Information architecture and interaction contracts only; no UI is implemented by this document.

## Experience principles

- AI guides a user toward the next meaningful action; it does not replace professional judgment.
- Dashboards are action-oriented summaries with drill-down, not large-table landing pages.
- Recommendations show evidence, affected scope, confidence/data sufficiency, and a permitted next action.
- Loading, empty, error, success, unavailable-capability, and insufficient-evidence states are distinct.
- Desktop, tablet, and mobile preserve the same authority and product meaning.
- Existing brand, logos, exact reference-video text, assets, and visual identity are not copied.

## Global information architecture

```text
Workspace
├── Today / Dashboard
├── Courses and Classes
├── Students
├── Materials and Generation
├── Assignments and Assessments
├── Learning and Reports
└── Organization Settings
```

Navigation is a server projection of active organization, persona/role, permission, subject capability, and entitlement. A hidden item is not an authorization boundary.

CAP-001 exposes three safe subject-capability UI states:

- `AVAILABLE_NOW`: may be shown only after independent entitlement/permission/scope checks.
- `COMING_LATER`: roadmap-approved but incomplete; use an intentional explanation only where product UX requires it, never a clickable fake feature.
- `NOT_SUPPORTED`: absent by default for the selected subject; server guard still rejects direct calls.

UI labels never determine subject identity. Selection keeps the persisted subject UUID while the server resolves its stable code through the canonical registry.

## Teacher dashboard

```text
Summary
→ Trends
→ Alerts
→ Affected students/classes
→ Evidence-backed recommendation
→ Action
```

### Primary cards

- Today's lessons/tasks and assignments due.
- Class activity and completion.
- Skill/knowledge progress by subject capability.
- High-priority alerts with affected learner count.
- Recommended next teaching action.

### Drill-down

1. Select class/course and time window.
2. Open trend or alert.
3. See affected learners and evidence, with privacy-aware minimum fields.
4. Review recommendation and alternatives.
5. Take an authorized action: review material, create original practice, adjust assignment, or dismiss with reason.

No recommendation silently creates, publishes, assigns, grades, or changes mastery.

## Student dashboard

```text
Today's tasks
→ Course/assignment progress
→ Ability progress
→ Weaknesses
→ AI recommendation
→ Next action
```

- English can show course/pathway and CEFR progress where sufficient evidence exists.
- Math can show knowledge/prerequisite progress after governed mappings and evidence contracts exist.
- Generation-only subjects do not show mastery/diagnosis/adaptive panels while those capabilities are disabled.
- Empty state explains how the first valid learning evidence is created; it never fabricates a score.

## English experience

English filtering never requires a school grade. Entry context may include pathway, CEFR target/current estimate, exam target, course, module, lesson, and skill. School English may additionally select grade/curriculum.

Placement and skill feedback must distinguish:

- measured evidence from an attempt;
- an estimated proficiency with confidence and model/rubric version;
- a teacher-confirmed placement;
- a target selected by the learner or organization.

Speaking, pronunciation, and writing flows require explicit recording/upload purpose, consent where applicable, processing state, retention notice, retry/error state, and teacher/learner review before any durable conclusion.

## Math experience

Math navigation uses grade → semester → neutral curriculum/progress reference → unit → knowledge point. If lawful reference mapping is unavailable, the user selects a topic/knowledge point directly; the UI does not imply official publisher alignment.

A misconception alert shows the response evidence class, affected knowledge point/prerequisite, number of attempts, and suggested remediation. It does not expose model chain-of-thought or copyrighted source content.

## Generation-only experience

The generation wizard includes grade, semester, neutral progress reference, unit/topic, content type, question type, difficulty, count, and explanation preference. The output flow is:

```text
Generate original draft → validate → teacher edit → teacher review
→ save version → quality gate → an actually available export renderer
```

PDF is available now; Word remains roadmap-approved but unavailable. Answering, grading, mastery, diagnosis, and remediation actions are absent and server-disabled, not merely visually hidden.

## Course and class experience

- `Class` is a roster/cohort and may be associated with school term context.
- `Course` is a deliverable program with editions, modules, lessons, live/recorded delivery, and enrollment.
- Adult English courses may have no grade/semester/class.
- A learner may hold multiple active course and class enrollments.
- Switching organization, persona, class, course, or child changes context; it is not a new login.

## Learning Passport experience

The Passport is a read projection with source/date/version drill-down:

- course and lesson history;
- attendance and assignment history;
- assessment results;
- skill/knowledge/CEFR progress;
- certificates;
- teacher feedback;
- recommendations and remediation history.

Student sees self; teacher sees assigned scope; guardian sees only linked child through an active verified relationship. Cross-organization aggregation/sharing is unavailable.

## Responsive behavior

| Surface | Priority                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------- |
| Mobile  | Today's next action, urgent alert, one-card-at-a-time drill-down, accessible bottom/compact navigation. |
| Tablet  | Two-column summary and comparison, touch-friendly filters and dialogs.                                  |
| Desktop | Summary plus contextual drill-down, multi-column comparison, optional administrative tables.            |

No breakpoint may remove required context, consent, error details, or confirmation for high-risk actions.

## State vocabulary

| State                   | UX response                                                               |
| ----------------------- | ------------------------------------------------------------------------- |
| Loading                 | Skeleton/progress describing the operation; prevent duplicate action.     |
| Empty                   | Explain why data is absent and the valid next step.                       |
| Insufficient evidence   | Show no fabricated score; state evidence requirement.                     |
| Capability unavailable  | Explain subject/product limitation without implying permission failure.   |
| Entitlement unavailable | Explain plan/feature availability and preserve lawful data access/export. |
| Permission denied       | State scope/access issue without leaking another tenant/resource.         |
| Validation error        | Field/action-specific, recoverable guidance.                              |
| Provider/system error   | Correlation/reference ID, safe retry path, no sensitive provider payload. |
| Success                 | Confirm durable outcome, version, and next action.                        |

## Accessibility and trust

- Keyboard-accessible actions, focus management, semantic labels, adequate contrast, and non-color-only status indicators.
- Charts always include textual values/summary and data-sufficiency context.
- AI content and recommendations are labeled; teacher edits and publication authority remain visible.
- Publisher affiliation, official alignment, and copyright safety are never implied by visual treatment.
