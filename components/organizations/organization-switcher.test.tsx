import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrganizationSwitcher } from "./organization-switcher";

const routerMocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));

const organizations = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "星光課堂",
    role: "organization_owner" as const,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "晨曦學苑",
    role: "teacher" as const,
  },
];
const primaryOrganization = organizations[0]!;
const secondaryOrganization = organizations[1]!;

describe("OrganizationSwitcher", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the current organization even when only one is available", () => {
    render(
      <OrganizationSwitcher
        currentOrganizationId={primaryOrganization.id}
        organizations={[primaryOrganization]}
      />,
    );

    expect(screen.getByLabelText("目前機構")).toHaveValue(
      primaryOrganization.id,
    );
    expect(screen.getByText(/機構擁有者/)).toBeInTheDocument();
  });

  it("switches through the server endpoint and refreshes scoped data", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, message: "目前機構已切換。" }),
          { headers: { "content-type": "application/json" }, status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <OrganizationSwitcher
        currentOrganizationId={primaryOrganization.id}
        organizations={organizations}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("目前機構"),
      secondaryOrganization.id,
    );
    await user.click(screen.getByRole("button", { name: "切換機構" }));

    expect(await screen.findByText("目前機構已切換。")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/organizations/active",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(routerMocks.refresh).toHaveBeenCalled();
  });
});
