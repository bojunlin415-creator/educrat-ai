# PB-001 Curriculum Publish Foundation

Status: Implementation Completed — Awaiting Product Review

PB-001 establishes the first product-level curriculum publishing workflow for stored curriculum versions.

## Lifecycle

Curriculum status is modeled as an explicit state machine:

```text
DRAFT
→ IN_REVIEW
→ PUBLISHED
→ ARCHIVED
```

The database stores lowercase values (`draft`, `in_review`, `published`, `archived`) and the UI presents formal product labels.

## Rules

- Draft can be submitted for review.
- In-review curriculum can be reviewed, published, or returned to draft.
- Published curriculum can be archived.
- Archived curriculum cannot directly return to draft.
- Published or archived curriculum can create a new draft version.
- Published versions are locked and must not be overwritten.

## Publish Validation

Before submission or publishing, the service validates the stored curriculum version through the export document model:

- title metadata;
- learning objectives;
- at least one question;
- sequential question numbers;
- answer mapping;
- knowledge point mapping;
- version metadata;
- tenant ownership through server-side loading.

Any missing or invalid requirement fails closed.

## Authorization

- Teacher: submit review and reopen in-review draft.
- Reviewer: review only.
- Organization Admin: review, publish, archive, create new version.
- Organization Owner: review, publish, archive, create new version.

All product actions use server-side authorization and do not trust client-supplied role or tenant data.

## Server Routes

- `POST /api/curriculums/[id]/submit-review`
- `POST /api/curriculums/[id]/review`
- `POST /api/curriculums/[id]/approve`
- `POST /api/curriculums/[id]/publish`
- `POST /api/curriculums/[id]/archive`
- `POST /api/curriculums/[id]/reopen-draft`
- `POST /api/curriculums/[id]/versions/new`

## Audit

PB-001 adds:

- `CURRICULUM_SUBMITTED`
- `CURRICULUM_REVIEWED`
- `CURRICULUM_PUBLISHED`
- `CURRICULUM_ARCHIVED`

Audit metadata records lifecycle context only; it must not store PDF binary, full curriculum content, full answers, provider raw responses, prompts, keys, or secrets.

## Known Limitations

- Reopen-to-draft currently does not add a dedicated new audit action.
- Publish validation uses the stored export document projection as the canonical completeness view.
- DB-level edit-lock checks for every historical chapter/lesson RPC should be hardened in a later migration package; PB-001 adds product service guards for current server entry points.
- No AI-002, background job, notification, queue, platform review, or billing integration is included.
