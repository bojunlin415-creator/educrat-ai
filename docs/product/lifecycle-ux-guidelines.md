# Lifecycle & Danger Zone UX Guidelines

- 狀態：**Accepted — Architecture Approved**
- Architecture Package：AP-002
- 適用：Organization、Account、Membership、Curriculum、Recycle Bin、Platform Console

## 1. 共同原則

1. Danger Zone 固定在 Settings 最後一區，與一般 Save 分離。
2. 不使用模糊的「刪除」；按鈕需寫明「封存機構」、「將教材移到回收桶」、「申請永久刪除帳號」。
3. 不能只用紅色表示風險；需有文字、圖示、標題與可存取描述。
4. 顯示影響資料類型與數量，但不洩漏其他租戶或不必要 PII。
5. 優先提供可逆替代方案：Suspend、Archive、Export、Transfer、Restore。
6. Level 1 可逆；Level 2 高風險但可撤銷；Level 3 不可逆且需 re-auth、server challenge 與二次核准。
7. 中高風險要求 reason code；必要時補充 reason text。中高風險需輸入 Entity name；Level 3 需輸入 server 發出的確認文字。
8. Loading 時鎖定同一操作，request 使用 idempotency key。錯誤不顯示 SQL、stack、policy internals 或敏感資料。
9. 成功後進入持久狀態畫面，顯示 request ID、目前狀態、下一步與取消期限；不只顯示 toast。
10. Restore/Undo 只在 server 再次檢查後提供，不能承諾一定可還原。

## 2. 風險層級

| 層級                 | 操作                                                    | 最低 UX 控制                                                            |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| Level 1 可逆         | Suspend、Archive、Move to recycle bin                   | 影響摘要、理由、確認 Dialog、Restore/Undo（適用時）                     |
| Level 2 高風險可撤銷 | Remove member、start deletion wait、transfer ownership  | Entity name、理由、re-auth（敏感情境）、持久狀態頁                      |
| Level 3 不可逆       | Permanent delete、不可逆 PII anonymization、force close | server challenge、fresh re-auth、雙人核准、等待期、final scan、受控 job |

## 3. Organization Closing Wizard

### 3.1 Desktop flow

```text
┌────────────────────────────────────────────────────────────────────┐
│ 關閉機構                                  Step 2 / 6              │
├────────────────────────────────────┬───────────────────────────────┤
│ 主要內容                           │ 固定影響摘要                  │
│                                    │ Active owners          2     │
│ ○ 暫停使用                         │ Active members        18     │
│ ○ 封存機構                         │ Curriculums           12     │
│ ● 申請永久刪除                     │ Chapters              87     │
│                                    │ Lessons              420     │
│ [本步說明／阻擋原因／替代方案]     │ Future dependencies  Pending │
│                                    │ Retention hold       None    │
│ [返回]                    [繼續]    │ [重新整理影響摘要]            │
└────────────────────────────────────┴───────────────────────────────┘
```

右欄在步驟間保持，但每次 final confirmation 前都需重新向 server 取得有效 decision，不使用 client 快取作最終依據。

### 3.2 Mobile flow

```text
┌────────────────────────────┐
│ 關閉機構 · 第 2／6 步      │
│ ────────────────           │
│ 影響摘要                   │
│ Owners 2 · Members 18      │
│ 教材 12 · 課次 420         │
│ [展開全部影響]             │
│                            │
│ 本步表單                   │
│ ...                        │
│                            │
│ [返回]  [繼續]             │
└────────────────────────────┘
```

使用單欄 stepper；footer 不得遮住錯誤訊息或 screen reader live region。長 impact list 收合但不可預設隱藏 blocker。

### 3.3 Steps

1. **目的選擇**：暫停、封存、永久刪除申請為三個獨立 radio/card；顯示可逆性。
2. **影響摘要**：Active owners/members、Curriculum/Chapter/Lesson；Classes/Students/Guardians/Homework/Assessment/Teaching/Learning History、AI jobs、exports、subscription/invoice 標為 future dependency 或未啟用，不建立假數量。
3. **替代方案**：封存、匯出、Owner transfer、暫停方案、聯絡支援。符合情境才顯示 action。
4. **確認**：輸入完整機構名稱、reason code/text、理解聲明；Level 2/3 re-auth。名稱比對由 server 規範化後驗證。
5. **等待期**：顯示 policy version、可取消截止、預計處理日期；期限來自 server policy，不寫死。
6. **結果**：request ID、目前 state、requested by/at、blocked reasons、cancel/support action。

### 3.4 States

- Empty：沒有可關閉的 active Organization，提供返回與切換入口。
- Loading：顯示骨架與「正在盤點相依資料」；不得顯示假 0。
- Error：安全訊息、request ID、重試；保持已輸入但不保留密碼/re-auth token。
- Blocked：每個 blocker 顯示類型、影響、負責方、下一步；不提供繼續刪除。
- Success：顯示 current state、deadline、取消與支援入口。
- Forbidden：解釋只有 Owner 或授權 Platform role 可操作；不顯示危險按鈕。
- Re-auth expired：保存非敏感 wizard state，完成重新驗證後再取得新的 server challenge。
- Cancelled：顯示已回到 ARCHIVED 或政策決定狀態，記錄取消者與時間。

## 4. Account Deletion Wizard

```text
┌─────────────────────────────────────────────────────────────────┐
│ 刪除帳號與個人資料                                              │
├─────────────────────────────────────────────────────────────────┤
│ 這不是「離開機構」。你的帳號目前屬於：                          │
│ • A 機構：唯一 Owner（必須先轉移）                    [處理]    │
│ • B 機構：Teacher Membership                         [查看]    │
│                                                                 │
│ 將保留：依法／合約必要的 Audit、Invoice、Teaching/Learning      │
│ 將匿名化：符合政策的 Profile 與歷史顯示名稱                     │
│ 將刪除：符合條件的 Authentication data                          │
│                                                                 │
│ [下載資料] [改為只離開機構] [繼續刪除審查]                      │
└─────────────────────────────────────────────────────────────────┘
```

流程：scope → ownership/membership inventory → export/transfer → privacy impact → reason/re-auth → grace/review → anonymization → eligible auth deletion → result。未成年人資料必須預留 Guardian/legal representative policy，不讓 Student 單獨完成不符政策的 irreversible action。

## 5. Organization Danger Zone wireframe

```text
機構設定
...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Danger Zone · 高風險操作

[暫停機構]
暫停新增與一般業務寫入，可依政策恢復。                    Level 1

[封存機構]
將主要資料改為唯讀，保留教材與歷程。                      Level 1

[申請永久刪除機構]
進入等待與平台審查；Owner 不能直接永久刪除。              Level 2 → 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 6. Account Danger Zone wireframe

```text
帳號與隱私
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[暫停帳號]   Platform 管理操作；停止登入但保留資料
[封存帳號]   不再日常使用；可依政策恢復
[申請刪除帳號與個人資料]
會先檢查 Owner、Membership、歷程、資料匯出與保留義務
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 7. Curriculum Danger Zone wireframe

```text
教材設定 · 四年級數學
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[封存教材]             可還原；學生與教學歷程保持有效
[移到回收桶]           只限無受保護下游相依的教材
[申請永久刪除此教材]   顯示 Version/Chapter/Lesson/History impact
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

已發布版本不顯示 permanent-delete action，只顯示 retired/superseded 說明。

## 8. Member action menu

```text
陳老師 · Teacher · ACTIVE                      [更多 ▾]
                                                   變更角色
                                                   暫停 Membership
                                                   封存 Membership
                                                   移出機構
                                                   ───────────
                                                   轉移 Ownership（符合時）
```

最後一位 Owner 的 suspend/downgrade/remove/leave action 不可用，並顯示「請先轉移 Ownership」。Menu 隱藏不能取代 server enforcement。

## 9. Recycle Bin wireframe

```text
回收桶
┌────────────┬─────────────┬───────────┬─────────────┬──────────┐
│ 項目       │ 原位置      │ 移入者    │ 還原期限    │ 狀態     │
├────────────┼─────────────┼───────────┼─────────────┼──────────┤
│ 分數教材   │ 教材庫/數學 │ 王老師    │ 依政策顯示  │ 可還原   │
│ 第三課     │ .../第二章  │ 管理員    │ 依政策顯示  │ 父層封存 │
└────────────┴─────────────┴───────────┴─────────────┴──────────┘
[篩選 Entity] [只看可還原] [狀態] [日期]

選取項目：影響摘要 / [還原] / [申請永久刪除]
```

永久刪除禁止 bulk；Restore 重新驗證名稱、父層、權限、hold 與 dependency。

## 10. Platform Admin permanent-delete review wireframe

```text
Deletion Request DR-2026-000123                   READY FOR REVIEW
┌─────────────────────────────┬──────────────────────────────────┐
│ Request                     │ Approval                         │
│ Organization: org_...       │ [ ] Dependency final scan       │
│ Submitted by: actor ref     │ [ ] Export requirement complete │
│ Policy: RET-ORG v3          │ [ ] No legal/support hold        │
│ Grace ends: server time     │ [ ] Re-authenticated             │
│ Impact counts: ...          │                                  │
│ Audit timeline: ...         │ Reason: [required]               │
│                             │ Challenge: [server challenge]    │
│                             │ [Block] [Request changes]        │
│                             │ [Approve controlled job]         │
└─────────────────────────────┴──────────────────────────────────┘
```

核准者不能是原申請人；核准只發放一次性 execution capability，不直接在 HTTP request 內刪除。

## 11. 可存取性

- Wizard 使用正確 heading、ordered step list、`aria-current="step"`。
- Dialog focus trap、初始焦點放在安全選項，Escape 只在尚未進行不可逆 request 時關閉。
- 不自動聚焦 danger confirmation 按鈕。
- Error summary 連到欄位；dynamic result 使用適當 live region，但避免重複朗讀大型 impact list。
- 所有按鈕有可辨識名稱；相同「刪除」按鈕需包含 Entity 名稱。
- 鍵盤可完成所有步驟；觸控目標至少符合專案既有規範。
- 對比、圖示與文字共同傳達 Level；Mobile zoom 及 320px 寬度仍可操作。

## 12. 尚未實作

本文不建立任何頁面、Dialog、route、API、資料表、通知或 background job。所有 wireframe 均為未來 implementation contract。
