"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHierarchy } from "@/components/curriculums/editor/hierarchy-context";

export function EditorToolbar({
  version,
  versionStatus,
}: {
  version: number;
  versionStatus: "draft" | "published" | "archived";
}) {
  const { canEdit, collapseAll, expandAll, pendingOrder, setSelection } =
    useHierarchy();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-950/10 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>版本 {version}（唯讀）</Badge>
        <Badge className="bg-amber-50 text-amber-800">
          {versionStatus === "published" ? "已發布" : "草稿"}
        </Badge>
        {pendingOrder ? (
          <span aria-live="polite" className="text-sm text-slate-600">
            正在儲存排序…
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={expandAll} variant="secondary">
          全部展開
        </Button>
        <Button onClick={collapseAll} variant="secondary">
          全部收合
        </Button>
        {canEdit ? (
          <Button
            onClick={() => setSelection({ kind: "chapter", mode: "create" })}
          >
            新增章節
          </Button>
        ) : null}
      </div>
    </div>
  );
}
