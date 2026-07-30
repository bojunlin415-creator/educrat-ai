export type ClassroomErrorCode =
  | "not_authenticated"
  | "organization_required"
  | "forbidden"
  | "not_found"
  | "duplicate_code"
  | "invalid_input"
  | "invalid_teacher"
  | "invalid_student"
  | "invalid_class_state"
  | "enrollment_conflict"
  | "service_unavailable";

const classroomErrorMessages: Record<ClassroomErrorCode, string> = {
  duplicate_code: "目前機構已有相同代碼的班級。",
  enrollment_conflict: "學生已在此班級中或狀態不允許異動。",
  forbidden: "你的角色沒有此班級操作權限。",
  invalid_class_state: "目前班級狀態不允許執行此操作。",
  invalid_input: "班級資料格式不正確。",
  invalid_student: "學生必須是同一機構的 active student membership。",
  invalid_teacher: "主要教師必須是同一機構的 active teacher membership。",
  not_authenticated: "請先登入後再管理班級。",
  not_found: "找不到班級資料，或你沒有查看權限。",
  organization_required: "請先選擇可使用的機構。",
  service_unavailable: "目前無法處理班級資料，請稍後再試。",
};

export class ClassroomError extends Error {
  readonly code: ClassroomErrorCode;

  constructor(code: ClassroomErrorCode) {
    super(classroomErrorMessages[code]);
    this.name = "ClassroomError";
    this.code = code;
  }
}

export function getClassroomErrorStatus(error: ClassroomError): number {
  switch (error.code) {
    case "not_authenticated":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "organization_required":
      return 409;
    case "duplicate_code":
    case "enrollment_conflict":
    case "invalid_class_state":
    case "invalid_student":
    case "invalid_teacher":
      return 409;
    case "invalid_input":
      return 400;
    case "service_unavailable":
      return 503;
  }
}
