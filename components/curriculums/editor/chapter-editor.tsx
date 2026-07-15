"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { sendHierarchyMutation } from "@/lib/curriculum/hierarchy-client";
import {
  chapterEditorFormSchema,
  type ChapterEditorFormInput,
} from "@/lib/validation/curriculum-hierarchy";
import { useHierarchy } from "@/components/curriculums/editor/hierarchy-context";

type FormNotice = { type: "success" | "error"; message: string } | null;

export function ChapterEditor() {
  const {
    chapters,
    refreshHierarchy,
    selection,
    setNotice: setHierarchyNotice,
    setSelection,
    versionId,
  } = useHierarchy();
  const [notice, setNotice] = useState<FormNotice>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isEdit = selection?.kind === "chapter" && selection.mode === "edit";
  const chapter = isEdit
    ? chapters.find((item) => item.id === selection.chapterId)
    : undefined;
  const nextChapterNo =
    Math.max(0, ...chapters.map((item) => item.chapter_no)) + 1;

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<ChapterEditorFormInput>({
    defaultValues: {
      chapterNo: chapter?.chapter_no ?? nextChapterNo,
      description: chapter?.description ?? "",
      status: chapter?.status === "active" ? "active" : "draft",
      title: chapter?.title ?? "",
    },
    resolver: zodResolver(chapterEditorFormSchema),
  });

  async function onSubmit(values: ChapterEditorFormInput) {
    setNotice(null);
    try {
      const payload = isEdit
        ? await sendHierarchyMutation("/api/chapters", "PATCH", {
            action: "update",
            chapterId: selection.chapterId,
            ...values,
          })
        : await sendHierarchyMutation("/api/chapters", "POST", {
            versionId,
            ...values,
          });
      setNotice({ type: "success", message: payload.message });
      setHierarchyNotice({ type: "success", message: payload.message });
      if (!isEdit && payload.entityId) {
        setSelection(null);
      }
      refreshHierarchy();
    } catch (error: unknown) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "目前無法儲存章節。",
      });
    }
  }

  async function onDelete() {
    if (!chapter) return;
    setNotice(null);
    try {
      const payload = await sendHierarchyMutation("/api/chapters", "DELETE", {
        chapterId: chapter.id,
      });
      setConfirmDelete(false);
      setSelection(null);
      setHierarchyNotice({ type: "success", message: payload.message });
      refreshHierarchy();
    } catch (error: unknown) {
      setConfirmDelete(false);
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "目前無法刪除章節。",
      });
    }
  }

  return (
    <section aria-labelledby="chapter-editor-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-amber-700">Chapter</p>
          <h2
            className="mt-1 text-xl font-black text-emerald-950"
            id="chapter-editor-title"
          >
            {isEdit ? "編輯章節" : "新增章節"}
          </h2>
        </div>
        <Button onClick={() => setSelection(null)} variant="ghost">
          關閉
        </Button>
      </div>

      <form
        className="mt-6 space-y-5"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
      >
        <Input
          error={errors.chapterNo?.message}
          label="章節編號"
          max={9999}
          min={1}
          type="number"
          {...register("chapterNo", { valueAsNumber: true })}
        />
        <Input
          error={errors.title?.message}
          label="章節標題"
          maxLength={160}
          {...register("title")}
        />
        <label className="block font-bold text-emerald-950">
          章節說明
          <textarea
            className="mt-2 block min-h-32 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900 hover:border-emerald-600"
            maxLength={3000}
            {...register("description")}
          />
          {errors.description ? (
            <span className="mt-1.5 block text-sm font-medium text-red-700">
              {errors.description.message}
            </span>
          ) : null}
        </label>
        <Select
          error={errors.status?.message}
          label="狀態"
          options={[
            { label: "草稿", value: "draft" },
            { label: "已發布", value: "active" },
          ]}
          {...register("status")}
        />

        {notice ? (
          <Alert
            title={notice.type === "success" ? "已儲存" : "操作失敗"}
            variant={notice.type}
          >
            {notice.message}
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button loading={isSubmitting} type="submit">
            {isEdit ? "儲存章節" : "建立章節"}
          </Button>
          {isEdit ? (
            <Button onClick={() => setConfirmDelete(true)} variant="danger">
              刪除章節
            </Button>
          ) : null}
        </div>
      </form>

      <Dialog
        description="刪除章節會一併刪除其中所有課次，且無法復原。"
        onClose={() => setConfirmDelete(false)}
        open={confirmDelete}
        title="確定刪除章節？"
      >
        <div className="flex flex-wrap justify-end gap-3">
          <Button onClick={() => setConfirmDelete(false)} variant="secondary">
            取消
          </Button>
          <Button onClick={() => void onDelete()} variant="danger">
            確定刪除
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
