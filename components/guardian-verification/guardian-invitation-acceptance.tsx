"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  GUARDIAN_CONSENT_VERSION,
  type GuardianInvitationPreview,
} from "@/lib/guardian-verification/domain";

export function GuardianInvitationAcceptance({
  invitation,
}: {
  readonly invitation: GuardianInvitationPreview;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/guardian-invitations/accept", {
        body: JSON.stringify({
          consentVersion: GUARDIAN_CONSENT_VERSION,
          token: searchParams.get("token") ?? "",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        readonly message?: string;
        readonly redirectTo?: string;
        readonly success?: boolean;
      };
      if (!response.ok || !payload.success) {
        setError(payload.message ?? "目前無法接受家長邀請。");
        return;
      }
      router.push(payload.redirectTo ?? "/dashboard/parent");
      router.refresh();
    });
  }

  return (
    <div className="mt-8 rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-amber-700">Guardian Verification</p>
      <h2 className="mt-2 text-2xl font-black text-emerald-950">
        確認連結 {invitation.studentDisplayName}
      </h2>
      <p className="mt-3 text-slate-600">
        機構已邀請你以 {invitation.relationshipType} 身分查看孩子的學習摘要。
        接受前，請確認你理解資料只會用於家長入口的學習進度、作業狀態與練習建議。
      </p>
      <label className="mt-5 flex gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950">
        <input
          checked={accepted}
          className="mt-1 size-4"
          onChange={(event) => setAccepted(event.target.checked)}
          type="checkbox"
        />
        <span>
          我同意 EduCraft AI
          依家長入口目的顯示此孩子的最小必要學習摘要，並理解我只能查看已驗證關係的孩子。
        </span>
      </label>
      {error ? (
        <Alert className="mt-4" title="無法接受邀請" variant="error">
          {error}
        </Alert>
      ) : null}
      <Button
        className="mt-5"
        disabled={!accepted}
        loading={isPending}
        onClick={submit}
        type="button"
      >
        同意並啟用家長入口
      </Button>
    </div>
  );
}
