export type LearnerConvergenceErrorCode =
  | "forbidden"
  | "inactive_context"
  | "invalid_snapshot"
  | "not_authenticated"
  | "service_unavailable";

const messages: Readonly<Record<LearnerConvergenceErrorCode, string>> =
  Object.freeze({
    forbidden: "目前帳號沒有檢視學習者一致性資料的權限。",
    inactive_context: "目前沒有有效的機構與成員關係。",
    invalid_snapshot: "學習者一致性資料格式不正確。",
    not_authenticated: "請先登入。",
    service_unavailable: "目前無法解析學習者身分，請稍後再試。",
  });

export class LearnerConvergenceError extends Error {
  readonly code: LearnerConvergenceErrorCode;

  constructor(code: LearnerConvergenceErrorCode, options?: ErrorOptions) {
    super(messages[code], options);
    this.code = code;
    this.name = "LearnerConvergenceError";
  }
}
