"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type LifecycleAction =
  | "archive"
  | "create-version"
  | "delete"
  | "permanent-delete"
  | "publish"
  | "reopen-draft"
  | "restore"
  | "review"
  | "submit-review";

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
    readonly status: "archived" | "draft" | "in_review" | "published";
    readonly subject: { readonly name: string };
  };
  redirectTo?: string;
  source?: "detail" | "list" | "recycle-bin";
}

const ACTION_LABELS: Record<LifecycleAction, string> = {
  archive: "封存教材",
  "create-version": "建立新版本",
  delete: "刪除教材",
  "permanent-delete": "永久刪除",
  publish: "發布教材",
  "reopen-draft": "退回草稿",
  restore: "還原教材",
  review: "記錄審閱",
  "submit-review": "送出審核",
};

const ACTION_DESCRIPTIONS: Record<LifecycleAction, string> = {
  archive: "封存後教材會保留資料，但一般編輯流程會停止使用它。",
  "create-version": "系統會從已發布或封存教材建立下一個可編輯草稿版本。",
  delete: "教材會移入回收桶，可在永久刪除前還原。",
  "permanent-delete":
    "這是不可逆操作。系統會先確認教材已在回收桶中且沒有受保護相依資料。",
  publish: "發布會鎖定目前版本。發布後若需修改，必須建立新版本。",
  "reopen-draft": "退回草稿後，教師可以再次編輯並重新送審。",
  restore: "教材會從目前狀態還原，並重新出現在教材列表中。",
  review: "審閱只記錄 reviewer 已檢查教材，不會直接發布。",
  "submit-review": "送審前會檢查教材、題目、答案與知識點是否完整。",
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

function lifecycleEndpoint(input: {
  readonly action: LifecycleAction;
  readonly curriculumId: string;
  readonly source: "detail" | "list" | "recycle-bin";
}) {
  switch (input.action) {
    case "archive":
      return `/api/curriculums/${input.curriculumId}/archive`;
    case "create-version":
      return `/api/curriculums/${input.curriculumId}/versions/new`;
    case "delete":
      return `/api/curriculums/${input.curriculumId}`;
    case "permanent-delete":
      return `/api/curriculums/${input.curriculumId}/permanent-delete`;
    case "publish":
      return `/api/curriculums/${input.curriculumId}/publish`;
    case "reopen-draft":
      return `/api/curriculums/${input.curriculumId}/reopen-draft`;
    case "restore":
      return `/api/curriculums/${input.curriculumId}/restore${
        input.source === "recycle-bin" ? "?from=recycle-bin" : ""
      }`;
    case "review":
      return `/api/curriculums/${input.curriculumId}/review`;
    case "submit-review":
      return `/api/curriculums/${input.curriculumId}/submit-review`;
  }
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
      : action === "publish" || action === "submit-review"
        ? "primary"
        : "secondary";

  async function submit() {
    setStatus({ type: "idle" });
    setSubmitting(true);
    try {
      const endpoint = lifecycleEndpoint({
        action,
        curriculumId: curriculum.id,
        source,
      });
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
