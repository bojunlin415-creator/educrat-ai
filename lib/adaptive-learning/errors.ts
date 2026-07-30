export type AdaptiveLearningErrorCode =
  | "analytics_required"
  | "forbidden"
  | "invalid_input"
  | "not_authenticated"
  | "not_found"
  | "organization_required"
  | "service_unavailable";

const ADAPTIVE_LEARNING_ERROR_MESSAGES: Record<
  AdaptiveLearningErrorCode,
  string
> = {
  analytics_required: "尚未有足夠學習分析資料可產生推薦。",
  forbidden: "你沒有權限查看這份學習推薦。",
  invalid_input: "推薦查詢資料格式不正確。",
  not_authenticated: "請先登入。",
  not_found: "找不到指定的學習推薦資料。",
  organization_required: "請先選擇有效機構。",
  service_unavailable: "目前無法處理學習推薦，請稍後再試。",
};

export class AdaptiveLearningError extends Error {
  constructor(readonly code: AdaptiveLearningErrorCode) {
    super(ADAPTIVE_LEARNING_ERROR_MESSAGES[code]);
    this.name = "AdaptiveLearningError";
  }
}

export function getAdaptiveLearningErrorStatus(
  error: AdaptiveLearningError,
): number {
  switch (error.code) {
    case "not_authenticated":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "analytics_required":
    case "invalid_input":
      return 422;
    case "organization_required":
      return 409;
    case "service_unavailable":
      return 503;
  }
}
