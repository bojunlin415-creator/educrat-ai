"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  organizationApiResponseSchema,
  updateOrganizationSchema,
  type UpdateOrganizationInput,
} from "@/lib/validation/organization";

type FormStatus =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export function OrganizationSettingsForm({
  canEdit,
  defaultValues,
  slug,
}: {
  canEdit: boolean;
  defaultValues: UpdateOrganizationInput;
  slug: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<FormStatus>({ type: "idle" });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateOrganizationInput>({
    defaultValues,
    resolver: zodResolver(updateOrganizationSchema),
  });

  async function onSubmit(values: UpdateOrganizationInput) {
    if (!canEdit) return;
    setStatus({ type: "idle" });
    try {
      const response = await fetch("/api/organizations/current", {
        body: JSON.stringify(values),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      const payload: unknown = await response.json();
      const parsed = organizationApiResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("伺服器回應格式不正確。");
      if (!response.ok || !parsed.data.success) {
        setStatus({ type: "error", message: parsed.data.message });
        return;
      }

      setStatus({ type: "success", message: parsed.data.message });
      router.refresh();
    } catch (error: unknown) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "目前無法更新機構資料，請稍後再試。",
      });
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      {!canEdit ? (
        <Alert title="唯讀權限" variant="info">
          你的角色可以查看機構資料，但只有機構擁有者與管理員可以編輯。
        </Alert>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          disabled={!canEdit}
          error={errors.name?.message}
          label="機構名稱"
          {...register("name")}
        />
        <Input
          hint="為避免未來網址失效，Sprint 6 不開放修改。"
          label="網址代稱"
          readOnly
          value={slug}
        />
        <Input
          disabled={!canEdit}
          error={errors.businessName?.message}
          label="立案或公司名稱"
          {...register("businessName")}
        />
        <Input
          disabled={!canEdit}
          error={errors.taxId?.message}
          label="統一編號／稅籍編號"
          {...register("taxId")}
        />
        <Input
          disabled={!canEdit}
          error={errors.phone?.message}
          inputMode="tel"
          label="機構電話"
          {...register("phone")}
        />
        <Input
          disabled={!canEdit}
          error={errors.email?.message}
          label="機構電子郵件"
          type="email"
          {...register("email")}
        />
        <Input
          className="sm:col-span-2"
          disabled={!canEdit}
          error={errors.address?.message}
          label="機構地址"
          {...register("address")}
        />
      </div>

      {status.type !== "idle" ? (
        <Alert
          title={status.type === "success" ? "儲存完成" : "無法儲存"}
          variant={status.type}
        >
          {status.message}
        </Alert>
      ) : null}

      {canEdit ? (
        <Button loading={isSubmitting} type="submit">
          儲存機構資料
        </Button>
      ) : null}
    </form>
  );
}
