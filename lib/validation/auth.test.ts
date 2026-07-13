import {
  authCallbackSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "./auth";

describe("loginSchema", () => {
  it("accepts a valid login payload", () => {
    expect(
      loginSchema.safeParse({
        email: "teacher@example.com",
        password: "password123",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid email and short password", () => {
    expect(
      loginSchema.safeParse({ email: "teacher", password: "123" }).success,
    ).toBe(false);
  });
});

describe("registration and recovery schemas", () => {
  it("requires accepted terms and matching passwords", () => {
    const input = {
      email: "teacher@example.com",
      password: "password123",
      confirmPassword: "different123",
      acceptedTerms: false,
    };
    expect(signupSchema.safeParse(input).success).toBe(false);
    expect(resetPasswordSchema.safeParse(input).success).toBe(false);
  });

  it("only allows known callback destinations", () => {
    expect(
      authCallbackSchema.safeParse({ code: "code", next: "/dashboard" })
        .success,
    ).toBe(true);
    expect(
      authCallbackSchema.safeParse({ code: "code", next: "https://evil.test" })
        .success,
    ).toBe(false);
  });
});
