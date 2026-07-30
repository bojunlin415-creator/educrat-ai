export interface MasterySummary {
  readonly beginner: number;
  readonly developing: number;
  readonly mastered: number;
  readonly proficient: number;
  readonly unknown: number;
}

export interface TrendPoint {
  readonly accuracy: number;
  readonly date: string;
  readonly questionCount: number;
}

export interface StudentReportViewModel {
  readonly learningTrend: readonly TrendPoint[];
  readonly masterySummary: MasterySummary;
  readonly overallAccuracy: number;
  readonly recommendationCount: number;
  readonly recommendedDifficulty: readonly {
    readonly difficulty: string;
    readonly knowledgePointId: string;
  }[];
  readonly studentId: string;
  readonly weakKnowledge: readonly {
    readonly knowledgePointId: string;
    readonly masteryScore: number;
    readonly reason: string;
  }[];
}

export interface TeacherReportViewModel {
  readonly activityTrend: readonly TrendPoint[];
  readonly assignmentCompletion: {
    readonly assigned: number;
    readonly submitted: number;
    readonly submissionRate: number;
  };
  readonly classAccuracy: number;
  readonly classId: string;
  readonly studentRanking: readonly {
    readonly accuracy: number;
    readonly studentId: string;
  }[];
  readonly weakKnowledgeRanking: readonly {
    readonly accuracy: number;
    readonly attemptCount: number;
    readonly knowledgePointId: string;
  }[];
}

export interface OrganizationReportViewModel {
  readonly classComparison: readonly {
    readonly accuracy: number;
    readonly classId: string;
  }[];
  readonly knowledgeDistribution: Readonly<Record<string, number>>;
  readonly learningActivity: readonly TrendPoint[];
  readonly organizationAccuracy: number;
  readonly organizationId: string;
  readonly teacherComparison: readonly {
    readonly accuracy: number;
    readonly teacherId: string;
  }[];
}

export type ReportExportFormat = "csv" | "excel" | "pdf";

export interface ReportExportContract {
  readonly format: ReportExportFormat;
  readonly label: string;
  readonly mimeType: string;
  readonly supportedReports: readonly (
    "organization" | "student" | "teacher"
  )[];
}

const ALL_REPORT_TYPES = ["organization", "student", "teacher"] as const;

export const REPORT_EXPORT_CONTRACTS: readonly ReportExportContract[] =
  Object.freeze([
    Object.freeze({
      format: "pdf",
      label: "PDF Export Contract",
      mimeType: "application/pdf",
      supportedReports: ALL_REPORT_TYPES,
    }),
    Object.freeze({
      format: "excel",
      label: "Excel Export Contract",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      supportedReports: ALL_REPORT_TYPES,
    }),
    Object.freeze({
      format: "csv",
      label: "CSV Export Contract",
      mimeType: "text/csv",
      supportedReports: ALL_REPORT_TYPES,
    }),
  ]);

export function buildMasterySummary(
  distributions: readonly Record<string, number>[],
): MasterySummary {
  return Object.freeze(
    distributions.reduce<MasterySummary>(
      (summary, distribution) => ({
        beginner: summary.beginner + (distribution.beginner ?? 0),
        developing: summary.developing + (distribution.developing ?? 0),
        mastered: summary.mastered + (distribution.mastered ?? 0),
        proficient: summary.proficient + (distribution.proficient ?? 0),
        unknown: summary.unknown + (distribution.unknown ?? 0),
      }),
      {
        beginner: 0,
        developing: 0,
        mastered: 0,
        proficient: 0,
        unknown: 0,
      },
    ),
  );
}

export function calculateAverage(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4),
  );
}
