import { render, screen } from "@testing-library/react";
import { ParentPortal } from "./parent-portal";
import type { ParentPortalDashboardViewModel } from "@/lib/parent-portal/domain";

const baseDashboard: ParentPortalDashboardViewModel = {
  children: [
    {
      displayName: "小晴",
      grade: null,
      relationshipType: "parent",
      studentId: "10000000-0000-4000-8000-000000000004",
      verifiedAt: "2026-08-01T00:00:00Z",
    },
    {
      displayName: "小宇",
      grade: null,
      relationshipType: "legal_guardian",
      studentId: "10000000-0000-4000-8000-000000000005",
      verifiedAt: "2026-08-01T00:00:00Z",
    },
  ],
  selectedReport: {
    assignments: {
      counts: { inProgress: 1, notStarted: 1, overdue: 0, submitted: 2 },
      recent: [
        {
          dueAt: "2026-08-10T00:00:00Z",
          status: "submitted",
          title: "分數加減練習",
        },
      ],
      total: 4,
    },
    child: {
      displayName: "小晴",
      grade: null,
      relationshipType: "parent",
      studentId: "10000000-0000-4000-8000-000000000004",
      verifiedAt: "2026-08-01T00:00:00Z",
    },
    insights: [
      {
        body: "孩子正在穩定累積能力，建議維持規律練習。",
        title: "本週學習概況",
        tone: "encouraging",
      },
    ],
    learningProgress: {
      label: "孩子正在穩定累積能力，建議維持規律練習。",
      masterySummary: {
        beginner: 1,
        developing: 2,
        mastered: 1,
        proficient: 1,
        unknown: 0,
      },
      overallAccuracyPercent: 76,
      status: "steady",
    },
    recentActivity: [{ accuracy: 0.76, date: "2026-08-01", questionCount: 8 }],
    recommendations: [
      {
        difficulty: "medium",
        knowledgePointId: "分數加減",
        message: "建議練習 分數加減，難易度可從 medium 開始。",
      },
    ],
    strengths: ["整體正確率表現穩定"],
    weakKnowledge: [{ knowledgePointId: "位值概念", priority: "practice" }],
  },
  selectedStudentId: "10000000-0000-4000-8000-000000000004",
};

describe("PP-001 ParentPortal component", () => {
  it("renders no-child empty state", () => {
    render(
      <ParentPortal
        dashboard={{
          children: [],
          selectedReport: null,
          selectedStudentId: null,
        }}
      />,
    );

    expect(screen.getByText("目前沒有可查看的學生報表")).toBeInTheDocument();
  });

  it("renders multiple-child selector and selected report", () => {
    render(<ParentPortal dashboard={baseDashboard} />);

    expect(screen.getByLabelText("孩子選擇器")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /小晴/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /小宇/ })).toBeInTheDocument();
    expect(screen.getByText("Learning Progress")).toBeInTheDocument();
    expect(screen.getByText("Assignment Summary")).toBeInTheDocument();
    expect(screen.getByText("Recommended Practice")).toBeInTheDocument();
  });

  it("does not render raw internal report fields", () => {
    const { container } = render(<ParentPortal dashboard={baseDashboard} />);

    expect(container.textContent).not.toContain("mastery_score");
    expect(container.textContent).not.toContain("internal_reason");
    expect(container.textContent).not.toContain("assignment_submissions");
  });
});
