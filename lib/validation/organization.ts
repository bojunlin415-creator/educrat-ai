import { z } from "zod";
import {
  ORGANIZATION_RESERVED_SLUGS,
  ORGANIZATION_SLUG_MAX_LENGTH,
  ORGANIZATION_SLUG_MIN_LENGTH,
} from "@/lib/organization/constants";

const optionalPhoneSchema = z
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
  );

const optionalEmailSchema = z
  .string()
  .trim()
  .max(254, "電子郵件不得超過 254 個字元。")
  .refine(
    (value) => value.length === 0 || z.email().safeParse(value).success,
    "請輸入有效的電子郵件。",
  )
  .transform((value) => value.toLowerCase());

const editableOrganizationFields = {
  address: z
    .string()
    .trim()
    .max(300, "地址不得超過 300 個字元。")
    .refine(
      (value) => value.length === 0 || value.length >= 2,
      "地址至少需要 2 個字元。",
    ),
  businessName: z
    .string()
    .trim()
    .max(160, "立案或公司名稱不得超過 160 個字元。")
    .refine(
      (value) => value.length === 0 || value.length >= 2,
      "立案或公司名稱至少需要 2 個字元。",
    ),
  email: optionalEmailSchema,
  name: z
    .string()
    .trim()
    .min(2, "機構名稱至少需要 2 個字元。")
    .max(120, "機構名稱不得超過 120 個字元。"),
  phone: optionalPhoneSchema,
};

export const organizationSlugSchema = z
  .string()
  .trim()
  .min(
    ORGANIZATION_SLUG_MIN_LENGTH,
    `網址代稱至少需要 ${ORGANIZATION_SLUG_MIN_LENGTH} 個字元。`,
  )
  .max(
    ORGANIZATION_SLUG_MAX_LENGTH,
    `網址代稱不得超過 ${ORGANIZATION_SLUG_MAX_LENGTH} 個字元。`,
  )
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "網址代稱只能使用小寫英數與連字號。")
  .refine(
    (value) =>
      !ORGANIZATION_RESERVED_SLUGS.some((reserved) => reserved === value),
    "這個網址代稱為系統保留字，請更換。",
  );

export const createOrganizationSchema = z
  .object({
    ...editableOrganizationFields,
    slug: organizationSlugSchema,
  })
  .strict();

export const updateOrganizationSchema = z
  .object({
    ...editableOrganizationFields,
    taxId: z
      .string()
      .trim()
      .max(20, "統一編號或稅籍編號不得超過 20 個字元。")
      .refine(
        (value) => value.length === 0 || /^[A-Za-z0-9-]{2,20}$/.test(value),
        "統一編號或稅籍編號格式不正確。",
      ),
  })
  .strict();

export const switchOrganizationSchema = z
  .object({ organizationId: z.uuid("機構識別碼格式不正確。") })
  .strict();

const organizationResponseItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: z.string(),
  slug: z.string(),
});

export const organizationApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  redirectTo: z.string().startsWith("/").optional(),
  organization: organizationResponseItemSchema.optional(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type SwitchOrganizationInput = z.infer<typeof switchOrganizationSchema>;
export type OrganizationApiResponse = z.infer<
  typeof organizationApiResponseSchema
>;
