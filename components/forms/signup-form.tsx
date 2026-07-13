"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { submitAuthRequest } from "./auth-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";

export function SignupForm() {
  const router = useRouter();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      acceptedTerms: false,
    },
  });

  async function onSubmit(values: SignupInput) {
    setMessage(null);
    try {
      const result = await submitAuthRequest("/api/auth/signup", values);
      setMessage({
        type: result.success ? "success" : "error",
        text: result.message,
      });
      if (result.success && result.redirectTo) {
        router.push(result.redirectTo);
        router.refresh();
      }
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "目前無法註冊。",
      });
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-black text-emerald-950">建立教師帳號</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        註冊後請依信件指示完成電子郵件驗證。
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
        <Input
          autoComplete="new-password"
          error={errors.password?.message}
          hint="至少 8 個字元，建議混合英文字母、數字與符號。"
          label="密碼"
          type="password"
          {...register("password")}
        />
        <Input
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          label="確認密碼"
          type="password"
          {...register("confirmPassword")}
        />
        <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
          <input
            className="mt-1 size-4"
            type="checkbox"
            {...register("acceptedTerms")}
          />
          <span>我同意使用條款與隱私權政策。</span>
        </label>
        {errors.acceptedTerms?.message ? (
          <p className="text-sm font-medium text-red-700">
            {errors.acceptedTerms.message}
          </p>
        ) : null}
        {message ? (
          <Alert
            title={message.type === "success" ? "請檢查信箱" : "無法註冊"}
            variant={message.type}
          >
            {message.text}
          </Alert>
        ) : null}
        <Button className="w-full" loading={isSubmitting} type="submit">
          建立帳號
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        已有帳號？{" "}
        <Link
          className="font-bold text-emerald-700 hover:underline"
          href="/login"
        >
          返回登入
        </Link>
      </p>
    </Card>
  );
}
