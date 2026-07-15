import Link from "next/link";

export function CurriculumBreadcrumb({
  curriculumId,
  curriculumName,
}: {
  curriculumId: string;
  curriculumName: string;
}) {
  return (
    <nav aria-label="教材編輯導覽" className="text-sm text-slate-600">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link className="font-bold text-emerald-800" href="/curriculums">
            教材
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link
            className="font-bold text-emerald-800"
            href={`/curriculums/${curriculumId}`}
          >
            {curriculumName}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page">章節編輯器</li>
      </ol>
    </nav>
  );
}
