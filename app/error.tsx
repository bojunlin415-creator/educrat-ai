"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center px-4 text-center">
      <div>
        <p className="text-sm font-black tracking-widest text-red-700">
          發生錯誤
        </p>
        <h1 className="mt-3 text-3xl font-black text-emerald-950">
          頁面暫時無法顯示
        </h1>
        <p className="mt-3 text-slate-600">
          請再試一次；若問題持續發生，請稍後回來。
        </p>
        <Button className="mt-7" onClick={reset}>
          重新載入
        </Button>
      </div>
    </main>
  );
}
