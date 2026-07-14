import { z } from "zod";
import { PROFILE_LOCALES, PROFILE_TIMEZONES } from "@/lib/profile/constants";

const localeSchema = z
  .string()
  .refine(
    (value) => PROFILE_LOCALES.some((locale) => locale === value),
    "請選擇支援的語言。",
  );

const timezoneSchema = z
  .string()
  .refine(
    (value) => PROFILE_TIMEZONES.some((timezone) => timezone === value),
    "請選擇支援的時區。",
  );

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "請輸入顯示名稱。")
    .max(80, "顯示名稱不得超過 80 個字元。"),
  phone: z
    .string()
    .trim()
    .max(30, "電話不得超過 30 個字元。")
    .refine(
      (value) => value.length === 0 || value.length >= 6,
      "電話至少需要 6 個字元。",
    )
    .refine(
      (value) => value.length === 0 || /^[0-9+()\-\s]+$/.test(value),
      "電話只能包含數字、空白與 + ( ) -。",
    ),
  locale: localeSchema,
  timezone: timezoneSchema,
});

export const profileApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  redirectTo: z.string().startsWith("/").optional(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
});

export const avatarApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type ProfileApiResponse = z.infer<typeof profileApiResponseSchema>;
export type AvatarApiResponse = z.infer<typeof avatarApiResponseSchema>;
