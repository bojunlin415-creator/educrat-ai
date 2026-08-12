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

type Student = Database["public"]["Tables"]["students"]["Row"];
type Notice = {
  readonly message: string;
  readonly variant: "error" | "success";
};
type StudentMutationResponse = {
  readonly message?: string;
  readonly student: Student;
};

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

export function StudentManagement({
  students,
}: {
  students: readonly Student[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Student | null>(null);
  const [rows, setRows] = useState<readonly Student[]>(students);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () =>
      rows.filter(
        (student) =>
          (status === "all" || student.status === status) &&
          `${student.name} ${student.student_no}`
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

  async function submit(form: FormData) {
    setPendingKey("student-form");
    setNotice(null);
    const payload = {
      birthday: String(form.get("birthday") || "") || null,
      englishName: String(form.get("englishName") || "") || null,
      gender: String(form.get("gender")),
      grade: String(form.get("grade")),
      name: String(form.get("name")),
      school: String(form.get("school") || "") || null,
      studentNo: String(form.get("studentNo")),
    };
    try {
      const result = await send<StudentMutationResponse>(
        editing ? `/api/students/${editing.id}` : "/api/students",
        editing ? "PATCH" : "POST",
        payload,
      );
      const wasEditing = editing !== null;
      setRows((current) =>
        current.some((student) => student.id === result.student.id)
          ? current.map((student) =>
              student.id === result.student.id ? result.student : student,
            )
          : [result.student, ...current],
      );
      setPage(1);
      setDialog(null);
      setEditing(null);
      setNotice({
        message:
          result.message ?? (wasEditing ? "學生資料已更新。" : "學生已建立。"),
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

  async function changeStatus(student: Student) {
    const action = student.status === "active" ? "archive" : "restore";
    const key = `student-${action}:${student.id}`;
    setPendingKey(key);
    setNotice(null);
    try {
      const result = await send<StudentMutationResponse>(
        `/api/students/${student.id}`,
        student.status === "active" ? "DELETE" : "POST",
      );
      setRows((current) =>
        current.map((item) =>
          item.id === result.student.id ? result.student : item,
        ),
      );
      setPage(1);
      setNotice({
        message:
          result.message ??
          (student.status === "active" ? "學生已封存。" : "學生已還原。"),
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
          label="搜尋學生"
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="姓名或學號"
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
          disabled={pendingKey !== null}
          onClick={() => {
            setNotice(null);
            setEditing(null);
            setDialog("create");
          }}
        >
          建立學生
        </Button>
      </div>
      {filtered.length === 0 ? (
        <Alert className="mt-6" title="尚無學生">
          目前條件下沒有學生資料。
        </Alert>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((student) => (
            <Card className="p-5" key={student.id}>
              <p className="text-sm font-bold text-slate-500">
                {student.student_no}
              </p>
              <h2 className="mt-1 text-xl font-black text-emerald-950">
                {student.name}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {student.school ?? "未填學校"} · {student.grade}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {student.status === "active" ? "啟用" : "已封存"}
              </p>
              <div className="mt-4 flex gap-2">
                {student.status === "active" ? (
                  <Button
                    disabled={pendingKey !== null}
                    variant="secondary"
                    onClick={() => {
                      setNotice(null);
                      setEditing(student);
                      setDialog("edit");
                    }}
                  >
                    編輯
                  </Button>
                ) : null}
                <Button
                  disabled={pendingKey !== null}
                  loading={
                    pendingKey ===
                    `student-${student.status === "active" ? "archive" : "restore"}:${student.id}`
                  }
                  variant={student.status === "active" ? "danger" : "secondary"}
                  onClick={() => void changeStatus(student)}
                >
                  {student.status === "active" ? "封存" : "還原"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {filtered.length > pageSize ? (
        <nav
          aria-label="學生列表分頁"
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
        open={dialog !== null}
        onClose={() => {
          setDialog(null);
          setEditing(null);
        }}
        title={editing ? "編輯學生" : "建立學生"}
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
            defaultValue={editing?.student_no}
            label="學號"
            name="studentNo"
            required
          />
          <Input
            defaultValue={editing?.name}
            label="姓名"
            name="name"
            required
          />
          <Input
            defaultValue={editing?.english_name ?? ""}
            label="英文姓名"
            name="englishName"
          />
          <Select
            defaultValue={editing?.gender ?? "undisclosed"}
            label="性別"
            name="gender"
            options={[
              { label: "不透露", value: "undisclosed" },
              { label: "女", value: "female" },
              { label: "男", value: "male" },
              { label: "非二元", value: "non_binary" },
            ]}
          />
          <Input
            defaultValue={editing?.birthday ?? ""}
            label="生日"
            name="birthday"
            type="date"
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
          <Button loading={pendingKey === "student-form"} type="submit">
            {editing ? "儲存變更" : "建立學生"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
