"use client";

import type { Database } from "@/lib/supabase/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHierarchy } from "@/components/curriculums/editor/hierarchy-context";

type Lesson = Database["public"]["Tables"]["lessons"]["Row"];

export function LessonItem({
  chapterId,
  index,
  lesson,
  lessons,
}: {
  chapterId: string;
  index: number;
  lesson: Lesson;
  lessons: Lesson[];
}) {
  const { canEdit, moveLesson, pendingOrder, selection, setSelection } =
    useHierarchy();

  function moveBy(offset: -1 | 1) {
    const target = lessons[index + offset];
    if (target) void moveLesson(chapterId, lesson.id, target.id);
  }

  return (
    <li
      aria-label={`第 ${lesson.lesson_no} 課 ${lesson.title}`}
      aria-selected={
        selection?.kind === "lesson" &&
        selection.mode === "edit" &&
        selection.lessonId === lesson.id
      }
      className="rounded-xl border border-slate-200 bg-white p-3"
      draggable={canEdit && !pendingOrder}
      onDragStart={(event) => {
        event.stopPropagation();
        event.dataTransfer.setData("text/plain", `lesson:${lesson.id}`);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        if (canEdit) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const value = event.dataTransfer.getData("text/plain");
        if (value.startsWith("lesson:")) {
          void moveLesson(chapterId, value.slice(7), lesson.id);
        }
      }}
      role="treeitem"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          className="min-h-10 flex-1 rounded-lg px-2 text-left font-bold text-slate-900 hover:bg-emerald-50"
          onClick={() =>
            setSelection({
              chapterId,
              kind: "lesson",
              lessonId: lesson.id,
              mode: "edit",
            })
          }
          type="button"
        >
          第 {lesson.lesson_no} 課　{lesson.title}
        </button>
        <Badge>{lesson.status === "active" ? "已發布" : "草稿"}</Badge>
      </div>
      {canEdit ? (
        <div className="mt-2 flex flex-wrap gap-1" aria-label="課次排序操作">
          <Button
            aria-label={`將第 ${lesson.lesson_no} 課向上移`}
            className="min-h-9 px-3 py-1 text-sm"
            disabled={index === 0 || pendingOrder}
            onClick={() => moveBy(-1)}
            variant="ghost"
          >
            ↑
          </Button>
          <Button
            aria-label={`將第 ${lesson.lesson_no} 課向下移`}
            className="min-h-9 px-3 py-1 text-sm"
            disabled={index === lessons.length - 1 || pendingOrder}
            onClick={() => moveBy(1)}
            variant="ghost"
          >
            ↓
          </Button>
        </div>
      ) : null}
    </li>
  );
}
