import Link from "next/link";
import type { ReactNode } from "react";

export function CurriculumHeader({
  actions,
  backHref,
  backLabel = "返回教材列表",
  description,
  eyebrow = "教材核心",
  title,
}: {
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  description?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        {backHref ? (
          <Link
            className="mb-3 inline-flex font-bold text-emerald-800 hover:text-emerald-950"
            href={backHref}
          >
            ← {backLabel}
          </Link>
        ) : null}
        <p className="font-bold text-amber-700">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-black text-emerald-950 sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-slate-600">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}
