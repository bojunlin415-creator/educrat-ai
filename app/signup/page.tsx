import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/forms/signup-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "建立帳號" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-xl place-items-center px-4 py-12 sm:px-6">
      <div className="w-full">
        <SignupForm />
      </div>
    </main>
  );
}
