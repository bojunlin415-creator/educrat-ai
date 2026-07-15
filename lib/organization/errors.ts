export type OrganizationErrorCode =
  | "not_authenticated"
  | "profile_not_completed"
  | "organization_not_found"
  | "not_member"
  | "forbidden"
  | "slug_taken"
  | "invalid_input"
  | "service_unavailable";

const errorMessages: Record<OrganizationErrorCode, string> = {
  not_authenticated: "請先登入後再管理機構。",
  profile_not_completed: "請先完成個人基本資料。",
  organization_not_found: "找不到可使用的機構。",
  not_member: "你目前不是這個機構的有效成員。",
  forbidden: "你沒有執行這項機構操作的權限。",
  slug_taken: "這個網址代稱已被使用，請更換後再試。",
  invalid_input: "機構資料格式不正確。",
  service_unavailable: "目前無法處理機構資料，請稍後再試。",
};

export class OrganizationError extends Error {
  readonly code: OrganizationErrorCode;

  constructor(code: OrganizationErrorCode) {
    super(errorMessages[code]);
    this.name = "OrganizationError";
    this.code = code;
  }
}

export function getOrganizationErrorStatus(error: OrganizationError): number {
  switch (error.code) {
    case "not_authenticated":
      return 401;
    case "profile_not_completed":
      return 409;
    case "organization_not_found":
      return 404;
    case "not_member":
    case "forbidden":
      return 403;
    case "slug_taken":
      return 409;
    case "invalid_input":
      return 400;
    case "service_unavailable":
      return 503;
  }
}
