import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/forms/profile-form";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { hasAnyOrganization } from "@/lib/organization/service";
import { getOwnProfile } from "@/lib/profile/service";

export const metadata: Metadata = { title: "完成基本資料" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const profile = await getOwnProfile(user.id);
  if (profile?.onboarding_completed) {
    redirect(
      (await hasAnyOrganization()) ? "/dashboard" : "/onboarding/organization",
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6">
        <p className="font-bold text-amber-700">帳號設定</p>
        <h1 className="mt-1 text-3xl font-black text-emerald-950 sm:text-4xl">
          先完成老師基本資料
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-slate-600">
          這些設定會用於教材署名、日期與日後的機構協作。完成後即可進入工作台。
        </p>
      </div>
      <Card className="p-6 sm:p-8">
        <ProfileForm
          allowAvatar={false}
          defaultValues={{
            displayName: profile?.display_name ?? "",
            locale: profile?.locale ?? "zh-TW",
            phone: profile?.phone ?? "",
            timezone: profile?.timezone ?? "Asia/Taipei",
          }}
          initialAvatarUrl={null}
          mode="onboarding"
        />
      </Card>
    </main>
  );
}
