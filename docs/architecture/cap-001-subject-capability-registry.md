# CAP-001 Subject Capability Registry Foundation

- Status: **Approved and Closed — Foundation Verified**
- Profile version: `cap-001.v1`
- Persistence: **NO MIGRATION REQUIRED**
- Runtime scope: typed product capability registry and application guard only

## 1. Decision

`lib/subjects/` is the canonical application-layer source for the question: “May this subject product mode support this capability, and is that capability actually available now?” It does not answer whether an actor is authenticated, entitled, authorized, in scope, or allowed by lifecycle/RLS.

```text
trusted subject reference
  → canonical subject compatibility mapping
  → approved product capability
  → current implementation availability
  → requireSubjectCapability()
  → product service

Authentication + Membership + Permission + Scope + Lifecycle + RLS
remain separate mandatory gates.
```

Unknown subjects, unknown capability keys, capabilities outside a subject's approved mode, and approved-but-unimplemented capabilities all fail closed.

## 2. Canonical subject identifiers

| Canonical ID      | Product mode                  | Existing database code | Compatibility rule                       |
| ----------------- | ----------------------------- | ---------------------- | ---------------------------------------- |
| `english`         | English Intelligence Platform | `english`              | identity mapping                         |
| `math`            | Math Intelligence Platform    | `math`                 | identity mapping                         |
| `chinese`         | Generation-Only               | `chinese`              | identity mapping                         |
| `science`         | Generation-Only               | `science`              | identity mapping                         |
| `social_studies`  | Generation-Only               | `social`               | explicit `social → social_studies` alias |
| `life_curriculum` | Generation-Only               | `life`                 | explicit `life → life_curriculum` alias  |

Localized labels such as 國語、英文 or 數學 are never identity inputs. UUID `subjects.id` remains the persisted foreign key; server code resolves that row and then maps its stable `code`.

## 3. Capability taxonomy

| Category                    | Controlled keys                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content / authoring         | `content_generation`, `worksheet_generation`, `assessment_generation`, `answer_generation`, `explanation_generation`, `teacher_editing`, `pdf_export`, `word_export`                  |
| Learning delivery           | `assignment_distribution`, `online_answering`, `course_delivery`, `live_course`, `recorded_course`                                                                                    |
| Grading / intelligence      | `automatic_grading`, `skill_diagnosis`, `mastery_tracking`, `misconception_diagnosis`, `personalized_remediation`, `adaptive_recommendation`, `progress_reporting`, `learning_alerts` |
| English future intelligence | `proficiency_framework`, `cefr_tracking`, `exam_preparation`, `speaking_assessment`, `pronunciation_assessment`, `writing_assessment`, `learning_passport`                            |
| Math future intelligence    | `knowledge_graph`, `prerequisite_graph`, `math_mastery`, `math_misconception_analysis`                                                                                                |

New keys require architecture review, a profile version change, tests, and a default of unavailable.

## 4. Approved product capability matrix

| Product mode                  | Approved capabilities                                                                                                                                                                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| English Intelligence Platform | All content/authoring and delivery keys; `automatic_grading`, `skill_diagnosis`, `mastery_tracking`, `personalized_remediation`, `adaptive_recommendation`, `progress_reporting`, `learning_alerts`; all English future intelligence keys.                                                           |
| Math Intelligence Platform    | All content/authoring keys; `assignment_distribution`, `online_answering`, `automatic_grading`, `skill_diagnosis`, `mastery_tracking`, `misconception_diagnosis`, `personalized_remediation`, `adaptive_recommendation`, `progress_reporting`, `learning_alerts`; all Math future intelligence keys. |
| Generation-Only               | Only the eight content/authoring keys. Online answering, grading, diagnosis, mastery, remediation, recommendation, reporting, alerts, course delivery, English intelligence, and Math intelligence are not approved.                                                                                 |

Approval is roadmap authorization, not evidence of implementation or user authorization.

## 5. Current implementation availability audit

Legend: `I` = IMPLEMENTED, `P` = PARTIAL foundation only and therefore not available, `N` = NOT IMPLEMENTED or not approved. E = English, M = Math, C = Chinese, S = Science, SS = Social Studies, L = Life Curriculum.

| Capability                    | E   | M   | C   | S   | SS  | L   |
| ----------------------------- | --- | --- | --- | --- | --- | --- |
| `content_generation`          | I   | I   | I   | I   | I   | I   |
| `worksheet_generation`        | I   | I   | I   | I   | I   | I   |
| `assessment_generation`       | P   | P   | P   | P   | P   | P   |
| `answer_generation`           | I   | I   | I   | I   | I   | I   |
| `explanation_generation`      | I   | I   | I   | I   | I   | I   |
| `teacher_editing`             | I   | I   | I   | I   | I   | I   |
| `pdf_export`                  | I   | I   | I   | I   | I   | I   |
| `word_export`                 | N   | N   | N   | N   | N   | N   |
| `assignment_distribution`     | P   | P   | N   | N   | N   | N   |
| `online_answering`            | P   | P   | N   | N   | N   | N   |
| `course_delivery`             | N   | N   | N   | N   | N   | N   |
| `live_course`                 | N   | N   | N   | N   | N   | N   |
| `recorded_course`             | N   | N   | N   | N   | N   | N   |
| `automatic_grading`           | N   | N   | N   | N   | N   | N   |
| `skill_diagnosis`             | P   | P   | N   | N   | N   | N   |
| `mastery_tracking`            | P   | P   | N   | N   | N   | N   |
| `misconception_diagnosis`     | N   | N   | N   | N   | N   | N   |
| `personalized_remediation`    | P   | P   | N   | N   | N   | N   |
| `adaptive_recommendation`     | P   | P   | N   | N   | N   | N   |
| `progress_reporting`          | P   | P   | N   | N   | N   | N   |
| `learning_alerts`             | N   | N   | N   | N   | N   | N   |
| `proficiency_framework`       | N   | N   | N   | N   | N   | N   |
| `cefr_tracking`               | N   | N   | N   | N   | N   | N   |
| `exam_preparation`            | N   | N   | N   | N   | N   | N   |
| `speaking_assessment`         | N   | N   | N   | N   | N   | N   |
| `pronunciation_assessment`    | N   | N   | N   | N   | N   | N   |
| `writing_assessment`          | N   | N   | N   | N   | N   | N   |
| `learning_passport`           | N   | N   | N   | N   | N   | N   |
| `knowledge_graph`             | N   | N   | N   | N   | N   | N   |
| `prerequisite_graph`          | N   | N   | N   | N   | N   | N   |
| `math_mastery`                | N   | N   | N   | N   | N   | N   |
| `math_misconception_analysis` | N   | N   | N   | N   | N   | N   |

Evidence:

- Real AI-001 structured generation, answer/explanation output, editable preview/save, stored-version worksheet projection, and EX-001 PDF renderer support the implemented content capabilities for all six currently seeded subjects.
- Assessment questions exist inside generated curriculum output, but no canonical Assessment generation aggregate exists; therefore assessment generation is partial.
- AS-001 assignment/submission, AN-001 analytics, AI-002 recommendation, and RP-001 reporting foundations exist, but they use legacy/free-text subject and enrollment contracts and do not yet enforce trusted canonical subject capability. They are partial only for the English/Math approved roadmap and unavailable for Generation-Only subjects.
- No automatic grader, alert engine, course/live/recorded delivery, Word renderer, CEFR/exam/speaking/writing/passport runtime, or Math graph/misconception engine exists.

`isSubjectCapabilityAvailable()` returns true only for `IMPLEMENTED`. `PARTIAL` is deliberately false.

## 6. Application and error contract

`requireSubjectCapability(subject, capability)` accepts only canonical or documented legacy subject codes. On rejection it throws `SubjectCapabilityError`:

```json
{
  "success": false,
  "message": "此科目目前不支援這項功能。",
  "error": {
    "code": "subject_capability_unavailable",
    "subject": "chinese",
    "capability": "skill_diagnosis"
  }
}
```

Subject-capability rejection uses HTTP `422 Unprocessable Entity`. The response intentionally omits internal reason (`NOT_APPROVED` versus `NOT_AVAILABLE`) so clients cannot enumerate unreleased roadmap state.

AI generation and PDF export now resolve the persisted `subjects` row server-side, map the stable code, and require `content_generation` or `pdf_export` respectively. AI request payloads no longer supply a display-name subject as capability authority.

## 7. Existing subject-aware checks

| Area                                  | Finding                                                               | CAP-001 disposition                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| AI generation UI/API                  | Previously sent localized subject label and trusted a generic string. | **Migrated now** to `subjectId` → server row code/name → capability guard.                                  |
| PDF/Browser Print export              | Export authorization existed, but no subject product-mode gate.       | **Migrated now** to trusted subject row code → `pdf_export` guard.                                          |
| Curriculum CRUD/editor                | Uses subject UUID and reference row; all six support editing.         | Compatibility boundary; no duplicate subject conditional.                                                   |
| Assignment/submission                 | Generic implementation has no canonical subject field/gate.           | Deferred to canonical curriculum/learner integration; marked PARTIAL, not available.                        |
| Learning analytics/adaptive/reporting | Uses free-text subject snapshots and legacy Profile-based enrollment. | Deferred to LE-001/ARS-001 cutover; Generation-Only intelligence remains rejected by registry.              |
| Dashboard/navigation                  | No subject-specific feature navigation is currently exposed.          | No UI change or disabled-placeholder dashboard. Future projection must use `getSubjectCapabilityUiState()`. |
| `subjects` seed                       | Uses legacy `social` and `life` codes.                                | Explicit compatibility aliases; no data rewrite or migration.                                               |

## 8. UI behavior

The safe projection has three states:

- `AVAILABLE_NOW`: capability is approved and implemented; an independently authorized UI may expose it.
- `COMING_LATER`: approved roadmap capability is partial or not implemented; it must not be clickable as a working feature.
- `NOT_SUPPORTED`: not approved for this subject or input is unknown; hide it unless an intentional product explanation is required.

This projection never grants permission and does not create a dashboard of disabled placeholders.

## 9. Persistence and future overlays

**NO MIGRATION REQUIRED.** Product capability policy is code-owned, version-controlled, reviewed, and immutable at runtime. There is no current administrative editing requirement.

Future subscription plan, organization entitlement, course/pathway/exam override, and experiment/beta rollout must be separate overlays. They can further restrict a product-approved and implemented capability; they cannot enable an unapproved or unimplemented capability. Any future database materialization requires a separate migration package with RLS and version parity.

## 10. Known compatibility boundaries

- `social` and `life` remain persisted Sprint 7 codes until an independently approved data migration; aliases prevent breaking existing rows.
- AI generation remains elementary grade 1–6 and `zh-TW`; CAP-001 does not implement adult English, CEFR, pathway, or course context.
- Assignment/Analytics/Reporting subject fields remain legacy strings and are not treated as canonical capability authority.
- `class_enrollments` versus canonical `student_class_members` and Profile ID versus Student ID convergence remains LE-001 work.
- Registry approval does not activate a tenant entitlement, user permission, or product rollout.
