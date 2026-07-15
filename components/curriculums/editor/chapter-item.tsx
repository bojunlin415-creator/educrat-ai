"use client";

import type { KeyboardEvent } from "react";
import type { CurriculumChapter } from "@/lib/curriculum/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LessonItem } from "@/components/curriculums/editor/lesson-item";
import { useHierarchy } from "@/components/curriculums/editor/hierarchy-context";

export function ChapterItem({
  chapter,
  index,
}: {
  chapter: CurriculumChapter;
  index: number;
}) {
  const {
    canEdit,
    chapters,
    expandedChapterIds,
    moveChapter,
    pendingOrder,
    selection,
    setSelection,
    toggleChapter,
  } = useHierarchy();
  const expanded = expandedChapterIds.has(chapter.id);

  function moveBy(offset: -1 | 1) {
    const target = chapters[index + offset];
    if (target) void moveChapter(chapter.id, target.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowRight" && !expanded) {
      event.preventDefault();
      toggleChapter(chapter.id);
    }
    if (event.key === "ArrowLeft" && expanded) {
      event.preventDefault();
      toggleChapter(chapter.id);
    }
  }

  return (
    <li
      aria-expanded={expanded}
      aria-selected={
        selection?.kind === "chapter" &&
        selection.mode === "edit" &&
        selection.chapterId === chapter.id
      }
      className="rounded-2xl border border-emerald-950/10 bg-slate-50 p-3"
      draggable={canEdit && !pendingOrder}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", `chapter:${chapter.id}`);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        if (canEdit) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const value = event.dataTransfer.getData("text/plain");
        if (value.startsWith("chapter:")) {
          void moveChapter(value.slice(8), chapter.id);
        }
      }}
      role="treeitem"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-label={`${expanded ? "收合" : "展開"}第 ${chapter.chapter_no} 章`}
          className="min-h-10 rounded-lg px-3 font-black text-emerald-900 hover:bg-white"
          onClick={() => toggleChapter(chapter.id)}
          onKeyDown={handleKeyDown}
          type="button"
        >
          {expanded ? "▾" : "▸"}
        </button>
        <button
          className="min-h-10 min-w-0 flex-1 rounded-lg px-2 text-left font-black text-emerald-950 hover:bg-white"
          onClick={() =>
            setSelection({
              chapterId: chapter.id,
              kind: "chapter",
              mode: "edit",
            })
          }
          type="button"
        >
          第 {chapter.chapter_no} 章　{chapter.title}
        </button>
        <Badge>{chapter.status === "active" ? "已發布" : "草稿"}</Badge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1 pl-12">
        <span className="mr-auto text-xs text-slate-500">
          {chapter.lessons.length} 個課次
        </span>
        {canEdit ? (
          <>
            <Button
              aria-label={`將第 ${chapter.chapter_no} 章向上移`}
              className="min-h-9 px-3 py-1 text-sm"
              disabled={index === 0 || pendingOrder}
              onClick={() => moveBy(-1)}
              variant="ghost"
            >
              ↑
            </Button>
            <Button
              aria-label={`將第 ${chapter.chapter_no} 章向下移`}
              className="min-h-9 px-3 py-1 text-sm"
              disabled={index === chapters.length - 1 || pendingOrder}
              onClick={() => moveBy(1)}
              variant="ghost"
            >
              ↓
            </Button>
            <Button
              className="min-h-9 px-3 py-1 text-sm"
              onClick={() => {
                if (!expanded) toggleChapter(chapter.id);
                setSelection({
                  chapterId: chapter.id,
                  kind: "lesson",
                  mode: "create",
                });
              }}
              variant="secondary"
            >
              新增課次
            </Button>
          </>
        ) : null}
      </div>

      {expanded ? (
        chapter.lessons.length === 0 ? (
          <p className="mt-3 ml-12 rounded-xl bg-white p-3 text-sm text-slate-500">
            尚無課次。
          </p>
        ) : (
          <ul
            className="mt-3 ml-6 space-y-2 border-l border-slate-200 pl-5"
            role="group"
          >
            {chapter.lessons.map((lesson, lessonIndex) => (
              <LessonItem
                chapterId={chapter.id}
                index={lessonIndex}
                key={lesson.id}
                lesson={lesson}
                lessons={chapter.lessons}
              />
            ))}
          </ul>
        )
      ) : null}
    </li>
  );
}
