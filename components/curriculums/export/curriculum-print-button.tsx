"use client";

export function CurriculumPrintButton() {
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-800 px-5 py-2.5 font-bold text-white hover:bg-emerald-900 print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      使用瀏覽器列印
    </button>
  );
}
