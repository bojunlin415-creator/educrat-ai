import { getSafeAuthErrorMessage } from "./errors";

describe("getSafeAuthErrorMessage", () => {
  it("maps known auth errors to a useful message", () => {
    expect(getSafeAuthErrorMessage({ code: "invalid_credentials" })).toBe(
      "電子郵件或密碼不正確。",
    );
  });

  it("does not expose unknown provider details", () => {
    expect(getSafeAuthErrorMessage({ code: "internal_secret_detail" })).toBe(
      "驗證服務暫時無法完成要求。",
    );
  });
});
