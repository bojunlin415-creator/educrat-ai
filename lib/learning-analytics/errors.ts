export type LearningAnalyticsErrorCode =
  | "forbidden"
  | "invalid_assignment"
  | "invalid_input"
  | "invalid_student_assignment"
  | "invalid_submission"
  | "not_authenticated"
  | "not_found"
  | "organization_required"
  | "service_unavailable";

const LEARNING_ANALYTICS_ERROR_MESSAGES: Record<
  LearningAnalyticsErrorCode,
  string
> = {
  forbidden: "你沒有權限查看或建立這筆學習資料。",
  invalid_assignment: "派發資料不存在或不屬於目前機構。",
  invalid_input: "學習資料格式不正確。",
  invalid_student_assignment: "學生不屬於這份派發。",
  invalid_submission: "作答提交不存在或不屬於目前學生。",
  not_authenticated: "請先登入。",
  not_found: "找不到指定的學習資料。",
  organization_required: "請先選擇有效機構。",
  service_unavailable: "目前無法處理學習分析資料，請稍後再試。",
};

export class LearningAnalyticsError extends Error {
  constructor(readonly code: LearningAnalyticsErrorCode) {
    super(LEARNING_ANALYTICS_ERROR_MESSAGES[code]);
    this.name = "LearningAnalyticsError";
  }
}

export function getLearningAnalyticsErrorStatus(
  error: LearningAnalyticsError,
): number {
  switch (error.code) {
    case "not_authenticated":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "invalid_input":
    case "invalid_assignment":
    case "invalid_student_assignment":
    case "invalid_submission":
      return 422;
    case "organization_required":
      return 409;
    case "service_unavailable":
      return 503;
  }
}
