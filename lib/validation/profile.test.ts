import { profileSchema } from "./profile";

describe("profileSchema", () => {
  it("accepts and normalizes a supported profile", () => {
    const result = profileSchema.safeParse({
      displayName: "  林老師  ",
      locale: "zh-TW",
      phone: " 0912-345-678 ",
      timezone: "Asia/Taipei",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe("林老師");
      expect(result.data.phone).toBe("0912-345-678");
    }
  });

  it("allows an empty optional phone", () => {
    expect(
      profileSchema.safeParse({
        displayName: "王老師",
        locale: "zh-TW",
        phone: "",
        timezone: "Asia/Taipei",
      }).success,
    ).toBe(true);
  });

  it.each([
    ["empty name", { displayName: "" }],
    ["unsupported locale", { locale: "fr-FR" }],
    ["unsupported timezone", { timezone: "Mars/Taipei" }],
    ["invalid phone", { phone: "call-me" }],
  ])("rejects %s", (_label, override) => {
    const result = profileSchema.safeParse({
      displayName: "林老師",
      locale: "zh-TW",
      phone: "0912345678",
      timezone: "Asia/Taipei",
      ...override,
    });

    expect(result.success).toBe(false);
  });
});
