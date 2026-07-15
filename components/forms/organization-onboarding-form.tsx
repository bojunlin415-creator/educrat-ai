"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { suggestOrganizationSlug } from "@/lib/organization/slug";
import {
  createOrganizationSchema,
  organizationApiResponseSchema,
  type CreateOrganizationInput,
} from "@/lib/validation/organization";

type FormStatus =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

const organizationFieldNames = [
  "address",
  "businessName",
  "email",
  "name",
  "phone",
  "slug",
] as const;

function isOrganizationFieldName(
  value: string,
): value is keyof CreateOrganizationInput {
  return organizationFieldNames.some((fieldName) => fieldName === value);
}

export function OrganizationOnboardingForm() {
  const router = useRouter();
  const slugEdited = useRef(false);
  const [status, setStatus] = useState<FormStatus>({ type: "idle" });
  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganizationInput>({
    defaultValues: {
      address: "",
      businessName: "",
      email: "",
      name: "",
      phone: "",
      slug: "",
    },
    resolver: zodResolver(createOrganizationSchema),
  });
  const name = useWatch({ control, name: "name" });
  const slugRegistration = register("slug");

  useEffect(() => {
    if (!slugEdited.current) {
      setValue("slug", name.trim() ? suggestOrganizationSlug(name) : "", {
        shouldValidate: false,
      });
    }
  }, [name, setValue]);

  async function onSubmit(values: CreateOrganizationInput) {
    setStatus({ type: "idle" });
    try {
      const response = await fetch("/api/organizations", {
        body: JSON.stringify(values),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload: unknown = await response.json();
      const parsed = organizationApiResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("伺服器回應格式不正確。");

      if (!response.ok || !parsed.data.success) {
        Object.entries(parsed.data.fieldErrors ?? {}).forEach(
          ([fieldName, messages]) => {
            if (isOrganizationFieldName(fieldName) && messages[0]) {
              setError(fieldName, { message: messages[0], type: "server" });
            }
          },
        );
        setStatus({ type: "error", message: parsed.data.message });
        return;
      }

      setStatus({ type: "success", message: parsed.data.message });
      router.replace(parsed.data.redirectTo ?? "/dashboard");
      router.refresh();
    } catch (error: unknown) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "目前無法建立機構，請稍後再試。",
      });
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          autoComplete="organization"
          className="sm:col-span-2"
          error={errors.name?.message}
          label="機構／補習班名稱"
          placeholder="例如：星光課堂"
          {...register("name")}
        />
        <Input
          autoCapitalize="none"
          autoComplete="off"
          error={errors.slug?.message}
          hint="只使用小寫英數與連字號；建立後暫不開放修改。"
          label="網址代稱"
          placeholder="starlight-school"
          {...slugRegistration}
          onChange={(event) => {
            slugEdited.current = true;
            void slugRegistration.onChange(event);
          }}
        />
        <Input
          autoComplete="organization"
          error={errors.businessName?.message}
          label="立案或公司名稱"
          placeholder="選填"
          {...register("businessName")}
        />
        <Input
          autoComplete="tel"
          error={errors.phone?.message}
          inputMode="tel"
          label="機構電話"
          placeholder="選填"
          {...register("phone")}
        />
        <Input
          autoComplete="email"
          error={errors.email?.message}
          label="機構電子郵件"
          placeholder="選填"
          type="email"
          {...register("email")}
        />
        <Input
          autoComplete="street-address"
          className="sm:col-span-2"
          error={errors.address?.message}
          label="機構地址"
          placeholder="選填"
          {...register("address")}
        />
      </div>

      {status.type !== "idle" ? (
        <Alert
          title={status.type === "success" ? "建立完成" : "無法建立機構"}
          variant={status.type}
        >
          {status.message}
        </Alert>
      ) : null}

      <Button className="w-full sm:w-auto" loading={isSubmitting} type="submit">
        {isSubmitting ? "建立中…" : "建立機構並進入工作台"}
      </Button>
    </form>
  );
}
