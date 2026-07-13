import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/login-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "登入" };

const notices: Record<string, string> = {
  signed_out: "你已安全登出。",
  password_updated: "密碼已更新，請使用新密碼登入。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");

  const params = await searchParams;
  const initialMessage = params.notice ? notices[params.notice] : undefined;
  const callbackError = params.error
    ? "驗證連結無效或已過期，請重新登入或申請新的連結。"
    : undefined;

  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2">
      <section>
        <p className="font-bold text-amber-700">歡迎回來</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-emerald-950 sm:text-5xl">
          繼續完成你的下一堂好課。
        </h1>
        <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">
          登入後即可進入受保護的教材工作台。帳號與 session 由 Supabase Auth
          管理。
        </p>
      </section>
      <LoginForm initialError={callbackError} initialMessage={initialMessage} />
    </main>
  );
}
