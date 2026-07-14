import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export default function OnboardingLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Card className="grid min-h-80 place-items-center p-8 text-center">
        <div>
          <Spinner className="mx-auto" label="正在讀取基本資料" />
          <p className="mt-4 font-bold text-emerald-950">正在準備帳號設定…</p>
        </div>
      </Card>
    </main>
  );
}
