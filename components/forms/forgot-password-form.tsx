"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { submitAuthRequest } from "./auth-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setMessage(null);
    try {
      const result = await submitAuthRequest(
        "/api/auth/forgot-password",
        values,
      );
      setMessage({
        type: result.success ? "success" : "error",
        text: result.message,
      });
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "目前無法送出申請。",
      });
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-black text-emerald-950">重設密碼</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        輸入註冊信箱，我們會寄送重設連結。基於安全考量，系統不會透露帳號是否存在。
      </p>
      <form
        className="mt-6 space-y-5"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
      >
        <Input
          autoComplete="email"
          error={errors.email?.message}
          label="電子郵件"
          type="email"
          {...register("email")}
        />
        {message ? (
          <Alert
            title={message.type === "success" ? "申請已受理" : "無法送出"}
            variant={message.type}
          >
            {message.text}
          </Alert>
        ) : null}
        <Button className="w-full" loading={isSubmitting} type="submit">
          寄送重設信
        </Button>
      </form>
      <Link
        className="mt-6 block text-center text-sm font-bold text-emerald-700 hover:underline"
        href="/login"
      >
        返回登入
      </Link>
    </Card>
  );
}
