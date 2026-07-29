"use client";

import type { CurriculumChapter } from "@/lib/curriculum/service";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ChapterEditor } from "@/components/curriculums/editor/chapter-editor";
import { CurriculumTree } from "@/components/curriculums/editor/curriculum-tree";
import { EditorToolbar } from "@/components/curriculums/editor/editor-toolbar";
import {
  HierarchyProvider,
  useHierarchy,
} from "@/components/curriculums/editor/hierarchy-context";
import { LessonEditor } from "@/components/curriculums/editor/lesson-editor";

function ReadonlySelection() {
  const { chapters, selection } = useHierarchy();
  if (!selection) return null;
  const chapter =
    selection.kind === "chapter"
      ? selection.mode === "edit"
        ? chapters.find((item) => item.id === selection.chapterId)
        : undefined
      : chapters.find((item) => item.id === selection.chapterId);
  const lesson =
    selection.kind === "lesson" && selection.mode === "edit"
      ? chapter?.lessons.find((item) => item.id === selection.lessonId)
      : undefined;

  return (
    <section aria-labelledby="readonly-selection-title">
      <p className="text-sm font-bold text-amber-700">唯讀模式</p>
      <h2
        className="mt-1 text-xl font-black text-emerald-950"
        id="readonly-selection-title"
      >
        {lesson?.title ?? chapter?.title ?? "教材內容"}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        教師與教材審核者可以查看章節與課次，但只有機構擁有者或管理員可以修改。
      </p>
      {lesson ? (
        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="font-bold text-slate-500">預估時間</dt>
            <dd className="mt-1 text-slate-900">
              {lesson.estimated_minutes
                ? `${lesson.estimated_minutes} 分鐘`
                : "未設定"}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">學習目標</dt>
            <dd className="mt-1 text-slate-900">
              {lesson.learning_objectives.length > 0
                ? lesson.learning_objectives.join("、")
                : "未設定"}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">教學備註</dt>
            <dd className="mt-1 whitespace-pre-wrap text-slate-900">
              {lesson.teaching_notes || "未設定"}
            </dd>
          </div>
        </dl>
      ) : chapter ? (
        <p className="mt-6 text-sm leading-6 whitespace-pre-wrap text-slate-700">
          {chapter.description || "尚無章節說明。"}
        </p>
      ) : null}
    </section>
  );
}

function EditorPanel() {
  const { canEdit, selection } = useHierarchy();

  if (!selection) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-2xl border border-dashed border-emerald-900/20 bg-emerald-50/40 p-8 text-center">
        <div>
          <p className="font-black text-emerald-950">選擇一個章節或課次</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
            左側為教材樹，右側會顯示所選內容。只有草稿版本可以編輯；發布後請建立新版本再修改。
          </p>
        </div>
      </div>
    );
  }

  if (!canEdit) return <ReadonlySelection />;
  if (selection.kind === "chapter") {
    return (
      <ChapterEditor
        key={
          selection.mode === "edit"
            ? `chapter:${selection.chapterId}`
            : "chapter:create"
        }
      />
    );
  }
  return (
    <LessonEditor
      key={
        selection.mode === "edit"
          ? `lesson:${selection.lessonId}`
          : `lesson:create:${selection.chapterId}`
      }
    />
  );
}

export function CurriculumEditor({
  canEdit,
  chapters,
  versionId,
  versionNumber,
  versionStatus,
}: {
  canEdit: boolean;
  chapters: CurriculumChapter[];
  versionId: string;
  versionNumber: number;
  versionStatus: "archived" | "draft" | "in_review" | "published";
}) {
  return (
    <HierarchyProvider
      canEdit={canEdit}
      initialChapters={chapters}
      versionId={versionId}
    >
      <EditorToolbar version={versionNumber} versionStatus={versionStatus} />
      {!canEdit ? (
        <Alert className="mt-4" title="唯讀權限" variant="success">
          你可以查看教材結構；修改功能僅開放機構擁有者與管理員。
        </Alert>
      ) : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(22rem,7fr)]">
        <Card className="min-w-0 p-5">
          <CurriculumTree />
        </Card>
        <Card className="min-w-0 p-5 sm:p-6">
          <EditorPanel />
        </Card>
      </div>
    </HierarchyProvider>
  );
}
