import { Card } from "@/components/ui/card";

export default function CurriculumEditorLoading() {
  return (
    <main className="mx-auto max-w-7xl animate-pulse px-4 py-10 sm:px-6">
      <div className="h-4 w-52 rounded bg-slate-200" />
      <div className="mt-5 h-10 w-80 max-w-full rounded bg-slate-200" />
      <div className="mt-8 h-20 rounded-2xl bg-slate-200" />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="h-96 bg-slate-100" />
        <Card className="h-96 bg-slate-100" />
      </div>
    </main>
  );
}
