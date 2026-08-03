import type { Metadata } from "next";
import Link from "next/link";
import { GuardianInvitationAcceptance } from "@/components/guardian-verification/guardian-invitation-acceptance";
import { Alert } from "@/components/ui/alert";
import { GuardianVerificationError } from "@/lib/guardian-verification/errors";
import { previewGuardianInvitation } from "@/lib/guardian-verification/service";

export const metadata: Metadata = { title: "接受家長邀請" };

export default async function AcceptGuardianInvitationPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly token?: string }>;
}) {
  const { token = "" } = await searchParams;
  let invitation = null;
  let errorMessage: string | null = null;
  let errorCode: string | null = null;

  try {
    invitation = await previewGuardianInvitation({ token });
  } catch (error: unknown) {
    errorCode = error instanceof GuardianVerificationError ? error.code : null;
    errorMessage =
      error instanceof GuardianVerificationError
        ? error.message
        : "目前無法載入家長邀請。";
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div>
        <p className="font-bold text-amber-700">GV-001</p>
        <h1 className="mt-1 text-3xl font-black text-emerald-950 sm:text-4xl">
          接受家長邀請
        </h1>
        <p className="mt-2 text-slate-600">
          家長邀請必須由機構建立，並由受邀 Email 的登入帳號明確同意後才會啟用。
        </p>
      </div>
      {invitation ? (
        <GuardianInvitationAcceptance invitation={invitation} />
      ) : (
        <Alert className="mt-8" title="邀請無法使用" variant="error">
          {errorMessage}
          {errorCode === "not_authenticated" ? (
            <span className="mt-3 block">
              請先使用受邀 Email 登入；若尚未建立帳號，請用同一個 Email
              建立帳號並完成驗證後，再回到此邀請連結。
            </span>
          ) : null}
        </Alert>
      )}
      <div className="mt-6 flex flex-wrap gap-4">
        <Link className="inline-flex font-bold text-emerald-800" href="/login">
          前往登入
        </Link>
        <Link className="inline-flex font-bold text-emerald-800" href="/signup">
          建立帳號
        </Link>
        <Link
          className="inline-flex font-bold text-emerald-800"
          href="/dashboard"
        >
          返回工作台
        </Link>
      </div>
    </main>
  );
}
