import Link from "next/link";
import type { ParentPortalDashboardViewModel } from "@/lib/parent-portal/domain";
import { Card } from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
  in_progress: "進行中",
  not_started: "尚未開始",
  overdue: "已逾期",
  submitted: "已繳交",
};

export function ParentPortal({
  dashboard,
}: {
  readonly dashboard: ParentPortalDashboardViewModel;
}) {
  if (dashboard.children.length === 0) {
    return (
      <Card className="mt-8 p-6">
        <p className="text-sm font-bold text-amber-700">尚未連結孩子</p>
        <h2 className="mt-2 text-2xl font-black text-emerald-950">
          目前沒有可查看的學生報表
        </h2>
        <p className="mt-3 text-slate-600">
          家長入口只會顯示已驗證、仍有效的親子或監護關係。請聯絡機構管理員完成關係驗證。
        </p>
      </Card>
    );
  }

  const report = dashboard.selectedReport;

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-3" aria-label="孩子選擇器">
        <Card className="p-4">
          <p className="text-sm font-bold text-slate-500">Child Selector</p>
          <div className="mt-3 space-y-2">
            {dashboard.children.map((child) => {
              const selected = child.studentId === dashboard.selectedStudentId;
              return (
                <Link
                  aria-current={selected ? "page" : undefined}
                  className={
                    selected
                      ? "block rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white"
                      : "block rounded-xl border border-emerald-900/10 bg-white px-4 py-3 font-bold text-emerald-950 hover:bg-emerald-50"
                  }
                  href={`/dashboard/parent?studentId=${child.studentId}`}
                  key={child.studentId}
                >
                  <span className="block">{child.displayName}</span>
                  <span className="mt-1 block text-xs opacity-80">
                    {child.relationshipType} · 已驗證
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
      </aside>

      {report ? (
        <section className="space-y-6" aria-label="家長學習摘要">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="整體正確率"
              value={`${report.learningProgress.overallAccuracyPercent}%`}
            />
            <MetricCard
              label="作業總數"
              value={String(report.assignments.total)}
            />
            <MetricCard
              label="待加強知識點"
              value={String(report.weakKnowledge.length)}
            />
            <MetricCard
              label="建議練習"
              value={String(report.recommendations.length)}
            />
          </div>

          <Card className="p-5">
            <p className="text-sm font-bold text-amber-700">Parent Insight</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {report.insights.map((insight) => (
                <div
                  className="rounded-2xl border border-emerald-900/10 bg-emerald-50/60 p-4"
                  key={`${insight.title}-${insight.tone}`}
                >
                  <p className="font-black text-emerald-950">{insight.title}</p>
                  <p className="mt-2 text-sm text-slate-700">{insight.body}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-xl font-black text-emerald-950">
                Learning Progress
              </h2>
              <p className="mt-2 text-slate-600">
                {report.learningProgress.label}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <SummaryItem
                  label="精熟"
                  value={report.learningProgress.masterySummary.mastered}
                />
                <SummaryItem
                  label="穩定"
                  value={report.learningProgress.masterySummary.proficient}
                />
                <SummaryItem
                  label="發展中"
                  value={report.learningProgress.masterySummary.developing}
                />
                <SummaryItem
                  label="入門"
                  value={report.learningProgress.masterySummary.beginner}
                />
              </dl>
            </Card>

            <Card className="p-5">
              <h2 className="text-xl font-black text-emerald-950">
                Assignment Summary
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <SummaryItem
                  label="尚未開始"
                  value={report.assignments.counts.notStarted}
                />
                <SummaryItem
                  label="進行中"
                  value={report.assignments.counts.inProgress}
                />
                <SummaryItem
                  label="已繳交"
                  value={report.assignments.counts.submitted}
                />
                <SummaryItem
                  label="已逾期"
                  value={report.assignments.counts.overdue}
                />
              </dl>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {report.assignments.recent.map((assignment) => (
                  <li
                    className="rounded-xl bg-slate-50 p-3"
                    key={`${assignment.title}-${assignment.dueAt}`}
                  >
                    <span className="font-bold text-emerald-950">
                      {assignment.title}
                    </span>
                    <span className="ml-2 text-slate-500">
                      {STATUS_LABELS[assignment.status] ?? assignment.status}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <ListCard title="Strengths" values={report.strengths} />
            <ListCard
              title="Needs Improvement"
              values={report.weakKnowledge.map(
                (item) => `${item.knowledgePointId} · ${item.priority}`,
              )}
            />
            <ListCard
              title="Recommended Practice"
              values={report.recommendations.map((item) => item.message)}
            />
          </div>

          <Card className="p-5">
            <h2 className="text-xl font-black text-emerald-950">
              Recent Activity
            </h2>
            {report.recentActivity.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                目前尚無近期作答紀錄。
              </p>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {report.recentActivity.map((point) => (
                  <div
                    className="rounded-xl bg-white p-3 text-sm ring-1 ring-emerald-900/10"
                    key={point.date}
                  >
                    <p className="font-bold text-emerald-950">{point.date}</p>
                    <p className="mt-1 text-slate-600">
                      {point.questionCount} 題 ·{" "}
                      {Math.round(point.accuracy * 100)}%
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-emerald-950">{value}</p>
    </Card>
  );
}

function SummaryItem({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="font-bold text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-black text-emerald-950">{value}</dd>
    </div>
  );
}

function ListCard({
  title,
  values,
}: {
  readonly title: string;
  readonly values: readonly string[];
}) {
  return (
    <Card className="p-5">
      <h2 className="text-xl font-black text-emerald-950">{title}</h2>
      {values.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">目前沒有資料。</p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {values.map((value) => (
            <li className="rounded-xl bg-slate-50 p-3" key={value}>
              {value}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
