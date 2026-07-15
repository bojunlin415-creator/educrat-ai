import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export default function OrganizationOnboardingLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Card className="grid min-h-80 place-items-center p-8 text-center">
        <div>
          <Spinner className="mx-auto" label="正在準備機構設定" />
          <p className="mt-4 font-bold text-emerald-950">正在準備機構設定…</p>
        </div>
      </Card>
    </main>
  );
}
