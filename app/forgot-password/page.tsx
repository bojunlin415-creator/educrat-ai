import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";

export const metadata: Metadata = { title: "忘記密碼" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-xl place-items-center px-4 py-12 sm:px-6">
      <div className="w-full">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
