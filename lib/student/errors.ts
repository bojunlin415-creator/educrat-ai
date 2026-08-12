export type StudentErrorCode =
  | "duplicate_student_no"
  | "forbidden"
  | "invalid_input"
  | "invalid_student_state"
  | "membership_conflict"
  | "not_authenticated"
  | "not_found"
  | "organization_required"
  | "service_unavailable";

const messages: Record<StudentErrorCode, string> = {
  duplicate_student_no: "目前機構已有相同學號的學生。",
  forbidden: "你的角色沒有此學生資料操作權限。",
  invalid_input: "學生資料格式不正確。",
  invalid_student_state: "目前學生狀態不允許執行此操作。",
  membership_conflict: "學生已在此班級中。",
  not_authenticated: "請先登入後再管理學生。",
  not_found: "找不到學生資料，或你沒有查看權限。",
  organization_required: "請先選擇可使用的機構。",
  service_unavailable: "目前無法處理學生資料，請稍後再試。",
};

export class StudentError extends Error {
  readonly code: StudentErrorCode;
  constructor(code: StudentErrorCode, options?: ErrorOptions) {
    super(messages[code], options);
    this.code = code;
    this.name = "StudentError";
  }
}

export function getStudentErrorStatus(error: StudentError) {
  switch (error.code) {
    case "not_authenticated":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "duplicate_student_no":
    case "invalid_student_state":
    case "membership_conflict":
    case "organization_required":
      return 409;
    case "invalid_input":
      return 400;
    case "service_unavailable":
      return 503;
  }
}
