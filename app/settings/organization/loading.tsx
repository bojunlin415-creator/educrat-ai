import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export default function OrganizationSettingsLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <Card className="grid min-h-80 place-items-center p-8 text-center">
        <Spinner className="mx-auto" label="正在讀取機構設定" />
        <p className="mt-4 font-bold text-emerald-950">正在讀取機構設定…</p>
      </Card>
    </main>
  );
}
