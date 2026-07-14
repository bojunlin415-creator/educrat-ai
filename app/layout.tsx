import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "課堂星球｜AI 教材工作台",
    template: "%s｜課堂星球",
  },
  description: "為台灣國小教師打造的 AI 教材生成工作台。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="zh-Hant-TW">
      <body>
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
              className="flex items-center gap-2 text-sm font-bold"
            >
              <Link
                className="rounded-lg px-3 py-2 hover:bg-emerald-50"
                href="/login"
              >
                登入
              </Link>
              <Link
                className="rounded-lg bg-emerald-700 px-3 py-2 text-white hover:bg-emerald-800"
                href="/dashboard"
              >
                工作台
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
