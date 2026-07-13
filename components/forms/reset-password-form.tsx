"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { submitAuthRequest } from "./auth-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validation/auth";

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordInput) {
    setError(null);
    try {
      const result = await submitAuthRequest(
        "/api/auth/reset-password",
        values,
      );
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.push(result.redirectTo ?? "/login?notice=password_updated");
      router.refresh();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "目前無法更新密碼。");
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-black text-emerald-950">設定新密碼</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        請設定至少 8 個字元的新密碼。
      </p>
      <form
        className="mt-6 space-y-5"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
      >
        <Input
          autoComplete="new-password"
          error={errors.password?.message}
          label="新密碼"
          type="password"
          {...register("password")}
        />
        <Input
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          label="確認新密碼"
          type="password"
          {...register("confirmPassword")}
        />
        {error ? (
          <Alert title="無法更新密碼" variant="error">
            {error}
          </Alert>
        ) : null}
        <Button className="w-full" loading={isSubmitting} type="submit">
          更新密碼
        </Button>
      </form>
    </Card>
  );
}
