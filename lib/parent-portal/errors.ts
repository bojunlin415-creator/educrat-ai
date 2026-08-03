export type ParentPortalErrorCode =
  | "forbidden"
  | "invalid_input"
  | "not_authenticated"
  | "not_found"
  | "organization_required"
  | "service_unavailable";

const PARENT_PORTAL_ERROR_MESSAGES: Record<ParentPortalErrorCode, string> = {
  forbidden: "你沒有權限查看這位學生的家長報表。",
  invalid_input: "家長入口查詢資料格式不正確。",
  not_authenticated: "請先登入。",
  not_found: "找不到可查看的學生資料。",
  organization_required: "請先選擇有效機構。",
  service_unavailable: "目前無法載入家長入口，請稍後再試。",
};

export class ParentPortalError extends Error {
  constructor(readonly code: ParentPortalErrorCode) {
    super(PARENT_PORTAL_ERROR_MESSAGES[code]);
    this.name = "ParentPortalError";
  }
}

export function getParentPortalErrorStatus(error: ParentPortalError): number {
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
