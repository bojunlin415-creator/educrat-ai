# AP-003B Permission Catalog

Status: **Proposed — Awaiting Architecture Approval**

This document defines EduCraft AI's canonical authorization vocabulary. It is an architecture catalog only: no permission below is currently persisted, evaluated at runtime, emitted in a token, or granted by a database migration.

## Catalog rules

- A permission key uses `resource.action`; both segments use lowercase `snake_case`.
- A permission is an atomic capability, never a role name or boolean such as `isAdmin` or `isOwner`.
- An `ALLOW` still requires valid identity, membership/persona state, scope, tenancy, entitlement, resource lifecycle, business invariants, and any required approval or re-authentication.
- `delete` means a governed irreversible operation only where that resource permits it. `trash`, `archive`, and `request_deletion` are distinct actions.
- `manage` is allowed only for bounded configuration resources and must not become a wildcard for unrelated actions.
- Permissions are stable identifiers. Semantic changes require a new key or catalog version; deprecated keys remain mapped during a documented compatibility window.
- Unknown, misspelled, deprecated-without-mapping, or out-of-version keys fail closed.

## Controlled action vocabulary

| Action                          | Canonical meaning                                                       |
| ------------------------------- | ----------------------------------------------------------------------- |
| `create`                        | Create a new resource within an authorized scope.                       |
| `read`                          | Read an authorized resource or view.                                    |
| `update`                        | Change mutable fields without changing lifecycle or authority.          |
| `archive` / `restore`           | Move a resource into or out of a reversible archived state.             |
| `trash`                         | Move an eligible resource to a governed recycle-bin state.              |
| `delete`                        | Execute an approved irreversible deletion, never a UI shortcut.         |
| `request_deletion`              | Start a deletion review or waiting-period workflow.                     |
| `publish`                       | Make an approved resource available to its intended audience.           |
| `review` / `approve` / `reject` | Perform distinct workflow decisions; separation of duties may apply.    |
| `assign` / `unassign`           | Establish or remove a bounded resource relationship.                    |
| `invite`                        | Invite an actor into a membership or collaboration workflow.            |
| `suspend` / `reactivate`        | Disable or restore operational access without deleting history.         |
| `transfer`                      | Transfer governed responsibility or ownership.                          |
| `export`                        | Produce an authorized extract subject to masking and audit obligations. |
| `configure`                     | Change bounded policy or configuration, never implicit administration.  |
| `execute`                       | Run an approved operation or workload.                                  |
| `generate`                      | Ask an approved generator to create a draft; not publish authority.     |
| `submit` / `grade`              | Submit work or record an authorized evaluation.                         |

## Canonical permissions

The catalog contains **224 permission keys**. Role templates reference these keys; they do not replace them.

### Identity and profile

| Permission                 | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `account.read`             | Read an authentication-account summary within effective scope. |
| `account.read_security`    | Read authorized account security metadata.                     |
| `account.suspend`          | Suspend an eligible account through governance controls.       |
| `account.reactivate`       | Reactivate an eligible suspended account.                      |
| `account.request_deletion` | Request governed account deletion review.                      |
| `account.anonymize`        | Execute approved irreversible PII anonymization.               |
| `account.link`             | Start or complete an approved account-person link.             |
| `account.unlink`           | Remove an eligible account-person link.                        |
| `person.read`              | Read a person record within effective scope.                   |
| `person.request_merge`     | Request review of duplicate person records.                    |
| `person.review_merge`      | Review a person-merge request.                                 |
| `person.execute_merge`     | Execute an approved person merge.                              |
| `profile.read`             | Read a profile within effective scope.                         |
| `profile.update_self`      | Update the actor's own permitted profile fields.               |
| `profile.redact`           | Redact approved personal fields under policy.                  |
| `profile.archive`          | Archive an eligible profile.                                   |
| `profile.restore`          | Restore an eligible archived profile.                          |

### Organization, campus, and school

| Permission                        | Purpose                                                        |
| --------------------------------- | -------------------------------------------------------------- |
| `organization.create`             | Create an organization through the controlled transaction.     |
| `organization.read`               | Read organization settings within effective scope.             |
| `organization.update`             | Update allowed organization settings.                          |
| `organization.manage`             | Coordinate bounded organization configuration; not a wildcard. |
| `organization.suspend`            | Suspend an organization under governance policy.               |
| `organization.reactivate`         | Restore a suspended organization to active use.                |
| `organization.archive`            | Archive an eligible organization.                              |
| `organization.restore`            | Restore an eligible archived organization.                     |
| `organization.request_deletion`   | Request organization deletion review.                          |
| `organization.approve_deletion`   | Approve an eligible organization deletion request.             |
| `organization.execute_deletion`   | Execute an approved organization deletion job.                 |
| `organization.transfer_ownership` | Transfer organization ownership atomically.                    |
| `organization.export`             | Export allowed organization-owned data.                        |
| `campus.create`                   | Create a campus in an organization.                            |
| `campus.read`                     | Read an authorized campus.                                     |
| `campus.update`                   | Update allowed campus fields.                                  |
| `campus.archive`                  | Archive an eligible campus.                                    |
| `campus.restore`                  | Restore an eligible campus.                                    |
| `campus.manage_members`           | Manage campus-scoped member assignments.                       |
| `campus.read_reports`             | Read campus-scoped operational reports.                        |
| `school.create`                   | Create a school unit in an organization.                       |
| `school.read`                     | Read an authorized school unit.                                |
| `school.update`                   | Update allowed school fields.                                  |
| `school.archive`                  | Archive an eligible school unit.                               |
| `school.restore`                  | Restore an eligible school unit.                               |
| `school.manage_members`           | Manage school-scoped member assignments.                       |
| `school.read_reports`             | Read school-scoped operational reports.                        |

### Membership and role assignment

| Permission              | Purpose                                                |
| ----------------------- | ------------------------------------------------------ |
| `membership.read`       | Read memberships within effective scope.               |
| `membership.invite`     | Invite an eligible member.                             |
| `membership.accept`     | Accept the actor's valid invitation.                   |
| `membership.suspend`    | Suspend an eligible membership.                        |
| `membership.reactivate` | Reactivate an eligible membership.                     |
| `membership.remove`     | Remove an eligible membership while retaining history. |
| `membership.leave`      | Leave an organization when owner protection allows it. |
| `membership.export`     | Export an authorized membership list with masking.     |
| `role.read`             | Read role definitions available to the actor.          |
| `role.assign`           | Assign an allowed role within effective scope.         |
| `role.change`           | Change an existing role assignment.                    |
| `role.suspend`          | Suspend a role assignment.                             |
| `role.reactivate`       | Reactivate a role assignment.                          |
| `role.revoke`           | Revoke a role assignment.                              |
| `role.delegate`         | Delegate an allowed subset for a bounded period.       |
| `ownership.transfer`    | Execute a governed ownership transfer.                 |
| `platform_role.read`    | Read authorized platform-role assignment metadata.     |
| `platform_role.assign`  | Assign a platform role after dual approval.            |
| `platform_role.revoke`  | Revoke a platform role after required approval.        |
| `case_access.request`   | Request time-bound case-scoped platform access.        |
| `case_access.approve`   | Approve eligible case-scoped access.                   |
| `case_access.revoke`    | Revoke active case-scoped access.                      |
| `break_glass.execute`   | Execute emergency access with post-review obligations. |

### Academic structure

| Permission             | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `grade.read`           | Read an authorized grade definition.                 |
| `grade.create`         | Create a grade configuration.                        |
| `grade.update`         | Update a grade configuration.                        |
| `grade.assign`         | Assign a grade relationship.                         |
| `class.read`           | Read an authorized class.                            |
| `class.create`         | Create a class.                                      |
| `class.update`         | Update allowed class fields.                         |
| `class.archive`        | Archive an eligible class.                           |
| `class.restore`        | Restore an eligible class.                           |
| `class.manage_members` | Manage class-scoped assignments or enrollments.      |
| `class.assign_teacher` | Assign an eligible teacher to a class.               |
| `class.read_roster`    | Read the masked roster for an assigned class.        |
| `course.read`          | Read an authorized course.                           |
| `course.create`        | Create a course.                                     |
| `course.update`        | Update allowed course fields.                        |
| `course.archive`       | Archive an eligible course.                          |
| `course.restore`       | Restore an eligible course.                          |
| `course.assign`        | Assign a course within an authorized academic scope. |

### Curriculum, chapter, and lesson

| Permission                    | Purpose                                                |
| ----------------------------- | ------------------------------------------------------ |
| `curriculum.read`             | Read a curriculum within effective scope.              |
| `curriculum.create`           | Create a curriculum.                                   |
| `curriculum.update`           | Update mutable curriculum fields.                      |
| `curriculum.review`           | Review a curriculum draft.                             |
| `curriculum.approve`          | Approve a curriculum under separation-of-duties rules. |
| `curriculum.publish`          | Publish an approved curriculum version.                |
| `curriculum.archive`          | Archive an eligible curriculum.                        |
| `curriculum.restore`          | Restore an eligible archived curriculum.               |
| `curriculum.trash`            | Move an eligible curriculum to recycle bin.            |
| `curriculum.request_deletion` | Request governed curriculum deletion.                  |
| `curriculum.export`           | Export an authorized curriculum.                       |
| `curriculum.assign`           | Assign a curriculum to an authorized scope.            |
| `chapter.read`                | Read an authorized chapter.                            |
| `chapter.create`              | Create a chapter.                                      |
| `chapter.update`              | Update a chapter.                                      |
| `chapter.reorder`             | Reorder chapters within the same version.              |
| `chapter.archive`             | Archive an eligible chapter.                           |
| `chapter.restore`             | Restore an eligible chapter.                           |
| `chapter.trash`               | Move an eligible chapter to recycle bin.               |
| `chapter.delete`              | Execute approved deletion of an eligible chapter.      |
| `lesson.read`                 | Read an authorized lesson.                             |
| `lesson.create`               | Create a lesson.                                       |
| `lesson.update`               | Update a lesson.                                       |
| `lesson.reorder`              | Reorder lessons within the same chapter.               |
| `lesson.archive`              | Archive an eligible lesson.                            |
| `lesson.restore`              | Restore an eligible lesson.                            |
| `lesson.trash`                | Move an eligible lesson to recycle bin.                |
| `lesson.delete`               | Execute approved deletion of an eligible lesson.       |

### Knowledge

| Permission                   | Purpose                                               |
| ---------------------------- | ----------------------------------------------------- |
| `knowledge_point.read`       | Read an authorized knowledge point.                   |
| `knowledge_point.propose`    | Propose a new or changed knowledge point.             |
| `knowledge_point.update`     | Update an editable knowledge-point draft.             |
| `knowledge_point.review`     | Review a knowledge-point proposal.                    |
| `knowledge_point.approve`    | Approve a knowledge-point proposal.                   |
| `knowledge_point.reject`     | Reject a knowledge-point proposal with reason.        |
| `knowledge_point.publish`    | Publish an approved knowledge-point version.          |
| `knowledge_point.supersede`  | Supersede a knowledge point without deleting history. |
| `knowledge_point.merge`      | Merge eligible knowledge points through governance.   |
| `knowledge_point.map_source` | Map approved provenance to a knowledge point.         |
| `knowledge_point.export`     | Export allowed knowledge graph data.                  |

### Worksheet and assessment

| Permission                  | Purpose                                            |
| --------------------------- | -------------------------------------------------- |
| `worksheet.read`            | Read an authorized worksheet.                      |
| `worksheet.create`          | Create a worksheet draft.                          |
| `worksheet.update`          | Update a worksheet draft.                          |
| `worksheet.generate`        | Request AI-assisted worksheet generation.          |
| `worksheet.review`          | Review generated or authored worksheet content.    |
| `worksheet.approve`         | Approve a worksheet for use.                       |
| `worksheet.publish`         | Publish an approved worksheet.                     |
| `worksheet.export`          | Export a quality-cleared worksheet.                |
| `worksheet.archive`         | Archive a worksheet.                               |
| `worksheet.restore`         | Restore an archived worksheet.                     |
| `worksheet.trash`           | Move an eligible worksheet to recycle bin.         |
| `worksheet.delete`          | Execute approved worksheet deletion.               |
| `worksheet.assign`          | Assign a worksheet to an authorized audience.      |
| `assessment.read`           | Read an authorized assessment.                     |
| `assessment.create`         | Create an assessment draft.                        |
| `assessment.update`         | Update an assessment draft.                        |
| `assessment.review`         | Review an assessment.                              |
| `assessment.approve`        | Approve an assessment.                             |
| `assessment.publish`        | Publish an approved assessment.                    |
| `assessment.assign`         | Assign an assessment.                              |
| `assessment.archive`        | Archive an assessment.                             |
| `assessment.restore`        | Restore an archived assessment.                    |
| `assessment.export`         | Export allowed assessment data.                    |
| `assessment.grade`          | Grade responses within effective assessment scope. |
| `assessment.override_grade` | Override a grade with elevated controls and audit. |
| `attempt.submit`            | Submit the actor's authorized assessment attempt.  |
| `attempt.read`              | Read attempts within effective scope.              |
| `attempt.grade`             | Grade an assigned attempt.                         |
| `attempt.override_grade`    | Override a grade with elevated controls and audit. |

### Student, guardian, learning, analytics, and reports

| Permission                     | Purpose                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `student.read`                 | Read student fields allowed by SELF, CLASS, ASSIGNED, or CHILD scope.         |
| `student.create_managed`       | Create a managed student identity without an account.                         |
| `student.update`               | Update allowed student fields within scope.                                   |
| `student.archive`              | Archive an eligible student record.                                           |
| `student.restore`              | Restore an eligible archived student record.                                  |
| `student.link_account`         | Link a claimed account to an eligible managed student.                        |
| `student.export`               | Export eligible student data with privacy controls.                           |
| `guardian.read`                | Read a guardian persona within effective scope.                               |
| `guardian.read_relationship`   | Read an authorized guardian relationship.                                     |
| `guardian.create_relationship` | Propose a guardian-dependent relationship.                                    |
| `guardian.verify_relationship` | Verify an eligible relationship.                                              |
| `guardian.update_relationship` | Update allowed relationship metadata.                                         |
| `guardian.revoke_relationship` | Revoke a guardian relationship.                                               |
| `guardian.manage_consent`      | Manage eligible guardian consent.                                             |
| `mastery.read`                 | Read mastery data within effective SELF, ASSIGNED, CLASS, or CHILD scope.     |
| `mastery.update`               | Record or correct mastery through an authorized flow.                         |
| `weakness.read`                | Read weakness analysis within effective scope.                                |
| `analytics.read`               | Read analytics within effective SELF, CLASS, ORGANIZATION, or PLATFORM scope. |
| `analytics.export`             | Export authorized, appropriately masked analytics.                            |
| `analytics.configure`          | Configure bounded analytics policy.                                           |
| `report.read`                  | Read reports within effective SELF, ASSIGNED, or CHILD scope.                 |
| `report.create`                | Create a report draft.                                                        |
| `report.update`                | Update a report draft.                                                        |
| `report.publish`               | Publish an approved report.                                                   |
| `report.export`                | Export an authorized report.                                                  |
| `report.archive`               | Archive a report.                                                             |

### Communication, AI, audit, billing, integration, and system

| Permission                             | Purpose                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| `notification.read`                    | Read notifications within effective scope.                         |
| `notification.create`                  | Create a notification draft.                                       |
| `notification.send`                    | Send an approved notification.                                     |
| `notification.schedule`                | Schedule an approved notification.                                 |
| `notification.cancel`                  | Cancel an eligible scheduled notification.                         |
| `notification.update_preferences`      | Update the actor's notification preferences.                       |
| `notification.read_delivery`           | Read authorized delivery status.                                   |
| `notification.export`                  | Export authorized delivery records.                                |
| `ai.assist`                            | Use an approved AI assistance tool contract.                       |
| `ai.generate`                          | Request an approved AI generation job.                             |
| `ai.read_job`                          | Read an authorized AI job status.                                  |
| `ai.cancel_job`                        | Cancel an eligible AI job.                                         |
| `ai.read_usage`                        | Read authorized AI usage and cost data.                            |
| `ai.review`                            | Review AI output as a human-authorized workflow action.            |
| `ai.approve`                           | Approve AI output after required quality checks.                   |
| `ai.publish`                           | Publish approved AI output; never granted to an AI profile.        |
| `ai.configure`                         | Configure bounded AI policy.                                       |
| `audit.read`                           | Read audit events within effective ORGANIZATION or PLATFORM scope. |
| `audit.export`                         | Export audit events under elevated controls.                       |
| `retention.apply_hold`                 | Apply an eligible retention hold.                                  |
| `retention.release_hold`               | Release a hold with separation of duties.                          |
| `lifecycle.read_dependency`            | Read an authorized lifecycle dependency assessment.                |
| `lifecycle.execute`                    | Execute an approved lifecycle transition.                          |
| `subscription.read`                    | Read subscription status.                                          |
| `subscription.configure`               | Configure an allowed subscription change.                          |
| `invoice.read`                         | Read an authorized invoice.                                        |
| `invoice.export`                       | Export an authorized invoice.                                      |
| `refund.execute`                       | Execute an approved refund with separation of duties.              |
| `integration_client.read`              | Read authorized integration-client metadata.                       |
| `integration_client.create`            | Create an integration client.                                      |
| `integration_client.update`            | Update allowed integration-client fields.                          |
| `integration_client.rotate_credential` | Rotate an integration credential without exposing it.              |
| `integration_client.suspend`           | Suspend an integration client.                                     |
| `integration_client.execute`           | Execute an integration within its allowlisted scope.               |
| `integration_client.read_logs`         | Read masked integration execution logs.                            |
| `service_principal.read`               | Read authorized service-principal metadata.                        |
| `service_principal.create`             | Create a governed service principal.                               |
| `service_principal.update`             | Update a service principal's bounded metadata.                     |
| `service_principal.rotate_credential`  | Rotate service-principal credentials.                              |
| `service_principal.suspend`            | Suspend a service principal.                                       |
| `service_principal.reactivate`         | Reactivate an eligible service principal.                          |
| `service_principal.revoke`             | Permanently revoke a service principal.                            |
| `job.execute`                          | Execute an allowlisted background job.                             |
| `job.cancel`                           | Cancel an eligible background job.                                 |
| `scheduler.configure`                  | Configure an authorized schedule.                                  |

## Role-template rules

- Roles reference a versioned subset of this catalog; role names never bypass policy evaluation.
- Organization roles can only grant organization-owned permissions and bounded child scopes.
- Platform roles do not imply routine cross-tenant content access. Support access requires a time-bound `CASE` grant.
- Student and Parent combine a membership relationship, a domain persona, and narrow `SELF`, `CHILD`, `CLASS`, or `ASSIGNED` scopes.
- AI Assistant, AI Reviewer, and AI Generator are execution profiles used to constrain tool behavior. They are not assignable human roles and never receive `approve`, `publish`, platform, audit-export, role-assignment, or deletion permissions.
- Background Worker, Scheduler, and Integration Service are workload-role templates for future Service Principals. Each assignment requires an explicit purpose, resource allowlist, expiry/rotation policy, and audit identity.

## Versioning and deprecation

1. The catalog is published as an immutable version.
2. A role assignment records the effective permission-set version.
3. New keys may be added additively; existing keys cannot silently broaden meaning.
4. A deprecated key gains `deprecated_at`, `replacement_key`, and a removal gate.
5. Dual evaluation is allowed only during a documented compatibility window and must produce comparison telemetry without changing the legacy decision.
6. Removal requires zero active references, migration evidence, regression tests, and an approved forward-only correction plan.
