import { Spinner } from "@/components/ui/spinner";

export default function CurriculumsLoading() {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-6xl place-items-center px-4 py-10 sm:px-6">
      <div className="text-center">
        <Spinner className="mx-auto" />
        <p className="mt-3 font-bold text-emerald-950">正在載入教材資料…</p>
      </div>
    </main>
  );
}
