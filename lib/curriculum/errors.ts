export type CurriculumErrorCode =
  | "not_authenticated"
  | "organization_required"
  | "forbidden"
  | "not_found"
  | "duplicate_name"
  | "hierarchy_conflict"
  | "invalid_input"
  | "service_unavailable";

const curriculumErrorMessages: Record<CurriculumErrorCode, string> = {
  not_authenticated: "請先登入後再管理教材。",
  organization_required: "請先選擇可使用的機構。",
  forbidden: "你的機構角色沒有管理教材的權限。",
  not_found: "找不到這份教材，或你沒有查看權限。",
  duplicate_name: "目前機構已有相同名稱的教材，請更換名稱。",
  hierarchy_conflict: "章節或課次的編號重複，請調整後再試。",
  invalid_input: "教材資料格式不正確。",
  service_unavailable: "目前無法處理教材資料，請稍後再試。",
};

export class CurriculumError extends Error {
  readonly code: CurriculumErrorCode;

  constructor(code: CurriculumErrorCode) {
    super(curriculumErrorMessages[code]);
    this.name = "CurriculumError";
    this.code = code;
  }
}

export function getCurriculumErrorStatus(error: CurriculumError): number {
  switch (error.code) {
    case "not_authenticated":
      return 401;
    case "organization_required":
      return 409;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "duplicate_name":
    case "hierarchy_conflict":
      return 409;
    case "invalid_input":
      return 400;
    case "service_unavailable":
      return 503;
  }
}
