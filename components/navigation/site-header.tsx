import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import type { OrganizationRole } from "@/lib/organization/constants";
import { getCurrentOrganization } from "@/lib/organization/service";

export async function SiteHeader() {
  let authenticated = false;
  let role: OrganizationRole | null = null;
  try {
    authenticated = Boolean(await getCurrentUser());
    if (authenticated) {
      role = (await getCurrentOrganization())?.membership.role ?? null;
    }
  } catch {
    authenticated = false;
    role = null;
  }
  const canManageAccess =
    role === "organization_owner" || role === "organization_admin";
  const canUseTeacherDashboard =
    canManageAccess || role === "teacher" || role === "reviewer";
  const canUseParentPortal = role === "guardian";

  return (
    <header className="border-b border-emerald-950/10 bg-white/85 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          className="flex items-center gap-2 font-black tracking-tight text-emerald-950"
          href="/"
        >
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-xl bg-emerald-700 text-white"
          >
            星
          </span>
          課堂星球
        </Link>
        <nav
          aria-label="主要導覽"
          className="flex items-center gap-1 text-sm font-bold sm:gap-2"
        >
          {authenticated ? (
            <>
              {canUseTeacherDashboard ? (
                <Link
                  className="hidden rounded-lg px-2 py-2 hover:bg-emerald-50 sm:block sm:px-3"
                  href="/dashboard/teacher"
                >
                  教師儀表板
                </Link>
              ) : null}
              {canUseParentPortal ? (
                <Link
                  className="hidden rounded-lg px-2 py-2 hover:bg-emerald-50 sm:block sm:px-3"
                  href="/dashboard/parent"
                >
                  家長入口
                </Link>
              ) : null}
              {canManageAccess ? (
                <Link
                  className="hidden rounded-lg px-2 py-2 hover:bg-emerald-50 sm:px-3 lg:block"
                  href="/settings/access"
                >
                  使用者與權限
                </Link>
              ) : null}
              <Link
                className="rounded-lg px-2 py-2 hover:bg-emerald-50 sm:px-3"
                href="/curriculums"
              >
                教材
              </Link>
              <Link
                className="hidden rounded-lg px-2 py-2 hover:bg-emerald-50 sm:block sm:px-3"
                href="/settings/profile"
              >
                個人設定
              </Link>
              <Link
                className="rounded-lg bg-emerald-700 px-3 py-2 text-white hover:bg-emerald-800"
                href="/dashboard"
              >
                工作台
              </Link>
              <form action="/api/auth/logout" method="post">
                <Button className="px-2 sm:px-3" type="submit" variant="ghost">
                  登出
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link
                className="rounded-lg px-2 py-2 hover:bg-emerald-50 sm:px-3"
                href="/login"
              >
                登入
              </Link>
              <Link
                className="rounded-lg bg-emerald-700 px-3 py-2 text-white hover:bg-emerald-800"
                href="/signup"
              >
                建立帳號
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
