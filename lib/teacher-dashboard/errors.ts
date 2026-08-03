export type TeacherDashboardErrorCode =
  | "forbidden"
  | "invalid_input"
  | "not_authenticated"
  | "not_found"
  | "organization_required"
  | "service_unavailable";

const TEACHER_DASHBOARD_ERROR_MESSAGES: Record<
  TeacherDashboardErrorCode,
  string
> = {
  forbidden: "你沒有權限查看教師儀表板。",
  invalid_input: "教師儀表板查詢格式不正確。",
  not_authenticated: "請先登入。",
  not_found: "找不到指定的教師儀表板資料。",
  organization_required: "請先選擇有效機構。",
  service_unavailable: "目前無法載入教師儀表板，請稍後再試。",
};

export class TeacherDashboardError extends Error {
  constructor(
    readonly code: TeacherDashboardErrorCode,
    readonly referenceId?: string,
  ) {
    super(TEACHER_DASHBOARD_ERROR_MESSAGES[code]);
    this.name = "TeacherDashboardError";
  }
}

export function getTeacherDashboardErrorStatus(
  error: TeacherDashboardError,
): number {
  switch (error.code) {
    case "not_authenticated":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "invalid_input":
      return 422;
    case "organization_required":
      return 409;
    case "service_unavailable":
      return 503;
  }
}
