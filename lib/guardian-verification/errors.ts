export type GuardianVerificationErrorCode =
  | "email_mismatch"
  | "expired"
  | "forbidden"
  | "invalid_consent"
  | "invalid_input"
  | "not_authenticated"
  | "not_found"
  | "organization_required"
  | "role_conflict"
  | "service_unavailable";

const MESSAGES: Record<GuardianVerificationErrorCode, string> = {
  email_mismatch: "請使用受邀請的 Email 帳號登入後再接受邀請。",
  expired: "此家長邀請已失效，請聯絡機構重新建立邀請。",
  forbidden: "你沒有權限處理這份家長邀請。",
  invalid_consent: "請先同意家長入口資料使用聲明。",
  invalid_input: "家長驗證資料格式不正確。",
  not_authenticated: "請先登入。",
  not_found: "找不到可使用的家長邀請。",
  organization_required: "請先選擇有效機構。",
  role_conflict: "此帳號在該機構已有其他角色，暫時無法同時啟用家長角色。",
  service_unavailable: "目前無法處理家長驗證，請稍後再試。",
};

export class GuardianVerificationError extends Error {
  constructor(readonly code: GuardianVerificationErrorCode) {
    super(MESSAGES[code]);
    this.name = "GuardianVerificationError";
  }
}

export function getGuardianVerificationErrorStatus(
  error: GuardianVerificationError,
): number {
  switch (error.code) {
    case "not_authenticated":
      return 401;
    case "email_mismatch":
    case "forbidden":
    case "role_conflict":
      return 403;
    case "not_found":
      return 404;
    case "invalid_consent":
    case "invalid_input":
      return 422;
    case "organization_required":
      return 409;
    case "expired":
      return 410;
    case "service_unavailable":
      return 503;
  }
}
