import type { Metadata } from "next";
import Link from "next/link";
import { AccessManagement } from "@/components/access-control/access-management";
import { Alert } from "@/components/ui/alert";
import { AccessControlError } from "@/lib/access-control/errors";
import { getAccessOverview } from "@/lib/access-control/service";

export const metadata: Metadata = { title: "使用者與權限" };

type AccessPageState =
  | {
      readonly error: AccessControlError;
      readonly overview?: never;
    }
  | {
      readonly error?: never;
      readonly overview: Awaited<ReturnType<typeof getAccessOverview>>;
    };

function accessErrorMessage(error: AccessControlError) {
  switch (error.code) {
    case "not_authenticated":
      return "請先登入後再管理使用者與權限。";
    case "organization_required":
      return "請先建立或切換到有效機構。";
    case "forbidden":
      return "只有 Organization Owner 或 Organization Admin 可以開啟這個管理頁。";
    case "service_unavailable":
      return "目前無法載入權限管理資料；請確認 Development migration 已套用。";
    default:
      return "目前無法載入使用者與權限管理。";
  }
}

async function loadAccessPageState(): Promise<AccessPageState> {
  try {
    const overview = await getAccessOverview();
    return { overview };
  } catch (error: unknown) {
    if (!(error instanceof AccessControlError)) throw error;
    return { error };
  }
}

export default async function AccessSettingsPage() {
  const state = await loadAccessPageState();

  if (state.overview) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <AccessManagement overview={state.overview} />
      </main>
    );
  }

  const { error } = state;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Alert title="無法開啟使用者與權限管理" variant="error">
        {accessErrorMessage(error)}
      </Alert>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-900/15 bg-white px-5 py-2.5 font-bold text-emerald-950 transition-colors hover:bg-emerald-50"
          href="/dashboard"
        >
          返回工作台
        </Link>
        {error.code === "not_authenticated" ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 py-2.5 font-bold text-white transition-colors hover:bg-emerald-800"
            href="/login"
          >
            前往登入
          </Link>
        ) : null}
      </div>
    </main>
  );
}
