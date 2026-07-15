"use client";

import { hierarchyMutationResponseSchema } from "@/lib/validation/curriculum-hierarchy";

export async function sendHierarchyMutation(
  endpoint: "/api/chapters" | "/api/lessons",
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
) {
  const response = await fetch(endpoint, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method,
  });
  const payload: unknown = await response.json();
  const parsed = hierarchyMutationResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error("伺服器回應格式不正確。");
  if (!response.ok || !parsed.data.success) {
    throw new Error(parsed.data.message);
  }
  return parsed.data;
}
