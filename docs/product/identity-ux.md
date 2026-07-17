# Identity UX Architecture

狀態：**Approved Architecture Baseline — Not Implemented**
交付：文字 wireframe／流程；沒有建立 UI 或 route

## 1. UX principles

- 「登入方式」、「個人資料」、「所屬機構」、「教育身份」與「平台權限」使用不同區塊與文案。
- Organization／Persona switch不是重新登入；切換後 server仍重新驗證 Membership與 scope。
- 不向使用者顯示可用於枚舉的 Account／Person／Student internal ID。
- 高風險 link/merge/claim先顯示影響、要求重新驗證，衝突進人工 review。
- 未成年與 Guardian畫面預設遮罩，不顯示其他 Guardian私密資訊。
- loading時禁止重複提交；成功後顯示持續狀態，不只短暫 toast；錯誤依原因安全區分。

## 2. Account settings

```text
Account settings
├─ Profile
│  ├─ Display name / Avatar
│  ├─ Locale / Timezone
│  └─ Accessibility preferences
├─ Login methods
│  ├─ Email / Password        [Active]
│  ├─ Google                  [Connected]
│  └─ Add another method      [Future]
├─ Security
│  ├─ Sessions
│  ├─ Recovery
│  └─ MFA                     [Future]
├─ Data and privacy
│  ├─ Export request
│  └─ Correction request
└─ Danger zone
   └─ Request account deletion
```

Login method row只描述 provider與安全狀態，不顯示 provider subject/token。Profile修改不能影響登入方法、Membership或Role。

## 3. Organization／Persona switcher

```text
[Organization: 星光學苑 ▾]
[Workspace: Teacher ▾]  [Role summary: Owner + Teacher]

Switch organization
  星光學苑 — Teacher / Parent
  晨光學校 — Teacher

Switch workspace
  Teacher workspace
  Parent workspace
```

- Organization、Persona／Workspace與Role summary分層呈現。
- 切換不顯示「重新登入」；若 Membership/Persona inactive，顯示具體安全狀態且不洩漏其他機構資料。
- Platform elevated context不放入此一般 switcher；使用獨立入口與明顯 banner。

## 4. Student account claim

```text
1. Organization already manages a Student Persona
2. Admin sends one-time secure invitation
3. Verify student / guardian / consent according to policy
4. Sign in or create Account
5. Preview: "Connect to existing student record"
6. Confirm link
7. Result: existing Learning History retained, no duplicate created
```

外部流程使用 opaque claim token，不把 Student ID放在可猜測網址。若已連 Account、邀請過期、關係未驗證或存在 Person conflict，停止並給安全處理方式。

## 5. Parent account link

```text
Guardian access
├─ Verified relationships
│  ├─ Student A — reports + communication
│  └─ Student B — communication only
├─ Pending verification
└─ Consent / notification preferences
```

只顯示目前 Guardian可見範圍；不顯示其他 Guardian姓名、email、電話、法律狀態或其 consent設定。

## 6. Account linking／merge review

```text
Connect login method
1. Show current method and target method
2. Re-authenticate both identities
3. Show affected Profile / Organizations / Personas summary
4. Confirm simple link OR enter conflict review
5. Return persistent result and recovery path
```

- 簡單 link只連 Auth Identity/Account，不默默合併兩個 Person graph。
- 有 Ownership、Student、Guardian、Platform role、重複 Membership或不同 Person資料時，按鈕改為「送出身份衝突審查」，不能一鍵 merge。

## 7. Elevated platform identity indicator

```text
┌──────────────────────────────────────────────────────────────┐
│ Elevated platform access · Case CS-… · Organization …       │
│ Read-only / masked · Expires in 18 min              [Exit]   │
└──────────────────────────────────────────────────────────────┘
```

- Banner不可關閉後仍保持隱形 elevated context。
- 顯示 case、Organization、能力摘要、遮罩／唯讀狀態、到期時間與 Exit。
- 不在 AP-003A實作；CASE policy與 role由 AP-003B，Audit由 AP-002B。

## 8. State and accessibility requirements

- Empty：沒有其他 Persona／Organization時仍顯示目前 context與說明。
- Loading：保留焦點與 aria-busy，禁止重複提交。
- Error：區分 session失效、Membership inactive、Persona inactive、relationship未驗證、link conflict與 review required；不暴露存在性。
- Success：顯示已連結對象的安全摘要、時間與下一步。
- Keyboard：所有 switcher、dialog、stepper、banner Exit可鍵盤操作；focus trap／return focus正確。
- Screen reader：狀態不能只靠顏色；每個高風險影響與驗證錯誤具可讀 label。

## 9. Deferred

真正 route、component、re-auth、MFA、Invite、claim token、Guardian verification、Platform console、Permission-aware menu與 analytics都不屬 AP-003A。
