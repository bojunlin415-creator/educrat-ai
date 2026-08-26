import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createChartModel } from "@/lib/teacher-dashboard/chart";
import type {
  DashboardRiskLevel,
  TeacherDashboardViewModel,
} from "@/lib/teacher-dashboard/domain";

interface TeacherDashboardProps {
  readonly dashboard: TeacherDashboardViewModel;
}

const RISK_LABELS: Record<DashboardRiskLevel, string> = {
  high: "高風險",
  low: "穩定",
  medium: "中風險",
};

export function TeacherDashboard({ dashboard }: TeacherDashboardProps) {
  const accuracyChart = createChartModel({
    kind: "bar",
    points: dashboard.classPerformance.map((classroom) => ({
      label: `${classroom.className}（${classroom.learnerCount} 位）`,
      value: classroom.averageAccuracy,
    })),
    title: "班級平均正確率",
  });

  return (
    <section aria-labelledby="teacher-dashboard-title" className="mt-10">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="font-bold text-amber-700">Teacher Dashboard</p>
          <h2
            className="text-2xl font-black text-emerald-950"
            id="teacher-dashboard-title"
          >
            教學與學習狀態
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            資料由 Reporting Foundation 聚合；不直接查詢 Learning tables。
          </p>
        </div>
        <p className="text-xs font-bold text-slate-500">
          更新時間：{new Date(dashboard.generatedAt).toLocaleString("zh-TW")}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          label="目前學生"
          value={dashboard.todayOverview.rosterLearners}
        />
        <SummaryCard
          label="今日活躍學生"
          value={dashboard.todayOverview.todaysActiveStudents}
        />
        <SummaryCard
          label="待完成派發"
          value={dashboard.todayOverview.assignmentsDue}
        />
        <SummaryCard
          label="派發完成率"
          value={formatPercent(
            dashboard.todayOverview.assignmentCompletionRate,
          )}
        />
        <SummaryCard
          label="平均正確率"
          value={formatPercent(dashboard.todayOverview.averageAccuracy)}
        />
        <SummaryCard
          label="近期學習活動"
          value={dashboard.todayOverview.recentLearningActivity}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5">
          <SectionTitle title="Teaching Insights" />
          <div className="mt-4 space-y-3">
            {dashboard.insights.map((insight) => (
              <div
                className="rounded-2xl border border-emerald-950/10 bg-emerald-50/60 p-4"
                key={`${insight.title}-${insight.recommendation}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={riskClassName(insight.severity)}>
                    {RISK_LABELS[insight.severity]}
                  </Badge>
                  <h3 className="font-black text-emerald-950">
                    {insight.title}
                  </h3>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {insight.evidence}
                </p>
                <p className="mt-1 text-sm font-bold text-emerald-900">
                  {insight.recommendation}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Assignment Status" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniStat
              label="Pending"
              value={dashboard.assignmentStatus.pending}
            />
            <MiniStat
              label="In Progress"
              value={dashboard.assignmentStatus.inProgress}
            />
            <MiniStat
              label="Submitted"
              value={dashboard.assignmentStatus.submitted}
            />
            <MiniStat
              label="Overdue"
              value={dashboard.assignmentStatus.overdue}
            />
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Class Performance" />
          <div className="mt-4 space-y-4">
            {accuracyChart.points.length === 0 ? (
              <EmptyText>尚無班級表現資料。</EmptyText>
            ) : (
              accuracyChart.points.map((point) => (
                <ProgressRow
                  key={point.label}
                  label={point.label}
                  value={point.value}
                />
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Student Performance" />
          <div className="mt-4 divide-y divide-emerald-950/10">
            {dashboard.studentPerformance.length === 0 ? (
              <EmptyText>尚無學生表現資料。</EmptyText>
            ) : (
              dashboard.studentPerformance.slice(0, 8).map((student) => (
                <div
                  className="flex items-center justify-between gap-3 py-3"
                  key={student.metricReference}
                >
                  <div>
                    <p className="font-black text-emerald-950">
                      #{student.rank} 學習指標 {student.metricReference}
                    </p>
                    <p className="text-xs text-slate-500">
                      活動量 {student.activityCount} · Mastered{" "}
                      {student.masterySummary.mastered}
                    </p>
                  </div>
                  <Badge>{formatPercent(student.accuracy)}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Weak Knowledge" />
          <div className="mt-4 space-y-3">
            {dashboard.weakKnowledge.length === 0 ? (
              <EmptyText>尚無弱點知識點。</EmptyText>
            ) : (
              dashboard.weakKnowledge.slice(0, 6).map((item) => (
                <div
                  className="rounded-2xl border border-slate-200 p-4"
                  key={item.knowledgePointId}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-emerald-950">
                      {item.knowledgePointId}
                    </p>
                    <Badge className={riskClassName(item.riskLevel)}>
                      {RISK_LABELS[item.riskLevel]}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    影響學生 {item.affectedStudents} · 建議數{" "}
                    {item.recommendationCount}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="AI Recommendation" />
          <div className="mt-4 space-y-3">
            {dashboard.recommendations.length === 0 ? (
              <EmptyText>尚無推薦教材方向。</EmptyText>
            ) : (
              dashboard.recommendations.slice(0, 6).map((recommendation) => (
                <div
                  className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4"
                  key={`${recommendation.knowledgePointId}-${recommendation.recommendedDifficulty}`}
                >
                  <p className="font-black text-emerald-950">
                    {recommendation.recommendedWorksheet}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {recommendation.recommendedTopic} ·{" "}
                    {recommendation.recommendedDifficulty}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {recommendation.reason}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number | string;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-emerald-950">{value}</p>
    </Card>
  );
}

function SectionTitle({ title }: { readonly title: string }) {
  return <h3 className="text-lg font-black text-emerald-950">{title}</h3>;
}

function MiniStat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-emerald-950">{value}</p>
    </div>
  );
}

function ProgressRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold text-emerald-950">{label}</p>
        <p className="text-sm font-bold text-slate-600">
          {formatPercent(value)}
        </p>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          aria-label={`${label} ${formatPercent(value)}`}
          className="h-full rounded-full bg-emerald-700"
          style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
        />
      </div>
    </div>
  );
}

function EmptyText({ children }: { readonly children: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-emerald-900/20 bg-white p-4 text-sm text-slate-600">
      {children}
    </p>
  );
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function riskClassName(risk: DashboardRiskLevel): string {
  if (risk === "high") return "bg-red-50 text-red-700";
  if (risk === "medium") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}
