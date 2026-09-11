export type AssignmentErrorCode =
  | "not_authenticated"
  | "organization_required"
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "invalid_curriculum_version"
  | "invalid_assignment_state"
  | "recipient_identity_unavailable"
  | "recipient_not_found"
  | "recipient_conflict"
  | "recipient_persistence_unavailable"
  | "recipient_snapshot_changed"
  | "student_account_link_missing"
  | "student_account_link_inactive"
  | "student_account_link_expired"
  | "student_identity_conflict"
  | "assignment_recipient_not_found"
  | "submission_not_allowed"
  | "submission_identity_unavailable"
  | "cross_tenant_forbidden"
  | "submission_locked"
  | "duplicate_assignment_student"
  | "service_unavailable";

const assignmentErrorMessages: Record<AssignmentErrorCode, string> = {
  duplicate_assignment_student: "學生已在此派發名單中。",
  forbidden: "你的角色沒有此派發操作權限。",
  invalid_assignment_state: "目前派發狀態不允許執行此操作。",
  invalid_curriculum_version: "只能派發已發布且未封存的教材版本。",
  invalid_input: "派發資料格式不正確。",
  not_authenticated: "請先登入後再管理派發。",
  not_found: "找不到派發資料，或你沒有查看權限。",
  organization_required: "請先選擇可使用的機構。",
  recipient_identity_unavailable:
    "班級包含尚無相容派發身分的學生；目前無法建立學生派發名單。",
  recipient_not_found: "找不到可派發的學生，或學生不在目前機構。",
  recipient_conflict: "學生派發身分發生衝突，請重新載入後再試。",
  recipient_persistence_unavailable:
    "目前無法安全建立學生派發名單，請稍後再試。",
  recipient_snapshot_changed: "班級名單已變更，請重新確認派發名單。",
  student_account_link_missing: "此帳號尚未連結可作答的學生身分。",
  student_account_link_inactive: "學生帳號連結目前未啟用。",
  student_account_link_expired: "學生帳號連結已到期。",
  student_identity_conflict: "學生身分連結發生衝突，請聯絡機構管理員。",
  assignment_recipient_not_found: "目前學生不在此派發名單中。",
  submission_not_allowed: "目前派發狀態或開放時間不允許作答。",
  submission_identity_unavailable: "目前無法安全確認學生作答身分。",
  cross_tenant_forbidden: "無法存取其他機構的派發資料。",
  service_unavailable: "目前無法處理派發資料，請稍後再試。",
  submission_locked: "已提交的作答內容不可修改。",
};

export class AssignmentError extends Error {
  readonly code: AssignmentErrorCode;

  constructor(code: AssignmentErrorCode, options?: ErrorOptions) {
    super(assignmentErrorMessages[code], options);
    this.name = "AssignmentError";
    this.code = code;
  }
}

export function getAssignmentErrorStatus(error: AssignmentError): number {
  switch (error.code) {
    case "not_authenticated":
      return 401;
    case "forbidden":
    case "cross_tenant_forbidden":
      return 403;
    case "not_found":
      return 404;
    case "organization_required":
      return 409;
    case "duplicate_assignment_student":
    case "invalid_assignment_state":
    case "invalid_curriculum_version":
    case "recipient_identity_unavailable":
    case "recipient_conflict":
    case "recipient_snapshot_changed":
    case "student_account_link_missing":
    case "student_account_link_inactive":
    case "student_account_link_expired":
    case "student_identity_conflict":
    case "submission_identity_unavailable":
    case "submission_not_allowed":
    case "submission_locked":
      return 409;
    case "assignment_recipient_not_found":
    case "recipient_not_found":
      return 404;
    case "invalid_input":
      return 400;
    case "service_unavailable":
    case "recipient_persistence_unavailable":
      return 503;
  }
}
