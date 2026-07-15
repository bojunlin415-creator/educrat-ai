"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChapterItem } from "@/components/curriculums/editor/chapter-item";
import { useHierarchy } from "@/components/curriculums/editor/hierarchy-context";

const PAGE_SIZE = 25;

export function CurriculumTree() {
  const { canEdit, chapters, notice, setSelection } = useHierarchy();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const effectiveVisibleCount = Math.max(
    PAGE_SIZE,
    Math.min(visibleCount, chapters.length),
  );
  const visibleChapters = chapters.slice(0, effectiveVisibleCount);

  return (
    <section aria-labelledby="curriculum-tree-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2
            className="text-lg font-black text-emerald-950"
            id="curriculum-tree-title"
          >
            教材結構
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            可拖曳排序；鍵盤使用者可使用上下移動按鈕。
          </p>
        </div>
        {canEdit ? (
          <Button
            className="shrink-0"
            onClick={() => setSelection({ kind: "chapter", mode: "create" })}
            variant="secondary"
          >
            新增章節
          </Button>
        ) : null}
      </div>

      {notice ? (
        <Alert
          className="mt-4"
          title={notice.type === "success" ? "已完成" : "操作失敗"}
          variant={notice.type}
        >
          {notice.message}
        </Alert>
      ) : null}

      {chapters.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-emerald-900/25 bg-emerald-50/50 p-6 text-center">
          <p className="font-black text-emerald-950">尚未建立章節</p>
          <p className="mt-2 text-sm text-slate-600">
            {canEdit
              ? "先建立第一個章節，再加入課次。"
              : "目前教材尚無可查看的章節。"}
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-3" role="tree">
            {visibleChapters.map((chapter, index) => (
              <ChapterItem chapter={chapter} index={index} key={chapter.id} />
            ))}
          </ul>
          {effectiveVisibleCount < chapters.length ? (
            <Button
              className="mt-4 w-full"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              variant="secondary"
            >
              載入更多章節
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
