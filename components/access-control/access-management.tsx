"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type {
  AccessGuardianRelationship,
  AccessOverview,
  AccessUser,
} from "@/lib/access-control/domain";
import { ORGANIZATION_ROLE_LABELS } from "@/lib/organization/constants";
import type { ManageableOrganizationRole } from "@/lib/validation/access";

const manageableRoleOptions: {
  readonly label: string;
  readonly value: ManageableOrganizationRole;
}[] = [
  { label: "機構管理員", value: "organization_admin" },
  { label: "教師", value: "teacher" },
  { label: "審核者", value: "reviewer" },
];

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    accepted: "已接受",
    active: "啟用",
    archived: "封存",
    expired: "已過期",
    inactive: "停用",
    left: "已離開",
    pending: "等待中",
    removed: "已移除",
    revoked: "已撤銷",
    suspended: "已停用",
    verified: "已驗證",
  };
  return labels[status] ?? status;
}

async function requestJson(
  url: string,
  body: Readonly<Record<string, string>>,
  method: "DELETE" | "POST" = "POST",
) {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method,
  });
  const payload = (await response.json().catch(() => null)) as {
    readonly message?: string;
    readonly success?: boolean;
  } | null;
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message ?? "操作失敗，請稍後再試。");
  }
}

function ReasonInput({
  onChange,
  value,
}: {
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  return (
    <Input
      label="操作理由"
      maxLength={300}
      minLength={4}
      onChange={(event) => onChange(event.target.value)}
      placeholder="請輸入可稽核的操作理由"
      value={value}
    />
  );
}

function MemberActions({ user }: { readonly user: AccessUser }) {
  const router = useRouter();
  const [role, setRole] = useState<ManageableOrganizationRole>("teacher");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const isProtectedOwner = user.role === "organization_owner";

  async function runAction(action: string, request: () => Promise<void>) {
    setMessage(null);
    setPendingAction(action);
    try {
      await request();
      setReason("");
      setMessage("操作已完成，頁面資料已重新整理。");
      router.refresh();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "操作失敗。");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4">
      {message ? <Alert title="操作結果">{message}</Alert> : null}
      <Select
        label="指派角色"
        onChange={(event) =>
          setRole(event.target.value as ManageableOrganizationRole)
        }
        options={manageableRoleOptions}
        value={role}
      />
      <ReasonInput onChange={setReason} value={reason} />
      <div className="flex flex-wrap gap-2">
        <Button
          loading={pendingAction === "assign"}
          onClick={(event) => {
            event.stopPropagation();
            runAction("assign", () =>
              requestJson("/api/access/roles/assign", {
                membershipId: user.membershipId,
                reason,
                role,
              }),
            );
          }}
          type="button"
          variant="secondary"
        >
          指派角色
        </Button>
        <Button
          disabled={isProtectedOwner}
          loading={pendingAction === "disable"}
          onClick={(event) => {
            event.stopPropagation();
            runAction("disable", () =>
              requestJson(`/api/access/members/${user.membershipId}/disable`, {
                reason,
              }),
            );
          }}
          type="button"
          variant="secondary"
        >
          停用成員
        </Button>
        <Button
          loading={pendingAction === "enable"}
          onClick={(event) => {
            event.stopPropagation();
            runAction("enable", () =>
              requestJson(`/api/access/members/${user.membershipId}/enable`, {
                reason,
              }),
            );
          }}
          type="button"
          variant="secondary"
        >
          啟用成員
        </Button>
        <Button
          disabled={isProtectedOwner}
          loading={pendingAction === "remove"}
          onClick={(event) => {
            event.stopPropagation();
            runAction("remove", () =>
              requestJson(
                `/api/access/members/${user.membershipId}`,
                { reason },
                "DELETE",
              ),
            );
          }}
          type="button"
          variant="danger"
        >
          移除成員關係
        </Button>
      </div>
      {isProtectedOwner ? (
        <p className="text-sm font-medium text-amber-800">
          Owner 受 last-owner protection 保護，不可在此直接停用或移除。
        </p>
      ) : null}
    </div>
  );
}

function GuardianRelationshipAction({
  relationship,
}: {
  readonly relationship: AccessGuardianRelationship;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-4">
      {message ? <Alert title="撤銷結果">{message}</Alert> : null}
      <ReasonInput onChange={setReason} value={reason} />
      <Button
        className="mt-3"
        disabled={relationship.status !== "active"}
        loading={loading}
        onClick={async () => {
          setLoading(true);
          setMessage(null);
          try {
            await requestJson(`/api/access/guardians/${relationship.id}/revoke`, {
              reason,
            });
            setReason("");
            setMessage("家長關係已撤銷。");
            router.refresh();
          } catch (error: unknown) {
            setMessage(error instanceof Error ? error.message : "撤銷失敗。");
          } finally {
            setLoading(false);
          }
        }}
        variant="danger"
      >
        撤銷家長關係
      </Button>
    </div>
  );
}

export function AccessManagement({
  overview,
}: {
  readonly overview: AccessOverview;
}) {
  const activeUsers = useMemo(
    () => overview.users.filter((user) => user.status === "active"),
    [overview.users],
  );

  return (
    <section className="mt-8 space-y-6" aria-labelledby="access-title">
      <Card className="p-6">
        <p className="font-bold text-amber-700">UX-001</p>
        <h1
          className="mt-1 text-3xl font-black text-emerald-950 sm:text-4xl"
          id="access-title"
        >
          使用者與權限管理
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Owner／Admin 可在這裡管理成員角色、狀態與家長關係。所有寫入都走
          server-side RPC、理由欄位與 audit boundary；UI
          只負責引導，不作為安全邊界。
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge>
            目前角色：{ORGANIZATION_ROLE_LABELS[overview.currentRole]}
          </Badge>
          <Badge>Active users：{activeUsers.length}</Badge>
          <Badge>Classes：{overview.classes.length}</Badge>
          <Badge>Guardian links：{overview.guardianRelationships.length}</Badge>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="p-6">
          <h2 className="text-xl font-black text-emerald-950">成員與角色</h2>
          {overview.users.length === 0 ? (
            <Alert className="mt-4" title="尚無成員">
              目前機構尚未建立可管理的成員資料。
            </Alert>
          ) : (
            <div className="mt-4 space-y-4">
              {overview.users.map((user) => (
                <article
                  className="rounded-2xl border border-slate-200 p-4"
                  key={user.membershipId}
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row">
                    <div>
                      <p className="font-black text-emerald-950">
                        {user.displayName ?? user.userId}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {ORGANIZATION_ROLE_LABELS[user.role]} ·{" "}
                        {statusLabel(user.status)}
                      </p>
                    </div>
                    <Badge>{user.joinedAt ? "已加入" : "尚未加入"}</Badge>
                  </div>
                  <MemberActions user={user} />
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-black text-emerald-950">角色能力摘要</h2>
          <div className="mt-4 space-y-3">
            {overview.permissionSummary.map((item) => (
              <div
                className="rounded-xl border border-slate-200 p-3"
                key={item.label}
              >
                <p className="font-bold text-emerald-950">{item.label}</p>
                <p className="mt-1 text-sm text-slate-600">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-black text-emerald-950">班級權限範圍</h2>
          {overview.classes.length === 0 ? (
            <Alert className="mt-4" title="尚無班級">
              目前沒有可顯示的班級範圍；教師權限仍會 fail closed。
            </Alert>
          ) : (
            <div className="mt-4 space-y-3">
              {overview.classes.map((classroom) => (
                <div
                  className="rounded-xl border border-slate-200 p-3"
                  key={classroom.classId}
                >
                  <p className="font-bold text-emerald-950">{classroom.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {statusLabel(classroom.status)} · 學生{" "}
                    {classroom.studentCount} 位 · Teacher {classroom.teacherId}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-black text-emerald-950">家長邀請</h2>
          {overview.guardianInvitations.length === 0 ? (
            <Alert className="mt-4" title="尚無邀請">
              目前沒有等待中的家長邀請。
            </Alert>
          ) : (
            <div className="mt-4 space-y-3">
              {overview.guardianInvitations.map((invitation) => (
                <div
                  className="rounded-xl border border-slate-200 p-3"
                  key={invitation.id}
                >
                  <p className="font-bold text-emerald-950">
                    {invitation.guardianEmail}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {statusLabel(invitation.status)} · Student{" "}
                    {invitation.studentId}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-black text-emerald-950">家長關係</h2>
        {overview.guardianRelationships.length === 0 ? (
          <Alert className="mt-4" title="尚無家長關係">
            Active verified relationship 建立前，Parent Portal 仍維持 fail
            closed。
          </Alert>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {overview.guardianRelationships.map((relationship) => (
              <article
                className="rounded-2xl border border-slate-200 p-4"
                key={relationship.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-emerald-950">
                      Student {relationship.studentId}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Guardian {relationship.guardianUserId}
                    </p>
                  </div>
                  <Badge>{statusLabel(relationship.status)}</Badge>
                </div>
                <GuardianRelationshipAction relationship={relationship} />
              </article>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
