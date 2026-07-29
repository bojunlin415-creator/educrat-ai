export type AssignmentErrorCode =
  | "not_authenticated"
  | "organization_required"
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "invalid_curriculum_version"
  | "invalid_assignment_state"
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
  service_unavailable: "目前無法處理派發資料，請稍後再試。",
  submission_locked: "已提交的作答內容不可修改。",
};

export class AssignmentError extends Error {
  readonly code: AssignmentErrorCode;

  constructor(code: AssignmentErrorCode) {
    super(assignmentErrorMessages[code]);
    this.name = "AssignmentError";
    this.code = code;
  }
}

export function getAssignmentErrorStatus(error: AssignmentError): number {
  switch (error.code) {
    case "not_authenticated":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "organization_required":
      return 409;
    case "duplicate_assignment_student":
    case "invalid_assignment_state":
    case "invalid_curriculum_version":
    case "submission_locked":
      return 409;
    case "invalid_input":
      return 400;
    case "service_unavailable":
      return 503;
  }
}
