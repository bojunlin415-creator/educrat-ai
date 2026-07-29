"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CurriculumReferenceOptions } from "@/lib/curriculum/service";
import {
  aiCurriculumGeneratedDraftSchema,
  type AICurriculumGeneratedDraft,
} from "@/lib/validation/ai-curriculum-generation";

type Status =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

interface RequestState {
  readonly competencyIndicators: string;
  readonly curriculumReferenceId: string;
  readonly curriculumTopic: string;
  readonly difficulty: "EASY" | "MEDIUM" | "HARD";
  readonly gradeId: string;
  readonly knowledgePoints: string;
  readonly learningObjectives: string;
  readonly purpose: string;
  readonly questionCount: number;
  readonly schoolYear: number;
  readonly semester: 1 | 2;
  readonly subjectId: string;
}

const MULTILINE_FIELDS = [
  ["知識點（每行一個）", "knowledgePoints"],
  ["能力指標（每行一個）", "competencyIndicators"],
  ["教學目標（每行一個）", "learningObjectives"],
] as const satisfies readonly [
  string,
  "competencyIndicators" | "knowledgePoints" | "learningObjectives",
][];

const generateResponseSchema = z.object({
  draft: aiCurriculumGeneratedDraftSchema,
  message: z.string(),
  success: z.literal(true),
});

const saveResponseSchema = z.object({
  message: z.string(),
  redirectTo: z.string().optional(),
  success: z.boolean(),
});

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinLines(values: readonly string[]): string {
  return values.join("\n");
}

function defaultRequest(options: CurriculumReferenceOptions): RequestState {
  return {
    competencyIndicators: "",
    curriculumReferenceId: options.references[0]?.id ?? "",
    curriculumTopic: "",
    difficulty: "MEDIUM",
    gradeId: options.grades[0]?.id ?? "",
    knowledgePoints: "",
    learningObjectives: "",
    purpose: "課堂補充教材",
    questionCount: 6,
    schoolYear: 115,
    semester: 1,
    subjectId: options.subjects[0]?.id ?? "",
  };
}

function fieldLabel(id: string, options: CurriculumReferenceOptions) {
  return {
    grade: options.grades.find((item) => item.id === id)?.code ?? "1",
    subject:
      options.subjects.find((item) => item.id === id)?.name ?? "未選擇科目",
  };
}

function updateQuestion(
  draft: AICurriculumGeneratedDraft,
  type: "challengeQuestions" | "questions",
  index: number,
  key: "answer" | "explanation" | "prompt",
  value: string,
): AICurriculumGeneratedDraft {
  return {
    ...draft,
    [type]: draft[type].map((question, questionIndex) =>
      questionIndex === index ? { ...question, [key]: value } : question,
    ),
  };
}

export function AICurriculumGenerator({
  options,
}: {
  options: CurriculumReferenceOptions;
}) {
  const router = useRouter();
  const [request, setRequest] = useState<RequestState>(() =>
    defaultRequest(options),
  );
  const [draft, setDraft] = useState<AICurriculumGeneratedDraft | null>(null);
  const [saveRequestId, setSaveRequestId] = useState<string>(() =>
    crypto.randomUUID(),
  );
  const [originalDraft, setOriginalDraft] =
    useState<AICurriculumGeneratedDraft | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const labels = useMemo(
    () => ({
      grade: fieldLabel(request.gradeId, options).grade,
      subject: fieldLabel(request.subjectId, options).subject,
    }),
    [options, request.gradeId, request.subjectId],
  );

  async function generate() {
    setStatus({ type: "idle" });
    setIsGenerating(true);
    try {
      const response = await fetch("/api/curriculums/generate", {
        body: JSON.stringify({
          competencyIndicators: splitLines(request.competencyIndicators),
          curriculumTopic: request.curriculumTopic,
          difficulty: request.difficulty,
          grade: Number(labels.grade),
          knowledgePoints: splitLines(request.knowledgePoints),
          language: "zh-TW",
          learningObjectives: splitLines(request.learningObjectives),
          learningStage: "國民小學",
          purpose: request.purpose,
          questionCount: request.questionCount,
          subject: labels.subject,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "message" in payload &&
          typeof payload.message === "string"
            ? payload.message
            : "AI 生成失敗，請稍後再試。";
        setStatus({ message, type: "error" });
        return;
      }
      const parsed = generateResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("AI 回應格式不正確。");
      setDraft(parsed.data.draft);
      setOriginalDraft(parsed.data.draft);
      setSaveRequestId(crypto.randomUUID());
      setStatus({ message: parsed.data.message, type: "success" });
    } catch (error: unknown) {
      setStatus({
        message:
          error instanceof Error ? error.message : "AI 生成失敗，請稍後再試。",
        type: "error",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveDraft() {
    if (!draft || !originalDraft) return;
    setStatus({ type: "idle" });
    setIsSaving(true);
    try {
      const response = await fetch("/api/curriculums/generate/save", {
        body: JSON.stringify({
          clientRequestId: saveRequestId,
          curriculumReferenceId: request.curriculumReferenceId,
          generatedDraft: draft,
          gradeId: request.gradeId,
          originalDraft,
          request: {
            competencyIndicators: splitLines(request.competencyIndicators),
            curriculumTopic: request.curriculumTopic,
            difficulty: request.difficulty,
            grade: Number(labels.grade),
            knowledgePoints: splitLines(request.knowledgePoints),
            language: "zh-TW",
            learningObjectives: splitLines(request.learningObjectives),
            learningStage: "國民小學",
            purpose: request.purpose,
            questionCount: request.questionCount,
            subject: labels.subject,
          },
          schoolYear: request.schoolYear,
          semester: request.semester,
          subjectId: request.subjectId,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload: unknown = await response.json();
      const parsed = saveResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("伺服器回應格式不正確。");
      if (!response.ok || !parsed.data.success) {
        setStatus({ message: parsed.data.message, type: "error" });
        return;
      }
      setStatus({ message: parsed.data.message, type: "success" });
      router.push(parsed.data.redirectTo ?? "/curriculums");
      router.refresh();
    } catch (error: unknown) {
      setStatus({
        message:
          error instanceof Error ? error.message : "目前無法儲存 AI 草稿。",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section aria-labelledby="ai-curriculum-title" className="space-y-6">
      <div>
        <p className="text-sm font-bold text-emerald-700">AI 原創教材</p>
        <h2
          className="mt-1 text-2xl font-black text-emerald-950"
          id="ai-curriculum-title"
        >
          依課綱與知識點生成教材草稿
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          請輸入學習主題、能力指標與教學目標。系統不接受出版社名稱、教師手冊、題庫或課文引用。
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="學習領域"
          options={options.subjects.map((subject) => ({
            label: subject.name,
            value: subject.id,
          }))}
          value={request.subjectId}
          onChange={(event) =>
            setRequest({ ...request, subjectId: event.target.value })
          }
        />
        <Select
          label="學習級別"
          options={options.grades.map((grade) => ({
            label: grade.name,
            value: grade.id,
          }))}
          value={request.gradeId}
          onChange={(event) =>
            setRequest({ ...request, gradeId: event.target.value })
          }
        />
        <Input
          label="學習主題"
          placeholder="例如：分數加減"
          value={request.curriculumTopic}
          onChange={(event) =>
            setRequest({ ...request, curriculumTopic: event.target.value })
          }
        />
        <Select
          label="難易度"
          options={[
            { label: "基礎", value: "EASY" },
            { label: "適中", value: "MEDIUM" },
            { label: "進階", value: "HARD" },
          ]}
          value={request.difficulty}
          onChange={(event) =>
            setRequest({
              ...request,
              difficulty: event.target.value as RequestState["difficulty"],
            })
          }
        />
        <Input
          label="題數"
          max={20}
          min={1}
          type="number"
          value={request.questionCount}
          onChange={(event) =>
            setRequest({
              ...request,
              questionCount: Number(event.target.value),
            })
          }
        />
        <Input
          label="草稿年度"
          max={999}
          min={100}
          type="number"
          value={request.schoolYear}
          onChange={(event) =>
            setRequest({ ...request, schoolYear: Number(event.target.value) })
          }
        />
        <Select
          label="草稿期別"
          options={[
            { label: "上學期", value: "1" },
            { label: "下學期", value: "2" },
          ]}
          value={String(request.semester)}
          onChange={(event) =>
            setRequest({
              ...request,
              semester: Number(event.target.value) as 1 | 2,
            })
          }
        />
        <Select
          label="儲存用教材進度架構"
          options={options.references.map((reference) => ({
            label: reference.displayName,
            value: reference.id,
          }))}
          value={request.curriculumReferenceId}
          onChange={(event) =>
            setRequest({
              ...request,
              curriculumReferenceId: event.target.value,
            })
          }
        />
      </div>

      {MULTILINE_FIELDS.map(([label, key]) => (
        <label className="block font-bold text-emerald-950" key={key}>
          {label}
          <textarea
            className="mt-2 block min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900 hover:border-emerald-600"
            value={request[key]}
            onChange={(event) =>
              setRequest({ ...request, [key]: event.target.value })
            }
          />
        </label>
      ))}

      <Input
        label="教材用途"
        placeholder="例如：課堂補充教材、課後練習、段考複習"
        value={request.purpose}
        onChange={(event) =>
          setRequest({ ...request, purpose: event.target.value })
        }
      />

      {status.type !== "idle" ? (
        <Alert
          title={status.type === "success" ? "已完成" : "無法處理"}
          variant={status.type}
        >
          {status.message}
        </Alert>
      ) : null}

      <Button loading={isGenerating} onClick={generate}>
        AI Generate
      </Button>

      {draft ? (
        <div className="space-y-6 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
          <Input
            label="教材標題"
            value={draft.title}
            onChange={(event) =>
              setDraft({ ...draft, title: event.target.value })
            }
          />
          <label className="block font-bold text-emerald-950">
            教學目標
            <textarea
              className="mt-2 block min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900"
              value={joinLines(draft.learningObjectives)}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  learningObjectives: splitLines(event.target.value),
                })
              }
            />
          </label>
          <label className="block font-bold text-emerald-950">
            重點整理 / Explanation
            <textarea
              className="mt-2 block min-h-32 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900"
              value={joinLines(draft.summary)}
              onChange={(event) =>
                setDraft({ ...draft, summary: splitLines(event.target.value) })
              }
            />
          </label>
          <div className="space-y-4">
            <h3 className="font-black text-emerald-950">練習題與解析</h3>
            {draft.questions.map((question, index) => (
              <div className="rounded-xl bg-white p-4" key={index}>
                <Input
                  label={`題目 ${index + 1}`}
                  value={question.prompt}
                  onChange={(event) =>
                    setDraft(
                      updateQuestion(
                        draft,
                        "questions",
                        index,
                        "prompt",
                        event.target.value,
                      ),
                    )
                  }
                />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Input
                    label="答案"
                    value={question.answer}
                    onChange={(event) =>
                      setDraft(
                        updateQuestion(
                          draft,
                          "questions",
                          index,
                          "answer",
                          event.target.value,
                        ),
                      )
                    }
                  />
                  <Input
                    label="解析"
                    value={question.explanation ?? ""}
                    onChange={(event) =>
                      setDraft(
                        updateQuestion(
                          draft,
                          "questions",
                          index,
                          "explanation",
                          event.target.value,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <label className="block font-bold text-emerald-950">
            解答總覽
            <textarea
              className="mt-2 block min-h-24 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900"
              value={joinLines(draft.solutions)}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  solutions: splitLines(event.target.value),
                })
              }
            />
          </label>
          <label className="block font-bold text-emerald-950">
            教師提醒 / Analysis
            <textarea
              className="mt-2 block min-h-24 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900"
              value={joinLines(draft.teacherNotes)}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  teacherNotes: splitLines(event.target.value),
                })
              }
            />
          </label>
          <Button loading={isSaving} onClick={saveDraft}>
            儲存為教材草稿
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function AICurriculumGeneratorPanel({
  initiallyOpen = false,
  options,
}: {
  initiallyOpen?: boolean;
  options: CurriculumReferenceOptions;
}) {
  const [open, setOpen] = useState(initiallyOpen);

  if (open) return <AICurriculumGenerator options={options} />;

  return (
    <section aria-labelledby="ai-curriculum-collapsed-title">
      <p className="text-sm font-bold text-emerald-700">AI 原創教材</p>
      <h2
        className="mt-1 text-xl font-black text-emerald-950"
        id="ai-curriculum-collapsed-title"
      >
        依課綱與知識點生成教材草稿
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        這個工具會呼叫 AI
        生成完全原創教材。展開後可填寫條件、預覽、編輯並儲存為草稿。
      </p>
      <Button className="mt-5" onClick={() => setOpen(true)}>
        開啟 AI Generate
      </Button>
    </section>
  );
}
