export type CurriculumErrorCode =
  | "not_authenticated"
  | "organization_required"
  | "forbidden"
  | "ai_generation_failed"
  | "ai_provider_unavailable"
  | "not_found"
  | "duplicate_name"
  | "copyright_blocked"
  | "hierarchy_conflict"
  | "invalid_input"
  | "invalid_ai_generation"
  | "already_deleted"
  | "not_deleted"
  | "archive_not_allowed"
  | "delete_not_allowed"
  | "restore_not_allowed"
  | "restore_name_conflict"
  | "permanent_delete_not_allowed"
  | "retention_blocked"
  | "legal_hold_blocked"
  | "dependency_blocked"
  | "service_unavailable";

const curriculumErrorMessages: Record<CurriculumErrorCode, string> = {
  not_authenticated: "請先登入後再管理教材。",
  organization_required: "請先選擇可使用的機構。",
  forbidden: "你的機構角色沒有管理教材的權限。",
  ai_generation_failed: "AI 教材生成暫時失敗，請稍後再試。",
  ai_provider_unavailable: "AI 服務尚未設定或暫時不可用。",
  not_found: "找不到這份教材，或你沒有查看權限。",
  duplicate_name: "目前機構已有相同名稱的教材，請更換名稱。",
  copyright_blocked:
    "輸入或輸出含有不可使用的教材來源或出版社相關內容，系統已停止處理。",
  hierarchy_conflict: "章節或課次的編號重複，請調整後再試。",
  invalid_input: "教材資料格式不正確。",
  invalid_ai_generation: "AI 生成結果未通過教材結構或知識點檢核。",
  already_deleted: "這份教材已在回收桶中。",
  not_deleted: "這份教材不在回收桶中。",
  archive_not_allowed: "目前無法封存這份教材。",
  delete_not_allowed: "使用中的教材需先封存，才能移入回收桶。",
  restore_not_allowed: "目前無法還原這份教材。",
  restore_name_conflict:
    "目前已有同名教材正在使用中，請先更名或永久刪除其中一份後再還原。",
  permanent_delete_not_allowed: "目前無法永久刪除這份教材。",
  retention_blocked: "這份教材仍受保留政策保護，暫時不能永久刪除。",
  legal_hold_blocked: "這份教材仍有法務保留，暫時不能永久刪除。",
  dependency_blocked: "這份教材已有受保護相依資料，暫時不能永久刪除。",
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
    case "copyright_blocked":
      return 422;
    case "not_found":
      return 404;
    case "duplicate_name":
    case "hierarchy_conflict":
    case "already_deleted":
    case "not_deleted":
    case "archive_not_allowed":
    case "delete_not_allowed":
    case "restore_not_allowed":
    case "restore_name_conflict":
    case "permanent_delete_not_allowed":
    case "retention_blocked":
    case "legal_hold_blocked":
    case "dependency_blocked":
      return 409;
    case "invalid_input":
    case "invalid_ai_generation":
      return 400;
    case "ai_provider_unavailable":
    case "ai_generation_failed":
    case "service_unavailable":
      return 503;
  }
}
