"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { submitAuthRequest } from "@/components/forms/auth-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

type SubmitStatus =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export function LoginForm({
  initialError,
  initialMessage,
}: {
  initialError?: string;
  initialMessage?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SubmitStatus>(
    initialError
      ? { type: "error", message: initialError }
      : initialMessage
        ? { type: "success", message: initialMessage }
        : { type: "idle" },
  );
  const [oauthLoading, setOauthLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setStatus({ type: "idle" });
    try {
      const result = await submitAuthRequest("/api/auth/login", values);
      if (!result.success) {
        setStatus({ type: "error", message: result.message });
        return;
      }
      setStatus({ type: "success", message: result.message });
      router.push(result.redirectTo ?? "/dashboard");
      router.refresh();
    } catch (error: unknown) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "目前無法登入。",
      });
    }
  }

  async function signInWithGoogle() {
    setOauthLoading(true);
    setStatus({ type: "idle" });
    try {
      const result = await submitAuthRequest("/api/auth/google");
      if (!result.success || !result.externalRedirectTo) {
        setStatus({ type: "error", message: result.message });
        setOauthLoading(false);
        return;
      }
      window.location.assign(result.externalRedirectTo);
    } catch (error: unknown) {
      setStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "目前無法使用 Google 登入。",
      });
      setOauthLoading(false);
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-2xl font-black text-emerald-950">登入課堂星球</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        使用已完成驗證的帳號登入教材工作台。
      </p>
      <div className="mt-6 space-y-4">
        <Button
          className="w-full"
          loading={oauthLoading}
          onClick={signInWithGoogle}
          variant="secondary"
        >
          使用 Google 登入
        </Button>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          或使用電子郵件
          <span className="h-px flex-1 bg-slate-200" />
        </div>
      </div>
      <form
        className="mt-5 space-y-5"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
      >
        <Input
          autoComplete="email"
          error={errors.email?.message}
          label="電子郵件"
          placeholder="teacher@example.com"
          type="email"
          {...register("email")}
        />
        <div>
          <Input
            autoComplete="current-password"
            error={errors.password?.message}
            label="密碼"
            placeholder="至少 8 個字元"
            type="password"
            {...register("password")}
          />
          <Link
            className="mt-2 inline-block text-sm font-bold text-emerald-700 hover:underline"
            href="/forgot-password"
          >
            忘記密碼？
          </Link>
        </div>
        {status.type === "success" ? (
          <Alert title="完成" variant="success">
            {status.message}
          </Alert>
        ) : null}
        {status.type === "error" ? (
          <Alert title="無法登入" variant="error">
            {status.message}
          </Alert>
        ) : null}
        <Button className="w-full" loading={isSubmitting} type="submit">
          {isSubmitting ? "登入中…" : "登入"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        還沒有帳號？{" "}
        <Link
          className="font-bold text-emerald-700 hover:underline"
          href="/signup"
        >
          建立帳號
        </Link>
      </p>
    </Card>
  );
}
