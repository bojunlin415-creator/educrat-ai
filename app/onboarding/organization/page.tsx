import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrganizationOnboardingForm } from "@/components/forms/organization-onboarding-form";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getCurrentOrganization } from "@/lib/organization/service";
import { getOwnProfile } from "@/lib/profile/service";

export const metadata: Metadata = { title: "建立機構" };

export default async function OrganizationOnboardingPage() {
  const user = await requireUser();
  const profile = await getOwnProfile(user.id);
  if (!profile?.onboarding_completed) redirect("/onboarding");
  if (await getCurrentOrganization()) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6">
        <p className="font-bold text-amber-700">機構設定</p>
        <h1 className="mt-1 text-3xl font-black text-emerald-950 sm:text-4xl">
          建立你的補習班機構
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-slate-600">
          機構是教材、成員與後續分校資料的隔離邊界。建立完成後，你會成為機構擁有者。
        </p>
      </div>
      <Card className="p-6 sm:p-8">
        <OrganizationOnboardingForm />
      </Card>
    </main>
  );
}
