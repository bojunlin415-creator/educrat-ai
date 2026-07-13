"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-Hant-TW">
      <body className="grid min-h-screen place-items-center bg-stone-50 px-4 text-center text-emerald-950">
        <main>
          <h1 className="text-3xl font-black">系統暫時無法使用</h1>
          <p className="mt-3 text-slate-600">
            我們沒有成功載入頁面，請重新整理後再試。
          </p>
          <button
            className="mt-6 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white"
            onClick={reset}
            type="button"
          >
            重新整理
          </button>
        </main>
      </body>
    </html>
  );
}
