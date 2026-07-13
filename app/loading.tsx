import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <main
      aria-live="polite"
      className="grid min-h-[calc(100vh-4rem)] place-items-center px-4"
    >
      <div className="text-center">
        <Spinner className="mx-auto" size="lg" />
        <p className="mt-4 font-bold text-emerald-950">正在整理頁面…</p>
      </div>
    </main>
  );
}
