"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  getOrganizationRoleLabel,
  type OrganizationRole,
} from "@/lib/organization/constants";
import { organizationApiResponseSchema } from "@/lib/validation/organization";

export interface OrganizationSwitcherItem {
  id: string;
  name: string;
  role: OrganizationRole;
}

type SwitchStatus =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export function OrganizationSwitcher({
  currentOrganizationId,
  organizations,
}: {
  currentOrganizationId: string;
  organizations: OrganizationSwitcherItem[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(currentOrganizationId);
  const [isSwitching, setIsSwitching] = useState(false);
  const [status, setStatus] = useState<SwitchStatus>({ type: "idle" });
  const selected = organizations.find(({ id }) => id === selectedId);

  if (organizations.length === 0) {
    return (
      <Alert title="尚未加入機構" variant="info">
        請先完成機構建立流程。
      </Alert>
    );
  }

  async function switchOrganization() {
    if (!selected || selectedId === currentOrganizationId) return;
    setIsSwitching(true);
    setStatus({ type: "idle" });
    try {
      const response = await fetch("/api/organizations/active", {
        body: JSON.stringify({ organizationId: selectedId }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      const payload: unknown = await response.json();
      const parsed = organizationApiResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("伺服器回應格式不正確。");
      if (!response.ok || !parsed.data.success) {
        setStatus({ type: "error", message: parsed.data.message });
        return;
      }

      setStatus({ type: "success", message: parsed.data.message });
      router.refresh();
    } catch (error: unknown) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "目前無法切換機構，請稍後再試。",
      });
    } finally {
      setIsSwitching(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Select
            disabled={organizations.length === 1 || isSwitching}
            label="目前機構"
            onChange={(event) => {
              setSelectedId(event.currentTarget.value);
              setStatus({ type: "idle" });
            }}
            options={organizations.map((organization) => ({
              label: organization.name,
              value: organization.id,
            }))}
            value={selectedId}
          />
          <p className="mt-2 text-sm text-slate-600">
            目前角色：
            <span className="font-bold text-emerald-900">
              {selected ? getOrganizationRoleLabel(selected.role) : "未知"}
            </span>
          </p>
        </div>
        <Button
          disabled={selectedId === currentOrganizationId}
          loading={isSwitching}
          onClick={() => void switchOrganization()}
          variant="secondary"
        >
          切換機構
        </Button>
      </div>
      {status.type !== "idle" ? (
        <Alert
          title={status.type === "success" ? "切換完成" : "無法切換"}
          variant={status.type}
        >
          {status.message}
        </Alert>
      ) : null}
    </div>
  );
}
