import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrganizationSettingsForm } from "./organization-settings-form";

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));

const values = {
  address: "台北市測試路 1 號",
  businessName: "星光文理補習班",
  email: "school@example.com",
  name: "星光課堂",
  phone: "02-2345-6789",
  taxId: "12345678",
};

describe("OrganizationSettingsForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders teacher and reviewer access as read-only", () => {
    render(
      <OrganizationSettingsForm
        canEdit={false}
        defaultValues={values}
        slug="starlight-school"
      />,
    );

    expect(screen.getByText("唯讀權限")).toBeInTheDocument();
    expect(screen.getByLabelText("機構名稱")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "儲存機構資料" }),
    ).not.toBeInTheDocument();
  });

  it("allows an owner or admin to update approved fields", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, message: "機構資料已儲存。" }),
          { headers: { "content-type": "application/json" }, status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <OrganizationSettingsForm
        canEdit
        defaultValues={values}
        slug="starlight-school"
      />,
    );

    await user.clear(screen.getByLabelText("機構名稱"));
    await user.type(screen.getByLabelText("機構名稱"), "星光學苑");
    await user.click(screen.getByRole("button", { name: "儲存機構資料" }));

    expect(await screen.findByText("機構資料已儲存。")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/organizations/current",
      expect.objectContaining({ method: "PUT" }),
    );
  });
});
