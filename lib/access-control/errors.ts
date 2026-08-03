export type AccessControlErrorCode =
  | "forbidden"
  | "invalid_input"
  | "last_owner"
  | "not_authenticated"
  | "not_found"
  | "organization_required"
  | "role_conflict"
  | "service_unavailable";

const ACCESS_CONTROL_ERROR_MESSAGES: Record<AccessControlErrorCode, string> = {
  forbidden: "你沒有權限管理此機構的存取設定。",
  invalid_input: "存取管理資料格式不正確。",
  last_owner: "機構必須保留至少一位啟用中的擁有者。",
  not_authenticated: "請先登入。",
  not_found: "找不到指定的成員或關係。",
  organization_required: "請先選擇有效機構。",
  role_conflict: "目前角色狀態不允許此異動。",
  service_unavailable: "目前無法處理存取管理，請稍後再試。",
};

export class AccessControlError extends Error {
  readonly code: AccessControlErrorCode;

  constructor(code: AccessControlErrorCode) {
    super(ACCESS_CONTROL_ERROR_MESSAGES[code]);
    this.name = "AccessControlError";
    this.code = code;
  }
}

export function getAccessControlErrorStatus(error: AccessControlError): number {
  switch (error.code) {
    case "not_authenticated":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "organization_required":
    case "last_owner":
    case "role_conflict":
      return 409;
    case "invalid_input":
      return 422;
    case "service_unavailable":
      return 503;
  }
}
