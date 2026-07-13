interface AuthErrorLike {
  code?: string;
}

const safeMessages: Record<string, string> = {
  invalid_credentials: "電子郵件或密碼不正確。",
  email_not_confirmed: "請先完成電子郵件驗證。",
  email_address_invalid: "電子郵件格式不正確。",
  user_already_exists: "此電子郵件已經註冊。",
  weak_password: "密碼強度不足，請改用更安全的密碼。",
  over_email_send_rate_limit: "驗證信寄送過於頻繁，請稍後再試。",
  over_request_rate_limit: "嘗試次數過多，請稍後再試。",
  same_password: "新密碼不可與目前密碼相同。",
  session_not_found: "驗證連結已失效，請重新申請。",
};

export function getSafeAuthErrorMessage(error: AuthErrorLike): string {
  return error.code
    ? (safeMessages[error.code] ?? "驗證服務暫時無法完成要求。")
    : "驗證服務暫時無法完成要求。";
}
