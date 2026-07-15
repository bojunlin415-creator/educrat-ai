import {
  organizationErrorResponse,
  parseOrganizationJson,
} from "@/lib/organization/api";
import { OrganizationError } from "@/lib/organization/errors";
import { switchOrganizationSchema } from "@/lib/validation/organization";

function jsonRequest(body: string, contentType = "application/json") {
  return new Request("http://localhost/api/organizations/active", {
    body,
    headers: { "content-type": contentType },
    method: "PUT",
  });
}

describe("organization API boundary", () => {
  it("parses a valid strict payload", async () => {
    const organizationId = "00000000-0000-4000-8000-000000000000";
    const result = await parseOrganizationJson(
      jsonRequest(JSON.stringify({ organizationId })),
      switchOrganizationSchema,
    );

    expect(result).toEqual({
      data: { organizationId },
      success: true,
    });
  });

  it.each([
    { body: "not-json", contentType: "application/json", status: 400 },
    { body: "{}", contentType: "text/plain", status: 415 },
    {
      body: JSON.stringify({
        organizationId: "00000000-0000-4000-8000-000000000000",
        role: "organization_owner",
      }),
      contentType: "application/json",
      status: 422,
    },
  ])(
    "rejects untrusted request input with $status",
    async ({ body, contentType, status }) => {
      const result = await parseOrganizationJson(
        jsonRequest(body, contentType),
        switchOrganizationSchema,
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.response.status).toBe(status);
    },
  );

  it("rejects an oversized body", async () => {
    const request = jsonRequest(
      JSON.stringify({ payload: "x".repeat(17_000) }),
    );
    const result = await parseOrganizationJson(
      request,
      switchOrganizationSchema,
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.response.status).toBe(413);
  });

  it("maps domain errors without exposing database details", async () => {
    const response = organizationErrorResponse(
      new OrganizationError("not_member"),
    );
    const payload: unknown = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      success: false,
      message: "你目前不是這個機構的有效成員。",
    });
  });

  it("uses a generic response for unknown internal errors", async () => {
    const response = organizationErrorResponse(
      new Error("sensitive database stack"),
    );
    const payload = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(payload).not.toContain("sensitive database stack");
  });
});
