import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("請輸入有效的電子郵件。"),
  password: z
    .string()
    .min(8, "密碼至少需要 8 個字元。")
    .max(72, "密碼不得超過 72 個字元。"),
});

export type LoginInput = z.infer<typeof loginSchema>;

const passwordSchema = z
  .string()
  .min(8, "密碼至少需要 8 個字元。")
  .max(72, "密碼不得超過 72 個字元。");

export const signupSchema = z
  .object({
    email: z.string().trim().email("請輸入有效的電子郵件。"),
    password: passwordSchema,
    confirmPassword: passwordSchema,
    acceptedTerms: z
      .boolean()
      .refine((accepted) => accepted, "請先同意使用條款與隱私權政策。"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "兩次輸入的密碼不一致。",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("請輸入有效的電子郵件。"),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "兩次輸入的密碼不一致。",
    path: ["confirmPassword"],
  });

export const authCallbackSchema = z.object({
  code: z.string().min(1).max(4096),
  next: z.enum(["/dashboard", "/reset-password"]).default("/dashboard"),
});

export const authApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  redirectTo: z.string().startsWith("/").optional(),
  externalRedirectTo: z.string().url().optional(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AuthApiResponse = z.infer<typeof authApiResponseSchema>;
