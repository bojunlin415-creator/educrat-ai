# ADR-007：Domain Boundaries and Identity Concept Model

- 狀態：**Accepted — Architecture Approved**
- Architecture Package：AP-002 Amendment
- 日期：2026-07-16

## 1. 背景

EduCraft AI 已有 Supabase Authentication、`profiles`、`organizations`、`organization_members`、Curriculum 與 Editor，但目前資料表名稱不能直接等同完整 Domain。未來同一個人可能同時屬於多個 Organization，在不同 Organization 擔任 Teacher、Reviewer、Student 或 Parent，也可能另外取得 Platform governance role。若把 Account、Profile、Membership、Persona 與 Platform Role 合併，會造成跨租戶升權、帳號刪除破壞歷程，以及 AI 或 Analytics 誤用權威資料。

本 ADR 只定義 conceptual boundary、authority、RACI 與 contract，不建立 Identity Framework、Persona table、RBAC、Event Bus、Queue、Migration 或功能。

## 2. Identity Concept Model

```text
Authentication Account
        │ 0..1 current link
        ▼
Person Profile
        │
        ├── Organization Membership ── Organization A
        │       ├── Teacher Persona
        │       └── Reviewer Persona
        │
        ├── Organization Membership ── Organization B
        │       ├── Student Persona
        │       └── Parent Persona
        │
        └── Platform Role Assignment（獨立治理 scope）
```

### 2.1 Authentication Account

- 目的：驗證 credential、provider identity、session、MFA／re-auth assurance 與登入安全狀態。
- Authority：Authentication provider／Identity security boundary。
- 不保存：Organization role、教學角色、學生身分、教材所有權或 Platform 授權細節。
- Account suspension 影響登入能力，但不得直接刪除 Profile、Membership、Persona、教材或歷程。
- 現況的 `auth.users.id` 是登入 principal reference，不等於完整 Person identity。

### 2.2 Person Profile

- 目的：保存人類可理解且最小化的個人資料、語言、時區與顯示偏好。
- Authority：Identity Domain。
- 一個 Person 概念上可以有一個主要 Profile；未來 provider 合併、監護代理或資料修復不能只靠 email 自動合併。
- Profile 不保存 Organization role、Platform role 或領域狀態。
- Profile anonymization 與 Authentication Account deletion 是兩個不同 transition。

### 2.3 Organization Membership

- 目的：表達 Account／Person 與 Organization 的租戶關係、membership state 與 Organization-level role assignment。
- Authority：Membership Domain；Organization Domain 擁有 tenant，不直接擁有個人 Profile。
- 同一 Account 可以有多筆 Membership；active organization 只是工作 context，不改變其他 Membership。
- Membership removal 不刪除 Account、Profile、Persona 的歷史 reference 或 Organization-owned content。
- 現有 `organization_members.role` 是 Sprint 6 相容模型；完整 permission policy 由 AP-003 定義，不能被視為最終 RBAC。

### 2.4 Domain Persona

- Persona 是某個 Person 在特定 Organization 與 Domain 中的業務身分，不等於登入帳號或 Membership role。
- Teacher Persona：教學資格、教學偏好、任課與歷史 actor。
- Student Persona：學習者狀態、Enrollment、學習與評量 reference。
- Parent／Guardian Persona：監護／聯絡關係及 consent scope，不自動擁有學生全部資料。
- Reviewer Persona：教材／品質審核能力與 assignment，不等同 Organization Admin。
- 同一人可在同一 Organization 有多個 Persona，也可跨 Organization 具有不同 Persona；授權必須同時驗證 Account、Membership、Persona、resource scope 與 policy。
- Persona 的建立、停用、匿名化及歷史顯示由各 owning Domain 管理；本 Amendment 不建 Persona table。

### 2.5 Platform Role Assignment

- 目的：授予 Platform governance 工作能力，不代表 Organization Membership。
- Authority：Platform Governance／Permission Domain。
- 必須具有效期、assignment source、reason、scope、assurance 與 Audit；高風險能力採 JIT／case-scoped capability。
- Platform Role 不可轉換成 Organization Owner，也不可直接作為跨租戶 RLS bypass。
- AI Agent、job、integration principal 不是 Platform Role；它們只能消費受控、一次性、最小範圍 capability。

### 2.6 Identity 不變量

1. Account、Profile、Membership、Persona、Platform Role 各有獨立 lifecycle 與 authority。
2. Authentication success 不代表任何 Organization 或 Platform permission。
3. Active organization 是 request context，不是永久角色。
4. 一個人可跨機構、多角色、多 Persona；不得以單一全域 role 欄位表達。
5. Account deletion 前必須解析所有 Membership、唯一 Owner、Persona、holds、歷史 actor 與資料所有權。
6. Organization-owned content 不因建立者 Account 或 Membership 終止而消失。
7. Analytics 與 AI 只能消費最小化、目的限定的 Persona／Domain projection，不得把 Profile 或 role table 當完整上下文。

## 3. Domain Ownership Model

| Domain            | Domain Purpose                                               | Domain Owner（Accountable）            | Authority Data                                      | Primary Entities                                      |
| ----------------- | ------------------------------------------------------------ | -------------------------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| Platform          | 產品 shell、全域營運邊界與平台設定                           | Platform Product／Platform Engineering | platform configuration、service health              | platform configuration、service registry              |
| Identity          | 登入 principal、Profile、session assurance、privacy identity | Security／Identity Engineering         | authentication reference、Person Profile、assurance | Authentication Account reference、Person Profile      |
| Permission        | policy、role/capability evaluation，不持有業務資料           | Security／Authorization Engineering    | policy version、assignment、decision                | policy、role assignment、capability、decision         |
| Organization      | Tenant、機構狀態與基本資料                                   | Organization Product／Engineering      | Organization aggregate                              | Organization                                          |
| Membership        | 人與 Organization 的關係與 tenant role                       | Organization Access Engineering        | Membership state／role relationship                 | Membership、Ownership Transfer                        |
| Knowledge         | 教育知識語意、Knowledge Point 與 provenance                  | Curriculum／Academic Governance        | Knowledge Point、relationship、source provenance    | Knowledge Point、Knowledge Source                     |
| Curriculum        | 課程編排、Reference mapping、Version、Chapter、Lesson        | Curriculum Product／Engineering        | Curriculum hierarchy／version                       | Curriculum、Version、Chapter、Lesson、Reference       |
| Teaching          | 教師執行教學與課堂歷程                                       | Teaching Workspace Product             | Teacher Persona、Session、Teaching History          | Teacher Persona、Teaching Session、Teaching History   |
| Assessment        | 題目、評量、作答與評分規則                                   | Assessment Product／Academic Quality   | Question、Assessment、Attempt、Response             | Question、Worksheet、Assessment、Attempt、Response    |
| Learning          | 學習者、Enrollment、學習事件與能力狀態                       | Learning Product／Privacy              | Student／Guardian Persona、Learning Event/History   | Student、Guardian、Enrollment、Learning Event/History |
| AI                | 模型工作編排、Prompt／schema／usage provenance               | AI Platform／AI Safety                 | AI Job、Generation、model/prompt/schema version     | AI Job、AI Generation、AI Review Result               |
| Analytics         | 指標語意、聚合、報告與決策 projection                        | Data／Analytics                        | metric definition、derived projection               | Metric、Snapshot、Report、Dashboard projection        |
| Communication     | 通知、template、channel delivery 與 preference               | Communication Platform                 | notification intent、delivery state                 | Notification、Template、Delivery                      |
| Billing           | 方案、訂閱、付款與發票                                       | Finance Product／Billing Engineering   | Subscription、Invoice、ledger                       | Plan、Subscription、Invoice、Ledger Entry             |
| Governance／Audit | lifecycle request、retention、hold、Audit 與 deletion review | Security／Compliance                   | lifecycle request、policy snapshot、immutable Audit | Lifecycle Request、Retention Hold、Audit Event        |

Domain Owner 是產品與工程責任，不代表能繞過資料權限或人工核准。

## 4. RACI

角色：PO = Product Owner、SEC = Security/Privacy、DOM = Domain Engineering、DATA = Data/Analytics、OPS = Platform Operations、LEGAL = Legal/Compliance。

| 決策／責任                               | PO  | SEC | DOM | DATA | OPS | LEGAL |
| ---------------------------------------- | --- | --- | --- | ---- | --- | ----- |
| Domain invariant／authority schema       | C   | C   | A/R | I    | I   | C     |
| Identity linking／account assurance      | C   | A   | R   | I    | C   | C     |
| Organization／Membership lifecycle       | A   | C   | R   | I    | C   | C     |
| Knowledge／Curriculum semantic contract  | A   | C   | R   | C    | I   | C     |
| Teaching／Learning／Assessment retention | C   | C   | R   | C    | I   | A     |
| Permission policy／Platform capability   | C   | A/R | C   | I    | C   | C     |
| Event schema ownership                   | C   | C   | A/R | C    | I   | I     |
| Audit metadata allowlist                 | I   | A   | C   | C    | R   | C     |
| Analytics metric definition              | A   | C   | C   | R    | I   | C     |
| Permanent deletion approval policy       | C   | A   | C   | I    | R   | A     |
| AI context allowlist／safety             | C   | A   | C   | C    | I   | C     |

每項實作仍需具體 role／permission；RACI 不授權任何使用者存取資料。

## 5. Allowed Dependencies

```text
Identity ──publishes identity reference/assurance──▶ Permission, Membership
Organization ──publishes tenant/lifecycle contract──▶ Membership, Curriculum, Billing
Membership ──publishes scoped access facts──▶ Permission, Workspace Domains
Knowledge ──publishes knowledge contracts──▶ Curriculum, Teaching, Assessment, AI
Curriculum ──publishes immutable version references──▶ Teaching, Assessment, AI
Teaching ──publishes teaching events──▶ Learning, Analytics, Communication
Assessment ──publishes result events──▶ Learning, Analytics, Communication
Learning ──publishes minimized learning events──▶ Analytics, Communication, AI
AI ──publishes generation outcomes──▶ owning requester Domain, Analytics, Audit
Billing ──publishes entitlement facts──▶ Permission/Platform; not education content
All Domains ──publish allowlisted events──▶ Governance/Audit and Analytics
```

- 同步 authorization 可以讀取 Identity assurance、Permission decision、Organization／Membership facts。
- 業務 Domain 只能透過 published contract 取得其他 Domain 的 ID、狀態或 projection，不直接修改對方資料表。
- Analytics、Communication 與 AI 是 consumer；不能反向成為 source-of-truth。

## 6. Forbidden Dependencies

1. Identity 不得依賴 Curriculum、Teaching、Learning、Assessment 或 Billing 內容才能驗證登入。
2. Profile 不得保存 Organization role、Platform role、Student score 或 Teacher assignment。
3. Organization/Membership 不得直接修改 Account credential、Persona 歷程或教材內容。
4. Curriculum 不得依賴 AI generation、Analytics projection、Notification delivery 或 legacy Publisher identity 作 authority。
5. Knowledge 不得依賴 Curriculum／Lesson 實例；Reference 只能 mapping Knowledge Point。
6. Teaching、Assessment 與 Learning 不得直接更新 Knowledge Point 或已發布 Curriculum Version。
7. AI 不得直接寫入 Knowledge、Curriculum、Assessment、Learning canonical table；只能回傳經 schema/quality gate 的 proposal 給 owning Domain。
8. Analytics 不得回寫原始事件、分數、Persona、Membership 或 lifecycle state。
9. Communication 不得決定 permission、retention、assessment result 或 lifecycle transition。
10. Billing entitlement 不得授予 Platform Admin 或跨租戶教育內容存取。
11. Platform Console 不得使用 active organization impersonation 或 Service Role 作日常存取。
12. Event consumer 不得以 event payload 取代 owning Domain 的 authoritative query 來執行不可逆操作。

## 7. Published and Consumed Contracts

| Domain            | Published Contracts                                                               | Consumed Contracts                                        |
| ----------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Identity          | `IdentityReference`, `SessionAssurance`, `ProfileDisplayProjection`               | privacy/retention decision                                |
| Permission        | `AuthorizationDecision`, `ScopedCapability`                                       | identity assurance、membership facts、platform assignment |
| Organization      | `OrganizationReference`, `OrganizationLifecycleProjection`                        | identity reference、governance decision                   |
| Membership        | `MembershipAccessFact`, `PersonaLinkReference`                                    | identity、organization、permission policy                 |
| Knowledge         | `KnowledgePointContract`, `KnowledgeSourceReference`                              | provenance governance only                                |
| Curriculum        | `CurriculumVersionContract`, `LessonLearningContract`, `ReferenceDisplayContract` | organization scope、knowledge contracts                   |
| Teaching          | `TeachingSessionResult`, teaching events                                          | identity/persona、curriculum、knowledge                   |
| Assessment        | `AssessmentContract`, `AssessmentResult`                                          | curriculum、knowledge、learning subject reference         |
| Learning          | `LearningProgressProjection`, learning events                                     | identity/persona、teaching、assessment                    |
| AI                | `GenerationResult`, `QualityReviewResult`, `UsageRecord`                          | allowlisted knowledge/curriculum/task context             |
| Analytics         | `MetricDefinition`, `DecisionProjection`                                          | versioned events and minimized dimensions                 |
| Communication     | `DeliveryResult`                                                                  | notification intent、preference、recipient projection     |
| Billing           | `EntitlementDecision`, `BillingStatusProjection`                                  | organization/account billing reference                    |
| Governance／Audit | `LifecycleDecision`, `RetentionDecision`, `AuditReceipt`                          | lifecycle requests、allowlisted domain events             |

Contract 必須版本化；Internal DB row、PII-rich object 或 Service Role response 不得作 published contract。

## 8. Event Ownership

- 只有完成 canonical transaction 的 owning Domain 可以發布 past-tense Domain Event。
- Request／Command 不是完成事件；必須使用不同名稱與 policy。
- Event Catalog 是事件名稱、版本、payload allowlist、ordering、retry 與 Audit 的唯一設計來源。
- Event Bus／Queue 尚未實作；目前事件只是一份 future contract，不可宣稱具備非同步保證。
- Governance／Audit 可以記錄 lifecycle request/result，但不能偽造其他 Domain 的業務事件。

完整目錄見 `docs/architecture/event-catalog.md`。

## 9. Data Ownership

- Owning Domain 是 canonical row、schema invariant、資料品質、lifecycle 與 retention classification 的唯一責任方；Database schema owner 不等於能繞過產品權限的使用者。
- 其他 Domain 只能保存必要 reference、版本化 snapshot 或 derived projection，不能複製整份 authority row 作第二個 source-of-truth。
- Organization scope 必須由 owning Domain 的 tenant relationship 決定；Consumer 不能從 payload 或 client 輸入自行改寫 scope。
- Person／Persona reference 採 internal opaque ID；Profile PII 仍由 Identity 管理，Analytics、AI、Communication 與 Audit 只取得目的限定 projection。
- Derived Analytics 可以被重新建立；它不得成為 Membership、Assessment result、Learning History 或 lifecycle 的 authority。
- AI output 在 requesting Domain 接受、驗證並形成新 canonical version 前，只是 proposal；AI Domain 擁有 generation provenance，不擁有教材、知識或學習紀錄。
- Account／Persona anonymization 後，Organization-owned content 保留 ownership；歷史 actor 使用不可逆 tombstone reference 維持鏈結。

## 10. Lifecycle、Audit、Analytics 與 AI 責任

| Concern   | Owning responsibility                                                  | Domain responsibility                                                      |
| --------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Lifecycle | Domain 定義合法 state/invariant；Governance 編排 request/approval/hold | Domain transaction 寫 canonical state，禁止 generic 任意更新               |
| Audit     | Governance 定義 append-only envelope、allowlist、retention             | 每個 Domain 標示高風險 action、reason 與業務 reference                     |
| Analytics | Analytics 定義 metric／projection／lineage                             | Owning Domain 發布版本化、最小化事件，不接受 Analytics 回寫                |
| AI        | AI Domain 管 provider、job、prompt、schema、usage、safety              | Owning Domain 決定 context allowlist、驗證、接受／拒絕 proposal 與最終寫入 |

Audit foundation 必須先於任何新的 lifecycle write flow；沒有可用的 append-only Audit writer，不得開放 suspend、archive、trash、anonymize 或 deletion request。

## 11. AP-003 Handoff

AP-003 Identity／RBAC 至少必須定義：

- Account／Person linking 與 assurance level。
- Organization role、Persona permission 與 Platform role assignment 分離。
- Policy decision contract、resource/action/scope naming。
- JIT case-scoped capability、re-auth freshness、separation of duties。
- Role revocation、Membership state change 與 session invalidation semantics。
- Actor／Persona／tombstone reference 及 PII access rules。

AP-003 未完成前，AP-002 不得實作 Platform role assignment、高風險跨租戶查閱、Account lifecycle、ownership override、永久刪除核准或可變更 Platform role 的 Console。

## 12. 結果

此 ADR 建立概念與 Domain 契約，不改變 Sprint 1～8 schema。現有 `auth.users`、`profiles`、`organization_members` 與 user preference 保持相容；未來實作只能 additive，不能將現況欄位誤宣稱為完整 Identity／RBAC／Persona framework。
