"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { CurriculumChapter } from "@/lib/curriculum/service";
import { sendHierarchyMutation } from "@/lib/curriculum/hierarchy-client";
import type { LessonEditorFormInput } from "@/lib/validation/curriculum-hierarchy";

export type EditorSelection =
  | { kind: "chapter"; mode: "create" }
  | { kind: "chapter"; mode: "edit"; chapterId: string }
  | { kind: "lesson"; mode: "create"; chapterId: string }
  | {
      kind: "lesson";
      mode: "edit";
      chapterId: string;
      lessonId: string;
    }
  | null;

type Notice = { type: "success" | "error"; message: string } | null;

interface HierarchyContextValue {
  canEdit: boolean;
  chapters: CurriculumChapter[];
  collapseAll: () => void;
  expandedChapterIds: Set<string>;
  expandAll: () => void;
  moveChapter: (chapterId: string, targetChapterId: string) => Promise<void>;
  moveLesson: (
    chapterId: string,
    lessonId: string,
    targetLessonId: string,
  ) => Promise<void>;
  notice: Notice;
  pendingOrder: boolean;
  refreshHierarchy: () => void;
  selection: EditorSelection;
  setNotice: (notice: Notice) => void;
  setSelection: (selection: EditorSelection) => void;
  toggleChapter: (chapterId: string) => void;
  updateLessonInHierarchy: (
    lessonId: string,
    values: LessonEditorFormInput,
  ) => void;
  versionId: string;
}

const HierarchyContext = createContext<HierarchyContextValue | null>(null);

function moveToPosition<T extends { id: string }>(
  items: T[],
  sourceId: string,
  targetId: string,
) {
  if (sourceId === targetId) return items;
  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return items;
  const next = [...items];
  const [source] = next.splice(sourceIndex, 1);
  if (!source) return items;
  next.splice(targetIndex, 0, source);
  return next;
}

export function HierarchyProvider({
  canEdit,
  children,
  initialChapters,
  versionId,
}: {
  canEdit: boolean;
  children: ReactNode;
  initialChapters: CurriculumChapter[];
  versionId: string;
}) {
  const router = useRouter();
  const [chapters, setChapters] = useState(initialChapters);
  const [lastInitialChapters, setLastInitialChapters] =
    useState(initialChapters);
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(
    new Set(initialChapters.slice(0, 1).map((chapter) => chapter.id)),
  );
  const [selection, setSelection] = useState<EditorSelection>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [pendingOrder, setPendingOrder] = useState(false);

  if (lastInitialChapters !== initialChapters) {
    setLastInitialChapters(initialChapters);
    setChapters(initialChapters);
  }

  const toggleChapter = useCallback((chapterId: string) => {
    setExpandedChapterIds((current) => {
      const next = new Set(current);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }, []);

  const refreshHierarchy = useCallback(() => {
    router.refresh();
  }, [router]);

  const updateLessonInHierarchy = useCallback(
    (lessonId: string, values: LessonEditorFormInput) => {
      setChapters((current) =>
        current.map((chapter) => ({
          ...chapter,
          lessons: chapter.lessons.map((lesson) =>
            lesson.id === lessonId
              ? {
                  ...lesson,
                  estimated_minutes: values.estimatedMinutes,
                  learning_objectives: values.learningObjectives,
                  lesson_no: values.lessonNo,
                  status: values.status,
                  teaching_notes: values.teachingNotes || null,
                  title: values.title,
                }
              : lesson,
          ),
        })),
      );
    },
    [],
  );

  const moveChapter = useCallback(
    async (chapterId: string, targetChapterId: string) => {
      if (!canEdit || pendingOrder || chapterId === targetChapterId) return;
      const previous = chapters;
      const next = moveToPosition(chapters, chapterId, targetChapterId);
      setChapters(next);
      setPendingOrder(true);
      setNotice(null);
      try {
        await sendHierarchyMutation("/api/chapters", "PATCH", {
          action: "reorder",
          orderedIds: next.map((chapter) => chapter.id),
          versionId,
        });
        setNotice({ type: "success", message: "章節順序已儲存。" });
        router.refresh();
      } catch (error: unknown) {
        setChapters(previous);
        setNotice({
          type: "error",
          message:
            error instanceof Error ? error.message : "無法更新章節順序。",
        });
      } finally {
        setPendingOrder(false);
      }
    },
    [canEdit, chapters, pendingOrder, router, versionId],
  );

  const moveLesson = useCallback(
    async (chapterId: string, lessonId: string, targetLessonId: string) => {
      if (!canEdit || pendingOrder || lessonId === targetLessonId) return;
      const previous = chapters;
      const next = chapters.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              lessons: moveToPosition(
                chapter.lessons,
                lessonId,
                targetLessonId,
              ),
            }
          : chapter,
      );
      const chapter = next.find((item) => item.id === chapterId);
      if (!chapter) return;
      setChapters(next);
      setPendingOrder(true);
      setNotice(null);
      try {
        await sendHierarchyMutation("/api/lessons", "PATCH", {
          action: "reorder",
          chapterId,
          orderedIds: chapter.lessons.map((lesson) => lesson.id),
        });
        setNotice({ type: "success", message: "課次順序已儲存。" });
        router.refresh();
      } catch (error: unknown) {
        setChapters(previous);
        setNotice({
          type: "error",
          message:
            error instanceof Error ? error.message : "無法更新課次順序。",
        });
      } finally {
        setPendingOrder(false);
      }
    },
    [canEdit, chapters, pendingOrder, router],
  );

  const value = useMemo<HierarchyContextValue>(
    () => ({
      canEdit,
      chapters,
      collapseAll: () => setExpandedChapterIds(new Set()),
      expandedChapterIds,
      expandAll: () =>
        setExpandedChapterIds(new Set(chapters.map((chapter) => chapter.id))),
      moveChapter,
      moveLesson,
      notice,
      pendingOrder,
      refreshHierarchy,
      selection,
      setNotice,
      setSelection,
      toggleChapter,
      updateLessonInHierarchy,
      versionId,
    }),
    [
      canEdit,
      chapters,
      expandedChapterIds,
      moveChapter,
      moveLesson,
      notice,
      pendingOrder,
      refreshHierarchy,
      selection,
      toggleChapter,
      updateLessonInHierarchy,
      versionId,
    ],
  );

  return (
    <HierarchyContext.Provider value={value}>
      {children}
    </HierarchyContext.Provider>
  );
}

export function useHierarchy() {
  const context = useContext(HierarchyContext);
  if (!context) {
    throw new Error("useHierarchy must be used inside HierarchyProvider");
  }
  return context;
}
