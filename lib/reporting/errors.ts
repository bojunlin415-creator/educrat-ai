export type ReportingErrorCode =
  | "forbidden"
  | "invalid_input"
  | "not_authenticated"
  | "not_found"
  | "organization_required"
  | "service_unavailable";

const REPORTING_ERROR_MESSAGES: Record<ReportingErrorCode, string> = {
  forbidden: "你沒有權限查看這份報表。",
  invalid_input: "報表查詢資料格式不正確。",
  not_authenticated: "請先登入。",
  not_found: "找不到指定的報表資料。",
  organization_required: "請先選擇有效機構。",
  service_unavailable: "目前無法產生報表，請稍後再試。",
};

export class ReportingError extends Error {
  constructor(readonly code: ReportingErrorCode) {
    super(REPORTING_ERROR_MESSAGES[code]);
    this.name = "ReportingError";
  }
}

export function getReportingErrorStatus(error: ReportingError): number {
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
