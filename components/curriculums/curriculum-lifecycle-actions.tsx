"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type LifecycleAction = "archive" | "delete" | "permanent-delete" | "restore";

type RequestState =
  | { type: "idle" }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

interface CurriculumLifecycleActionProps {
  action: LifecycleAction;
  curriculum: {
    readonly grade: { readonly name: string };
    readonly id: string;
    readonly latestVersion: number;
    readonly name: string;
    readonly status: "active" | "archived" | "draft";
    readonly subject: { readonly name: string };
  };
  redirectTo?: string;
  source?: "detail" | "list" | "recycle-bin";
}

const ACTION_LABELS: Record<LifecycleAction, string> = {
  archive: "封存教材",
  delete: "刪除教材",
  "permanent-delete": "永久刪除",
  restore: "還原教材",
};

const ACTION_DESCRIPTIONS: Record<LifecycleAction, string> = {
  archive: "封存後教材會保留資料，但一般編輯流程會停止使用它。",
  delete: "教材會移入回收桶，可在永久刪除前還原。",
  "permanent-delete":
    "這是不可逆操作。系統會先確認教材已在回收桶中且沒有受保護相依資料。",
  restore: "教材會從目前狀態還原，並重新出現在教材列表中。",
};

async function parseLifecycleResponse(response: Response): Promise<{
  message: string;
  redirectTo?: string;
  success: boolean;
}> {
  const payload = (await response.json()) as unknown;
  if (typeof payload !== "object" || payload === null) {
    throw new Error("伺服器回應格式不正確。");
  }
  const record = payload as Readonly<Record<string, unknown>>;
  return {
    message:
      typeof record.message === "string"
        ? record.message
        : "教材生命週期操作已完成。",
    redirectTo:
      typeof record.redirectTo === "string" ? record.redirectTo : undefined,
    success: record.success === true,
  };
}

export function CurriculumLifecycleAction({
  action,
  curriculum,
  redirectTo,
  source = "list",
}: CurriculumLifecycleActionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<RequestState>({ type: "idle" });
  const [submitting, setSubmitting] = useState(false);

  const requiresConfirmation = action === "permanent-delete";
  const buttonVariant =
    action === "delete" || action === "permanent-delete"
      ? "danger"
      : "secondary";

  async function submit() {
    setStatus({ type: "idle" });
    setSubmitting(true);
    try {
      const endpoint =
        action === "archive"
          ? `/api/curriculums/${curriculum.id}/archive`
          : action === "restore"
            ? `/api/curriculums/${curriculum.id}/restore${
                source === "recycle-bin" ? "?from=recycle-bin" : ""
              }`
            : action === "permanent-delete"
              ? `/api/curriculums/${curriculum.id}/permanent-delete`
              : `/api/curriculums/${curriculum.id}`;
      const method = action === "delete" ? "DELETE" : "POST";
      const body =
        action === "delete"
          ? { reason }
          : action === "permanent-delete"
            ? { confirmation }
            : undefined;
      const response = await fetch(endpoint, {
        ...(body
          ? {
              body: JSON.stringify(body),
              headers: { "content-type": "application/json" },
            }
          : {}),
        method,
      });
      const payload = await parseLifecycleResponse(response);
      if (!response.ok || !payload.success) {
        setStatus({ type: "error", message: payload.message });
        return;
      }
      setStatus({ type: "success", message: payload.message });
      setOpen(false);
      router.push(redirectTo ?? payload.redirectTo ?? "/curriculums");
      router.refresh();
    } catch (error: unknown) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "目前無法完成教材生命週期操作，請稍後再試。",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        className="whitespace-nowrap"
        onClick={() => {
          setStatus({ type: "idle" });
          setOpen(true);
        }}
        variant={buttonVariant}
      >
        {ACTION_LABELS[action]}
      </Button>
      <Dialog
        description={ACTION_DESCRIPTIONS[action]}
        onClose={() => {
          if (!submitting) setOpen(false);
        }}
        open={open}
        title={`${ACTION_LABELS[action]}：${curriculum.name}`}
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            <p>
              教材：<span className="font-bold">{curriculum.name}</span>
            </p>
            <p>
              科目／年級：{curriculum.subject.name}／{curriculum.grade.name}
            </p>
            <p>
              狀態：{curriculum.status} · 版本 v{curriculum.latestVersion}
            </p>
          </div>

          {action === "delete" ? (
            <label className="block text-sm font-bold text-emerald-950">
              刪除原因（選填）
              <textarea
                className="mt-2 block min-h-24 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900"
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              />
            </label>
          ) : null}

          {requiresConfirmation ? (
            <label className="block text-sm font-bold text-emerald-950">
              請輸入教材名稱或「永久刪除」以確認
              <input
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900"
                onChange={(event) => setConfirmation(event.target.value)}
                value={confirmation}
              />
            </label>
          ) : null}

          {status.type !== "idle" ? (
            <Alert
              title={status.type === "success" ? "操作完成" : "操作失敗"}
              variant={status.type}
            >
              {status.message}
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              loading={submitting}
              onClick={submit}
              variant={buttonVariant}
            >
              確認{ACTION_LABELS[action]}
            </Button>
            <Button
              disabled={submitting}
              onClick={() => setOpen(false)}
              variant="ghost"
            >
              取消
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
