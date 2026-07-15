"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function CurriculumsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Alert title="教材資料暫時無法載入" variant="error">
        請稍後再試；若問題持續發生，請回報管理員。
      </Alert>
      <Button className="mt-5" onClick={reset}>
        重新載入
      </Button>
    </main>
  );
}
