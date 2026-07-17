# EduCraft AI Event Catalog

- 狀態：**Approved Contract Baseline — Not Implemented**
- Architecture Package：AP-002 Amendment
- 日期：2026-07-16

AP-003A 的 Identity 事件為 **Approved contract extension — Not Implemented**。在 AP-002B/AP-004 實作前，不代表 event publisher、Audit writer、Outbox、Bus、Queue 或 Consumer 已存在。Role／Permission／re-auth／CASE事件留給尚未開始的 AP-003B。

## 1. 範圍

本文件定義 future event contract，不代表 Event Bus、Queue、Outbox、Consumer、Notification 或 Background Job 已實作。此處的 **Publisher** 指事件發布元件，與 legacy textbook Publisher 完全無關。

只有 owning Domain 完成 canonical transaction 後才能發布 past-tense event。Command、request、proposal 與 completed event 不得混用；不可逆操作不能只依賴事件最終一致性，必須在 owning Domain transaction／受控 job 中重新驗證權威資料。

## 2. Standard Event Envelope

每個事件至少具有：

| Field                       | Contract                                                                   |
| --------------------------- | -------------------------------------------------------------------------- |
| `event_id`                  | UUID；全域唯一                                                             |
| `event_name`                | Catalog 中的固定名稱                                                       |
| `event_version`             | 從 `v1` 起，breaking change 建立新 version                                 |
| `occurred_at`               | Owning Domain 完成 canonical transition 的 UTC 時間                        |
| `owning_domain`             | 唯一權威 Domain                                                            |
| `publisher`                 | 產生事件的受控 server component／transactional outbox                      |
| `organization_id`           | Tenant event 必填；platform/global event 必須明確為 null 並提供 scope type |
| `actor_reference`           | 可空、最小化、可 tombstone；不放 email                                     |
| `correlation_id`            | 一條 user intent／workflow 共用，必填                                      |
| `causation_id`              | 觸發本事件的 request/event reference；起點可空                             |
| `idempotency_key`           | Publisher 依 aggregate/version/action 建立，必填                           |
| `aggregate_type/id/version` | 用於同 aggregate ordering 與 stale event 判斷                              |
| `payload`                   | 只允許本 Catalog 的 allowlist；未知欄位拒絕                                |
| `classification`            | `PUBLIC_INTERNAL`、`CONFIDENTIAL`、`RESTRICTED`；預設 CONFIDENTIAL         |
| `schema_hash`               | 可驗證 schema version／contract artifact                                   |

共通規則：

- Delivery 目標為 at-least-once；Consumer 必須以 `event_id` 或 idempotency key 去重。
- Ordering 只保證同 aggregate partition，不能假設全域順序；Consumer 使用 aggregate version 拒絕倒退。
- Retry 使用有上限的 exponential backoff；永久失敗進隔離／dead-letter review，不得無限重試。
- Consumer 失敗不得回滾 Publisher 已提交的 canonical transaction；補償由 owning Domain 的明確 command 處理。
- Event payload 禁止 Secret、Token、密碼、完整教材全文、完整學生作答、自由格式 PII、付款卡資料與未遮罩聯絡資料。
- Audit Event 與 Domain Event 不等同；Catalog 會指定哪些事件必須另寫 append-only Audit。
- Correlation ID 不得包含 email、電話、姓名或其他可讀 PII。

## 3. Organization Events

| Event／Version                       | Owner；Publisher → Consumers                                                                                  | Payload allowlist                                                                                         | Org scope；Correlation／Idempotency                               | PII／Audit                               | Retry／Ordering／Failure                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `organization.created.v1`            | Organization；Organization transaction → Membership、Billing、Analytics、Audit                                | `organization_id, status, created_at, plan_reference?`                                                    | 必填；request correlation，key=`organization:id:version`          | 無名稱／地址；Audit required             | aggregate order；retry；consumer failure 隔離，不刪 Organization |
| `organization.lifecycle_changed.v1`  | Organization；Lifecycle transition service → Permission、Membership、Billing、Analytics、Communication、Audit | `organization_id, before, after, reason_code, effective_at, state_version`                                | 必填；transition correlation，key=`organization:id:state_version` | reason text 不進 payload；Audit required | strict aggregate order；stale 拒絕；失敗觸發治理告警             |
| `organization.deletion_requested.v1` | Governance；Deletion request transaction → Organization、Billing、Communication、Platform review、Audit       | `request_id, organization_id, requested_action, policy_version, grace_ends_at, dependency_summary_counts` | 必填；workflow correlation，key=`deletion_request:id:version`     | 不含 Entity 內容；Audit required         | request order；retry；失敗不得執行 deletion                      |

## 4. Membership Events

| Event／Version                        | Owner；Publisher → Consumers                                                        | Payload allowlist                                                                                  | Org scope；Correlation／Idempotency                             | PII／Audit                                                 | Retry／Ordering／Failure                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `membership.invited.v1`               | Membership；Invite transaction → Identity、Communication、Analytics、Audit          | `membership_id, organization_id, role_code, invitation_reference, expires_at`                      | 必填；invite correlation，key=`membership:id:invite_version`    | 不含 email；Audit required                                 | membership order；delivery failure 不改 invitation state           |
| `membership.status_changed.v1`        | Membership；Membership transition service → Permission、Workspace、Analytics、Audit | `membership_id, organization_id, before, after, role_code, effective_at, state_version`            | 必填；transition correlation，key=`membership:id:state_version` | 不含 Profile；Audit required                               | strict member order；permission consumer 高優先 retry，失敗告警    |
| `membership.ownership_transferred.v1` | Membership；Atomic ownership RPC → Permission、Organization、Communication、Audit   | `organization_id, previous_owner_reference, new_owner_reference, transfer_reference, effective_at` | 必填；transfer correlation，key=`ownership_transfer:reference`  | actor reference 使用 internal/tombstone ID；Audit required | single transaction outcome；duplicate no-op；failure 必須 rollback |

## 5. Curriculum Events

| Event／Version                    | Owner；Publisher → Consumers                                                 | Payload allowlist                                                                                             | Org scope；Correlation／Idempotency                              | PII／Audit                                                            | Retry／Ordering／Failure                                       |
| --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| `curriculum.created.v1`           | Curriculum；Curriculum transaction → Teaching、Assessment、Analytics、Audit  | `curriculum_id, organization_id, subject_id, grade_id, reference_id, status, version_id`                      | 必填；create correlation，key=`curriculum:id:version`            | 不含 legacy identity／內容全文；Audit required                        | aggregate order；retry；consumer 可重建 projection             |
| `curriculum.version_published.v1` | Curriculum；Publish transaction → Teaching、Assessment、AI、Analytics、Audit | `curriculum_id, curriculum_version_id, version_number, published_at, knowledge_contract_refs, schema_version` | 必填；publish correlation，key=`curriculum_version:id:published` | 不含 Lesson 全文；Audit required                                      | immutable event；失敗不得取消已發布版本，需補送                |
| `curriculum.lesson_changed.v1`    | Curriculum；Lesson transaction → Teaching、Assessment、Analytics、Audit      | `curriculum_id, version_id, chapter_id, lesson_id, change_type, state, hierarchy_version`                     | 必填；edit correlation，key=`lesson:id:hierarchy_version`        | 不含 learning objectives／notes 原文；Audit conditional（高風險必須） | lesson order；consumer 取 authoritative projection；失敗可重建 |

## 6. Knowledge Events

| Event／Version                         | Owner；Publisher → Consumers                                                               | Payload allowlist                                                                    | Org scope；Correlation／Idempotency                                            | PII／Audit                                      | Retry／Ordering／Failure                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------ |
| `knowledge.point_version_published.v1` | Knowledge；Knowledge governance transaction → Curriculum、Assessment、AI、Analytics、Audit | `knowledge_point_id, version_id, subject_id, status, effective_at, supersedes_id?`   | global 或明確 Organization-owned；correlation 必填，key=`knowledge_version:id` | 無 PII、無來源全文；Audit required              | immutable version order；consumer 不可覆寫 Knowledge   |
| `knowledge.mapping_changed.v1`         | Knowledge；Mapping transaction → Curriculum、AI、Analytics、Audit                          | `mapping_id, reference_id, knowledge_point_id, mapping_version, change_type, status` | scope 隨 Reference；correlation 必填，key=`mapping:id:version`                 | 禁止 legacy publisher identity；Audit required  | mapping order；failure 停止 AI context refresh 並告警  |
| `knowledge.source_status_changed.v1`   | Knowledge；Provenance review → Knowledge governance、AI safety、Audit                      | `knowledge_source_id, before, after, license_type, visibility, effective_at`         | global／organization 明確；key=`source:id:state_version`                       | 不含受保護內容或 URL credential；Audit required | strict state order；AI consumer failure 必須停止新使用 |

## 7. Teaching Events

| Event／Version                  | Owner；Publisher → Consumers                                                 | Payload allowlist                                                                                                                           | Org scope；Correlation／Idempotency                            | PII／Audit                                                      | Retry／Ordering／Failure                                     |
| ------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| `teaching.session_scheduled.v1` | Teaching；Session transaction → Communication、Analytics                     | `session_id, organization_id, class_reference?, teacher_persona_reference, lesson_version_reference, starts_at, duration_minutes`           | 必填；schedule correlation，key=`session:id:schedule_version`  | Persona internal reference；不含姓名／班級名；Audit conditional | session order；notification failure 不取消 session           |
| `teaching.session_completed.v1` | Teaching；Completion transaction → Learning、Analytics、Communication、Audit | `session_id, organization_id, teacher_persona_reference, lesson_version_reference, completed_at, attendance_summary_counts?, outcome_codes` | 必填；session correlation，key=`session:id:completion_version` | 不含學生名單／筆記全文；Audit required                          | immutable completion；Learning consumer 去重；failure 可補送 |
| `teaching.history_corrected.v1` | Teaching；Correction transaction → Learning、Analytics、Audit                | `history_id, correction_id, correction_type, reason_code, corrected_at, supersedes_reference`                                               | 必填；correction correlation，key=`correction:id`              | 不含原始全文；Audit required                                    | 不覆寫原事件；按 correction version 套用；失敗隔離           |

## 8. Assessment Events

| Event／Version                    | Owner；Publisher → Consumers                                                          | Payload allowlist                                                                                                     | Org scope；Correlation／Idempotency                              | PII／Audit                                        | Retry／Ordering／Failure                                  |
| --------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| `assessment.published.v1`         | Assessment；Publish transaction → Teaching、Learning、Communication、Analytics、Audit | `assessment_id, organization_id, version_id, curriculum_refs, knowledge_refs, published_at, scoring_schema_version`   | 必填；publish correlation，key=`assessment_version:id:published` | 不含題目／答案全文；Audit required                | immutable version；consumer failure 補送，不回退發布      |
| `assessment.attempt_submitted.v1` | Assessment；Submission transaction → Grading、Learning、Analytics、Audit              | `attempt_id, assessment_version_id, learner_persona_reference, submitted_at, response_count, submission_version`      | 必填；attempt correlation，key=`attempt:id:submission_version`   | 不含 response content；RESTRICTED；Audit required | attempt order；重複 submit 去重；grading failure 進待處理 |
| `assessment.grading_completed.v1` | Assessment；Grading transaction → Learning、Analytics、Communication、Audit           | `grading_result_id, attempt_id, grading_version, score_summary, knowledge_evidence_refs, review_status, completed_at` | 必填；attempt correlation，key=`grading:id:version`              | 不含完整 response／教師評語；Audit required       | grading version order；人工覆核產生新 version，不覆寫     |

## 9. Learning Events

| Event／Version                       | Owner；Publisher → Consumers                                                            | Payload allowlist                                                                                                            | Org scope；Correlation／Idempotency                                       | PII／Audit                                                       | Retry／Ordering／Failure                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `learning.enrollment_changed.v1`     | Learning；Enrollment transition → Permission、Teaching、Communication、Analytics、Audit | `enrollment_id, organization_id, learner_persona_reference, class_reference?, before, after, effective_at`                   | 必填；transition correlation，key=`enrollment:id:state_version`           | internal references only；Audit required                         | strict enrollment order；access consumer failure 高優先告警 |
| `learning.event_recorded.v1`         | Learning；Learning record transaction → Analytics、AI（最小 projection）、Audit         | `learning_event_id, organization_id, learner_persona_reference, event_type, knowledge_refs, occurred_at, evidence_reference` | 必填；source correlation，key=`learning_event:id`                         | 不含原始作答／姓名；RESTRICTED；Audit conditional                | append-only；consumer 去重；失敗不改原始紀錄                |
| `learning.skill_evidence_updated.v1` | Learning；Evidence aggregation → Analytics、Teaching、AI                                | `learner_persona_reference, knowledge_point_id, evidence_version, evidence_counts, confidence_band, updated_at`              | 必填；aggregation correlation，key=`skill_evidence:learner:point:version` | pseudonymous internal reference；不含診斷文字；Audit conditional | per learner/point order；可由事件重建；AI 不回寫            |

## 10. AI Events

| Event／Version        | Owner；Publisher → Consumers                                                               | Payload allowlist                                                                                                        | Org scope；Correlation／Idempotency                            | PII／Audit                                          | Retry／Ordering／Failure                                          |
| --------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| `ai.job_requested.v1` | AI；AI job acceptance transaction → AI worker、Billing usage、Audit                        | `job_id, organization_id, requesting_domain, task_type, prompt_version_id, schema_version, model_policy_id, input_hash`  | Tenant task 必填；request correlation，key=`ai_job:id:request` | 不含 prompt/input 原文；Audit required              | acceptance once；worker retry policy；invalid context fail closed |
| `ai.job_completed.v1` | AI；Job completion transaction → requesting Domain、Analytics、Billing、Audit              | `job_id, organization_id, output_reference, schema_version, validation_status, token_usage, cost_estimate, completed_at` | scope 沿 job；key=`ai_job:id:completion_version`               | 不含 output 原文；Audit required                    | terminal event idempotent；consumer failure 補送，不重跑模型      |
| `ai.job_failed.v1`    | AI；Job failure transaction → requesting Domain、Analytics、Billing、Platform alert、Audit | `job_id, organization_id, failure_class, retryable, attempt_count, final, failed_at`                                     | scope 沿 job；key=`ai_job:id:attempt:failure`                  | 不含 provider stack／prompt／Secret；Audit required | retry 依 policy；final failure 隔離；不得無限重試                 |

## 11. Communication Events

| Event／Version                            | Owner；Publisher → Consumers                                                              | Payload allowlist                                                                                                             | Org scope；Correlation／Idempotency                                | PII／Audit                                                  | Retry／Ordering／Failure                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------- |
| `communication.notification_requested.v1` | Communication；Intent acceptance → Delivery worker、Analytics、Audit                      | `notification_id, organization_id?, template_id, template_version, recipient_reference, channel, purpose_code, scheduled_at?` | Tenant 通知必填；correlation 沿來源，key=`notification:id:request` | 不含 email/phone/message body；Audit conditional            | channel retry policy；consent failure fail closed               |
| `communication.notification_delivered.v1` | Communication；Provider receipt transaction → requesting Domain、Analytics、Audit         | `notification_id, delivery_id, channel, delivered_at, provider_receipt_reference`                                             | scope 沿 notification；key=`delivery:id:delivered`                 | receipt 不含 provider token；Audit conditional              | terminal receipt 去重；ordering per delivery                    |
| `communication.notification_failed.v1`    | Communication；Delivery failure transaction → requesting Domain、Analytics、Support alert | `notification_id, delivery_id, channel, failure_class, retryable, attempt_count, final, failed_at`                            | scope 沿 notification；key=`delivery:id:attempt:failure`           | 不含 recipient address/provider response；Audit conditional | bounded retry；final failure 保留狀態，不阻礙原業務 transaction |

## 12. Billing Events

| Event／Version                           | Owner；Publisher → Consumers                                                                   | Payload allowlist                                                                                                                  | Org scope；Correlation／Idempotency                            | PII／Audit                                     | Retry／Ordering／Failure                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| `billing.subscription_status_changed.v1` | Billing；Subscription transaction → Entitlement、Organization、Analytics、Communication、Audit | `subscription_id, organization_id, plan_id, before, after, effective_at, billing_period_reference`                                 | 必填；billing correlation，key=`subscription:id:state_version` | 不含付款方式／地址；Audit required             | strict subscription order；entitlement failure 高優先告警         |
| `billing.invoice_issued.v1`              | Billing；Invoice transaction → Communication、Analytics、Audit                                 | `invoice_id, organization_id, invoice_number_reference, currency, amount_summary, issued_at, due_at, retention_policy_version`     | 必填；invoice correlation，key=`invoice:id:issued`             | 不含 tax/address 明細；Audit required          | immutable issue；delivery failure 不刪 invoice                    |
| `billing.payment_status_changed.v1`      | Billing；Verified webhook/ledger transaction → Subscription、Analytics、Communication、Audit   | `payment_reference, organization_id, invoice_id?, before, after, amount_summary, currency, effective_at, provider_event_reference` | 必填；provider correlation，key=`provider:event:version`       | 不含 card/bank/customer secret；Audit required | webhook 去重；ledger order；failure 進 reconciliation，不信任前端 |

## 13. AP-003A Identity Events（Approved Contract Extension — Not Implemented）

| Event／Version                              | Owner；Publisher → Consumers                                                          | Payload allowlist                                                                                                                            | Org scope；Correlation／Idempotency                                     | PII／Audit                                                | Retry／Ordering／Failure                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `identity.account_person_link_changed.v1`   | Identity；verified link transaction → Membership、Workspace、Audit                    | `person_reference, account_reference, change_type, link_version, effective_at`                                                               | Platform scope；correlation 必填，key=`account_person_link:ref:version` | internal refs only；Audit required                        | strict link order；identity projection failure fail closed             |
| `identity.person_merged.v1`                 | Identity；approved merge workflow → Membership、Persona owners、Audit                 | `source_person_reference, canonical_person_reference, merge_reference, effective_at, merge_version`                                          | Platform scope；merge correlation，key=`person_merge:reference:version` | 不含姓名、email或 conflict 明細；HIGH_RISK Audit required | single canonical result；partial failure rollback／checkpoint recovery |
| `identity.auth_identity_status_changed.v1`  | Identity/Auth adapter；verified provider change → Security、Workspace、Audit          | `account_reference, provider_type, before, after, identity_version, effective_at`                                                            | Platform scope；key=`auth_identity:account:provider:version`            | 不含 provider subject/token/email；security Audit         | strict account/provider order；compromised/revoked high priority       |
| `identity.persona_status_changed.v1`        | Persona owning Domain；persona transition → Membership、Workspace、Audit              | `persona_reference, persona_type, organization_id?, before, after, state_version, effective_at`                                              | tenant Persona 必填 organization；key=`persona:reference:state_version` | 不含姓名／domain record payload；Audit required           | strict persona order；stale reject；access projection fail closed      |
| `identity.guardian_relationship_changed.v1` | Learning/Identity；verified relationship transition → Workspace、Communication、Audit | `relationship_reference, guardian_persona_reference, student_persona_reference, organization_id, before, after, scope_version, effective_at` | 必填；relationship correlation，key=`guardian_relation:ref:version`     | internal refs與 scope version only；不含 minor PII        | strict relation order；Communication重查 consent；failure fail closed  |

Auth credential、token、provider subject、email、Profile、Guardian法律文件、未成年資料、合併衝突全文與業務內容不得進 Identity event payload。事件只能在 canonical transaction完成後發布；link／merge／relationship mutation仍需 AP-002B Audit與 AP-004 delivery基礎後才可實作。

## 14. Consumer Responsibility

1. Consumer 保存處理 checkpoint／idempotency receipt；不得以「看過」但未提交 projection 的狀態標記成功。
2. Consumer 若需要 payload 外資料，使用 owning Domain 的版本化 read contract，不要求 Publisher 擴大 PII payload。
3. Analytics consumer 保存 event/schema version 與 lineage；Communication consumer 重新檢查 consent；AI consumer 重新檢查 task/context policy。
4. Permission、Membership、Billing entitlement 等授權關鍵 consumer 失敗須告警並 fail closed；一般分析 consumer 失敗可延後，但不得阻擋原交易。
5. Permanent deletion executor 在每個 checkpoint 重新查詢 authority、hold、dependency 與 approval，不得只依 `deletion_requested` event 執行。

## 15. Deferred Infrastructure

Outbox、Event Bus、Queue、dead-letter store、schema registry、consumer checkpoint、delivery monitoring 與 replay tooling 均尚未實作。正式實作前需獨立 Architecture Package 定義交易一致性、容量、資料區域、加密、觀測、成本與災難復原。
