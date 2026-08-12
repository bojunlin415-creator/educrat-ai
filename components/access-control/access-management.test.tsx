import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessManagement } from "./access-management";
import type { AccessOverview } from "@/lib/access-control/domain";

const routerMocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));

const membershipId = "606ed3c9-9df7-49e4-8b98-d4c123e5ccc4";

const overview: AccessOverview = {
  classes: [],
  currentRole: "organization_owner",
  guardianInvitations: [],
  guardianRelationships: [],
  organizationId: "10000000-0000-4000-8000-000000000001",
  permissionSummary: [],
  users: [
    {
      displayName: "測試老師",
      email: null,
      joinedAt: "2026-08-04T00:00:00.000Z",
      membershipId,
      role: "teacher",
      status: "suspended",
      userId: "20000000-0000-4000-8000-000000000001",
    },
  ],
};

function mockSuccessfulFetch() {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify({ message: "ok", success: true }), {
      headers: { "content-type": "application/json" },
      status: 200,
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("AccessManagement member actions", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("assign-role button calls only the assign endpoint", async () => {
    const user = userEvent.setup();
    const fetchMock = mockSuccessfulFetch();
    render(<AccessManagement overview={overview} />);

    await user.type(screen.getByLabelText("操作理由"), "Assign role safely");
    await user.click(screen.getByRole("button", { name: "指派角色" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/access/roles/assign",
      expect.objectContaining({
        body: JSON.stringify({
          membershipId,
          reason: "Assign role safely",
          role: "teacher",
        }),
        method: "POST",
      }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/enable"),
      expect.anything(),
    );
  });

  it("enable button calls only the enable endpoint", async () => {
    const user = userEvent.setup();
    const fetchMock = mockSuccessfulFetch();
    render(<AccessManagement overview={overview} />);

    await user.type(screen.getByLabelText("操作理由"), "Enable member safely");
    await user.click(screen.getByRole("button", { name: "啟用成員" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/access/members/${membershipId}/enable`,
      expect.objectContaining({
        body: JSON.stringify({ reason: "Enable member safely" }),
        method: "POST",
      }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/access/roles/assign",
      expect.anything(),
    );
  });

  it('displays "不能修改自己的角色" for the dedicated self-role error', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "self_elevation_forbidden",
            message: "不能修改自己的角色。",
            success: false,
          }),
          {
            headers: { "content-type": "application/json" },
            status: 409,
          },
        ),
      ),
    );
    render(<AccessManagement overview={overview} />);

    await user.type(screen.getByLabelText("操作理由"), "Attempt self change");
    await user.click(screen.getByRole("button", { name: "指派角色" }));

    expect(await screen.findByText("不能修改自己的角色。")).toBeInTheDocument();
  });
});
