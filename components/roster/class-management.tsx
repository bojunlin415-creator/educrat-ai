"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Database } from "@/lib/supabase/database.types";

type Classroom = Database["public"]["Tables"]["classes"]["Row"];
type Student = Pick<
  Database["public"]["Tables"]["students"]["Row"],
  "id" | "name" | "status" | "student_no"
>;
type TeacherOption = { id: string; label: string };
type Notice = {
  readonly message: string;
  readonly variant: "error" | "success";
};
type ClassMutationResponse = {
  readonly class: Classroom;
  readonly message?: string;
};
type AssignmentMutationResponse = { readonly message?: string };

async function send<T>(
  url: string,
  method: "DELETE" | "PATCH" | "POST",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    method,
  });
  const payload = (await response.json().catch(() => null)) as
    ({ message?: string } & T) | null;
  if (!response.ok)
    throw new Error(payload?.message ?? "操作失敗，請稍後再試。");
  if (!payload) throw new Error("伺服器回應格式不正確。");
  return payload;
}

export function ClassManagement({
  classes,
  students,
  teachers,
}: {
  classes: readonly Classroom[];
  students: readonly Student[];
  teachers: readonly TeacherOption[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"assign" | "create" | "edit" | null>(
    null,
  );
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [rows, setRows] = useState<readonly Classroom[]>(classes);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const activeStudents = useMemo(
    () => students.filter((student) => student.status === "active"),
    [students],
  );
  const [selectedStudent, setSelectedStudent] = useState(
    activeStudents[0]?.id ?? "",
  );

  const filtered = useMemo(
    () =>
      rows.filter(
        (item) =>
          (status === "all" || item.status === status) &&
          `${item.name} ${item.code}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [rows, search, status],
  );
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const teacherOptions = useMemo(
    () =>
      editing && !teachers.some((teacher) => teacher.id === editing.teacher_id)
        ? [
            {
              id: editing.teacher_id,
              label: `目前指派教師 · …${editing.teacher_id.slice(-6)}`,
            },
            ...teachers,
          ]
        : teachers,
    [editing, teachers],
  );

  async function submit(form: FormData) {
    if (!teachers.length) {
      setNotice({
        message: "請先建立 active Teacher membership。",
        variant: "error",
      });
      return;
    }
    setPendingKey("class-form");
    setNotice(null);
    const payload = {
      code: String(form.get("code")),
      description: String(form.get("description") || ""),
      grade: String(form.get("grade")),
      name: String(form.get("name")),
      school: String(form.get("school") || "") || (editing ? null : undefined),
      schoolYear: Number(form.get("schoolYear")),
      semester: Number(form.get("semester")),
      subject: String(form.get("subject")),
      teacherId: String(form.get("teacherId")),
    };
    try {
      const result = await send<ClassMutationResponse>(
        editing ? `/api/classes/${editing.id}` : "/api/classes",
        editing ? "PATCH" : "POST",
        payload,
      );
      const wasEditing = editing !== null;
      setRows((current) =>
        current.some((item) => item.id === result.class.id)
          ? current.map((item) =>
              item.id === result.class.id ? result.class : item,
            )
          : [result.class, ...current],
      );
      setPage(1);
      setDialog(null);
      setEditing(null);
      setNotice({
        message:
          result.message ?? (wasEditing ? "班級已更新。" : "班級已建立。"),
        variant: "success",
      });
      router.refresh();
    } catch (error: unknown) {
      setNotice({
        message: error instanceof Error ? error.message : "操作失敗。",
        variant: "error",
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function changeStatus(item: Classroom) {
    const action = item.status === "archived" ? "restore" : "archive";
    const key = `class-${action}:${item.id}`;
    setPendingKey(key);
    setNotice(null);
    try {
      const result = await send<ClassMutationResponse>(
        item.status === "archived"
          ? `/api/classes/${item.id}/restore`
          : `/api/classes/${item.id}`,
        item.status === "archived" ? "POST" : "DELETE",
      );
      setRows((current) =>
        current.map((row) => (row.id === result.class.id ? result.class : row)),
      );
      setPage(1);
      setNotice({
        message:
          result.message ??
          (item.status === "archived" ? "班級已還原。" : "班級已封存。"),
        variant: "success",
      });
      router.refresh();
    } catch (error: unknown) {
      setNotice({
        message: error instanceof Error ? error.message : "操作失敗。",
        variant: "error",
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function assignStudent() {
    if (!editing || !selectedStudent) return;
    const key = `class-assign:${editing.id}`;
    setPendingKey(key);
    setNotice(null);
    try {
      const result = await send<AssignmentMutationResponse>(
        `/api/classes/${editing.id}/students`,
        "POST",
        { studentId: selectedStudent },
      );
      setDialog(null);
      setEditing(null);
      setNotice({
        message: result.message ?? "學生已指派至班級。",
        variant: "success",
      });
      router.refresh();
    } catch (error: unknown) {
      setNotice({
        message: error instanceof Error ? error.message : "操作失敗。",
        variant: "error",
      });
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <>
      {notice && dialog === null ? (
        <Alert
          className="mb-4"
          title={notice.variant === "error" ? "操作失敗" : "操作成功"}
          variant={notice.variant}
        >
          {notice.message}
        </Alert>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          label="搜尋班級"
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="名稱或代碼"
          value={search}
        />
        <Select
          label="狀態"
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          options={[
            { label: "啟用", value: "active" },
            { label: "已封存", value: "archived" },
            { label: "全部", value: "all" },
          ]}
          value={status}
        />
        <Button
          disabled={!teachers.length || pendingKey !== null}
          onClick={() => {
            setNotice(null);
            setEditing(null);
            setDialog("create");
          }}
        >
          建立班級
        </Button>
      </div>
      {!teachers.length ? (
        <Alert className="mt-4" title="尚無可指派教師">
          建立班級前，需要同機構的 active Teacher membership。
        </Alert>
      ) : null}
      {filtered.length === 0 ? (
        <Alert className="mt-6" title="尚無班級">
          目前條件下沒有班級資料。
        </Alert>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <Card className="p-5" key={item.id}>
              <p className="text-sm font-bold text-slate-500">{item.code}</p>
              <h2 className="mt-1 text-xl font-black text-emerald-950">
                {item.name}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {item.school ?? "未填學校"} · {item.grade} · {item.subject}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {item.school_year} 學年 · 第 {item.semester} 學期
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.status !== "archived" ? (
                  <Button
                    disabled={pendingKey !== null}
                    variant="secondary"
                    onClick={() => {
                      setNotice(null);
                      setEditing(item);
                      setDialog("edit");
                    }}
                  >
                    編輯
                  </Button>
                ) : null}
                {item.status === "active" ? (
                  <Button
                    disabled={pendingKey !== null}
                    variant="secondary"
                    onClick={() => {
                      setNotice(null);
                      setEditing(item);
                      setSelectedStudent(activeStudents[0]?.id ?? "");
                      setDialog("assign");
                    }}
                  >
                    指派學生
                  </Button>
                ) : null}
                <Button
                  disabled={pendingKey !== null}
                  loading={
                    pendingKey ===
                    `class-${item.status === "archived" ? "restore" : "archive"}:${item.id}`
                  }
                  variant={item.status === "archived" ? "secondary" : "danger"}
                  onClick={() => void changeStatus(item)}
                >
                  {item.status === "archived" ? "還原" : "封存"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {filtered.length > pageSize ? (
        <nav
          aria-label="班級列表分頁"
          className="mt-6 flex items-center justify-center gap-3"
        >
          <Button
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
            variant="secondary"
          >
            上一頁
          </Button>
          <span className="text-sm font-bold text-slate-600">
            第 {currentPage} / {pageCount} 頁
          </span>
          <Button
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
            variant="secondary"
          >
            下一頁
          </Button>
        </nav>
      ) : null}
      <Dialog
        open={dialog === "create" || dialog === "edit"}
        onClose={() => {
          setDialog(null);
          setEditing(null);
        }}
        title={editing ? "編輯班級" : "建立班級"}
      >
        {notice?.variant === "error" ? (
          <Alert className="mb-4" title="操作失敗" variant="error">
            {notice.message}
          </Alert>
        ) : null}
        <form
          action={submit}
          className="grid gap-4"
          key={`${dialog ?? "closed"}:${editing?.id ?? "new"}`}
        >
          <Input
            defaultValue={editing?.name}
            label="班級名稱"
            name="name"
            required
          />
          <Input
            defaultValue={editing?.code}
            label="班級代碼"
            name="code"
            pattern="[A-Z0-9]+(?:-[A-Z0-9]+)*"
            required
          />
          <Input
            defaultValue={editing?.school ?? ""}
            label="學校"
            name="school"
          />
          <Input
            defaultValue={editing?.grade}
            label="年級"
            name="grade"
            required
          />
          <Input
            defaultValue={editing?.subject}
            label="科目"
            name="subject"
            required
          />
          <Input
            defaultValue={
              editing?.school_year ?? new Date().getFullYear() - 1911
            }
            label="學年"
            name="schoolYear"
            type="number"
            required
          />
          <Select
            defaultValue={String(editing?.semester ?? 1)}
            label="學期"
            name="semester"
            options={[
              { label: "第一學期", value: "1" },
              { label: "第二學期", value: "2" },
            ]}
          />
          <Select
            defaultValue={editing?.teacher_id ?? teacherOptions[0]?.id}
            label="主要教師"
            name="teacherId"
            options={teacherOptions.map((teacher) => ({
              label: teacher.label,
              value: teacher.id,
            }))}
          />
          <Input
            defaultValue={editing?.description ?? ""}
            label="說明"
            name="description"
          />
          <Button loading={pendingKey === "class-form"} type="submit">
            {editing ? "儲存變更" : "建立班級"}
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={dialog === "assign"}
        onClose={() => {
          setDialog(null);
          setEditing(null);
        }}
        title="指派學生"
      >
        <div className="grid gap-4">
          {notice?.variant === "error" ? (
            <Alert title="操作失敗" variant="error">
              {notice.message}
            </Alert>
          ) : null}
          {activeStudents.length ? (
            <>
              <Select
                label="學生"
                onChange={(event) => setSelectedStudent(event.target.value)}
                options={activeStudents.map((student) => ({
                  label: `${student.student_no} · ${student.name}`,
                  value: student.id,
                }))}
                value={selectedStudent}
              />
              <Button
                disabled={!selectedStudent || pendingKey !== null}
                loading={pendingKey === `class-assign:${editing?.id ?? ""}`}
                onClick={() => void assignStudent()}
              >
                確認指派
              </Button>
            </>
          ) : (
            <Alert title="尚無可指派學生">請先建立或還原 active 學生。</Alert>
          )}
        </div>
      </Dialog>
    </>
  );
}
