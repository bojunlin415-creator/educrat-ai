"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CurriculumReferenceOptions } from "@/lib/curriculum/service";
import {
  curriculumApiResponseSchema,
  curriculumFormSchema,
  type CurriculumFormInput,
} from "@/lib/validation/curriculum";

type FormStatus =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export function CurriculumForm({
  curriculumId,
  defaultValues,
  mode,
  options,
}: {
  curriculumId?: string;
  defaultValues: CurriculumFormInput;
  mode: "create" | "edit";
  options: CurriculumReferenceOptions;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<FormStatus>({ type: "idle" });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CurriculumFormInput>({
    defaultValues,
    resolver: zodResolver(curriculumFormSchema),
  });

  async function onSubmit(values: CurriculumFormInput) {
    setStatus({ type: "idle" });
    try {
      const endpoint =
        mode === "create"
          ? "/api/curriculums"
          : `/api/curriculums/${curriculumId ?? ""}`;
      const body =
        mode === "create"
          ? values
          : {
              gradeId: values.gradeId,
              name: values.name,
              curriculumReferenceId: values.curriculumReferenceId,
              schoolYear: values.schoolYear,
              semester: values.semester,
              status: values.status,
              subjectId: values.subjectId,
            };
      const response = await fetch(endpoint, {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: mode === "create" ? "POST" : "PATCH",
      });
      const payload: unknown = await response.json();
      const parsed = curriculumApiResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("伺服器回應格式不正確。");
      if (!response.ok || !parsed.data.success) {
        setStatus({ type: "error", message: parsed.data.message });
        return;
      }

      setStatus({ type: "success", message: parsed.data.message });
      router.push(
        parsed.data.redirectTo ??
          `/curriculums/${parsed.data.curriculum?.id ?? curriculumId ?? ""}`,
      );
      router.refresh();
    } catch (error: unknown) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "目前無法儲存教材，請稍後再試。",
      });
    }
  }

  return (
    <form className="space-y-6" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          className="sm:col-span-2"
          error={errors.name?.message}
          label="教材名稱"
          placeholder="例如：四年級國語上學期"
          {...register("name")}
        />
        <Select
          error={errors.subjectId?.message}
          label="科目"
          options={[
            { label: "請選擇科目", value: "" },
            ...options.subjects.map((subject) => ({
              label: subject.name,
              value: subject.id,
            })),
          ]}
          {...register("subjectId")}
        />
        <Select
          error={errors.gradeId?.message}
          label="年級"
          options={[
            { label: "請選擇年級", value: "" },
            ...options.grades.map((grade) => ({
              label: grade.name,
              value: grade.id,
            })),
          ]}
          {...register("gradeId")}
        />
        <Select
          error={errors.curriculumReferenceId?.message}
          label="教材進度架構"
          options={[
            { label: "請選擇教材進度架構", value: "" },
            ...options.references.map((reference) => ({
              label: reference.displayName,
              value: reference.id,
            })),
          ]}
          {...register("curriculumReferenceId")}
        />
        <Input
          error={errors.schoolYear?.message}
          label="學年度"
          max={999}
          min={100}
          type="number"
          {...register("schoolYear", { valueAsNumber: true })}
        />
        <Select
          error={errors.semester?.message}
          label="學期"
          options={[
            { label: "請選擇學期", value: "" },
            { label: "上學期", value: "1" },
            { label: "下學期", value: "2" },
          ]}
          {...register("semester", { valueAsNumber: true })}
        />
        <Select
          error={errors.status?.message}
          label="狀態"
          options={[{ label: "草稿", value: "draft" }]}
          {...register("status")}
        />
      </div>

      {mode === "create" ? (
        <label className="block font-bold text-emerald-950">
          初始版本備註（選填）
          <textarea
            className="mt-2 block min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900 hover:border-emerald-600"
            maxLength={1000}
            {...register("versionRemark")}
          />
          {errors.versionRemark ? (
            <span className="mt-1.5 block text-sm font-medium text-red-700">
              {errors.versionRemark.message}
            </span>
          ) : null}
        </label>
      ) : null}

      {status.type !== "idle" ? (
        <Alert
          title={status.type === "success" ? "儲存完成" : "無法儲存"}
          variant={status.type}
        >
          {status.message}
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button loading={isSubmitting} type="submit">
          {mode === "create" ? "建立教材" : "儲存教材"}
        </Button>
        <button
          className="min-h-11 rounded-xl border border-emerald-900/15 bg-white px-5 py-2.5 font-bold text-emerald-950 hover:bg-emerald-50"
          onClick={() => router.back()}
          type="button"
        >
          取消
        </button>
      </div>
    </form>
  );
}
