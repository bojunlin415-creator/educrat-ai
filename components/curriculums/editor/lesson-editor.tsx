"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useController, useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { sendHierarchyMutation } from "@/lib/curriculum/hierarchy-client";
import {
  lessonEditorFormSchema,
  type LessonEditorFormInput,
} from "@/lib/validation/curriculum-hierarchy";
import { useHierarchy } from "@/components/curriculums/editor/hierarchy-context";

type FormNotice = { type: "success" | "error"; message: string } | null;

export function LessonEditor() {
  const {
    chapters,
    refreshHierarchy,
    selection,
    setNotice: setHierarchyNotice,
    setSelection,
  } = useHierarchy();
  const [notice, setNotice] = useState<FormNotice>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const chapterId = selection?.kind === "lesson" ? selection.chapterId : "";
  const chapter = chapters.find((item) => item.id === chapterId);
  const isEdit = selection?.kind === "lesson" && selection.mode === "edit";
  const lesson = isEdit
    ? chapter?.lessons.find((item) => item.id === selection.lessonId)
    : undefined;
  const nextLessonNo =
    Math.max(0, ...(chapter?.lessons.map((item) => item.lesson_no) ?? [])) + 1;

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LessonEditorFormInput>({
    defaultValues: {
      estimatedMinutes: lesson?.estimated_minutes ?? null,
      learningObjectives: lesson?.learning_objectives ?? [],
      lessonNo: lesson?.lesson_no ?? nextLessonNo,
      status: lesson?.status === "active" ? "active" : "draft",
      teachingNotes: lesson?.teaching_notes ?? "",
      title: lesson?.title ?? "",
    },
    resolver: zodResolver(lessonEditorFormSchema),
  });
  const objectives = useController({
    control,
    name: "learningObjectives",
  });

  async function onSubmit(values: LessonEditorFormInput) {
    if (!chapter) return;
    setNotice(null);
    try {
      const payload = isEdit
        ? await sendHierarchyMutation("/api/lessons", "PATCH", {
            action: "update",
            lessonId: selection.lessonId,
            ...values,
          })
        : await sendHierarchyMutation("/api/lessons", "POST", {
            chapterId: chapter.id,
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
        message: error instanceof Error ? error.message : "目前無法儲存課次。",
      });
    }
  }

  async function onDelete() {
    if (!lesson) return;
    try {
      const payload = await sendHierarchyMutation("/api/lessons", "DELETE", {
        lessonId: lesson.id,
      });
      setConfirmDelete(false);
      setSelection(null);
      setHierarchyNotice({ type: "success", message: payload.message });
      refreshHierarchy();
    } catch (error: unknown) {
      setConfirmDelete(false);
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "目前無法刪除課次。",
      });
    }
  }

  if (!chapter) {
    return (
      <Alert title="找不到章節" variant="error">
        這個章節已不存在，請重新選擇。
      </Alert>
    );
  }

  return (
    <section aria-labelledby="lesson-editor-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-amber-700">
            Lesson · {chapter.title}
          </p>
          <h2
            className="mt-1 text-xl font-black text-emerald-950"
            id="lesson-editor-title"
          >
            {isEdit ? "編輯課次" : "新增課次"}
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
          error={errors.lessonNo?.message}
          label="課次編號"
          max={9999}
          min={1}
          type="number"
          {...register("lessonNo", { valueAsNumber: true })}
        />
        <Input
          error={errors.title?.message}
          label="課次標題"
          maxLength={160}
          {...register("title")}
        />
        <Input
          error={errors.estimatedMinutes?.message}
          label="預估分鐘（選填）"
          max={600}
          min={1}
          type="number"
          {...register("estimatedMinutes", {
            setValueAs: (value: unknown) =>
              value === "" || value === null ? null : Number(value),
          })}
        />

        <label className="block font-bold text-emerald-950">
          學習目標（每行一項）
          <textarea
            className="mt-2 block min-h-32 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900 hover:border-emerald-600"
            onBlur={objectives.field.onBlur}
            onChange={(event) =>
              objectives.field.onChange(
                event.target.value
                  .split("\n")
                  .map((value) => value.trim())
                  .filter(Boolean),
              )
            }
            value={objectives.field.value.join("\n")}
          />
          {errors.learningObjectives?.message ? (
            <span className="mt-1.5 block text-sm font-medium text-red-700">
              {errors.learningObjectives.message}
            </span>
          ) : null}
        </label>

        <label className="block font-bold text-emerald-950">
          教學備註
          <textarea
            className="mt-2 block min-h-36 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900 hover:border-emerald-600"
            maxLength={5000}
            {...register("teachingNotes")}
          />
          {errors.teachingNotes ? (
            <span className="mt-1.5 block text-sm font-medium text-red-700">
              {errors.teachingNotes.message}
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
            {isEdit ? "儲存課次" : "建立課次"}
          </Button>
          {isEdit ? (
            <Button onClick={() => setConfirmDelete(true)} variant="danger">
              刪除課次
            </Button>
          ) : null}
        </div>
      </form>

      <Dialog
        description="刪除課次後無法復原。"
        onClose={() => setConfirmDelete(false)}
        open={confirmDelete}
        title="確定刪除課次？"
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
