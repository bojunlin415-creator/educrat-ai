import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/forms/profile-form";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getOwnProfile, getSignedAvatarUrl } from "@/lib/profile/service";

export const metadata: Metadata = { title: "個人資料" };

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  const profile = await getOwnProfile(user.id);
  if (!profile?.onboarding_completed) redirect("/onboarding");

  const signedAvatarUrl = await getSignedAvatarUrl(profile.avatar_url, user.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6">
        <p className="font-bold text-amber-700">帳號設定</p>
        <h1 className="mt-1 text-3xl font-black text-emerald-950 sm:text-4xl">
          個人資料
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          更新教材署名、聯絡方式、介面語言與所在地時區。
        </p>
      </div>
      <Card className="p-6 sm:p-8">
        <ProfileForm
          allowAvatar
          defaultValues={{
            displayName: profile.display_name ?? "",
            locale: profile.locale,
            phone: profile.phone ?? "",
            timezone: profile.timezone,
          }}
          initialAvatarUrl={signedAvatarUrl}
          mode="settings"
        />
      </Card>
    </main>
  );
}
