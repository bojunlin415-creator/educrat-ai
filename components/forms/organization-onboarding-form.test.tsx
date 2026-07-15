import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrganizationOnboardingForm } from "./organization-onboarding-form";

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));

describe("OrganizationOnboardingForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("suggests a normalized slug from an English organization name", async () => {
    const user = userEvent.setup();
    render(<OrganizationOnboardingForm />);

    await user.clear(screen.getByLabelText("機構／補習班名稱"));
    await user.type(
      screen.getByLabelText("機構／補習班名稱"),
      "Star Light School",
    );

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /網址代稱/ })).toHaveValue(
        "star-light-school",
      );
    });
  });

  it("rejects a reserved slug before sending a request", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    render(<OrganizationOnboardingForm />);

    await user.type(screen.getByLabelText("機構／補習班名稱"), "星光課堂");
    await user.clear(screen.getByRole("textbox", { name: /網址代稱/ }));
    await user.type(screen.getByRole("textbox", { name: /網址代稱/ }), "admin");
    await user.click(
      screen.getByRole("button", { name: "建立機構並進入工作台" }),
    );

    expect(
      await screen.findByText("這個網址代稱為系統保留字，請更換。"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates an organization and redirects to the dashboard", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          message: "機構已建立，正在前往工作台。",
          redirectTo: "/dashboard",
        }),
        { headers: { "content-type": "application/json" }, status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<OrganizationOnboardingForm />);

    await user.type(screen.getByLabelText("機構／補習班名稱"), "星光課堂");
    await user.clear(screen.getByRole("textbox", { name: /網址代稱/ }));
    await user.type(
      screen.getByRole("textbox", { name: /網址代稱/ }),
      "starlight-school",
    );
    await user.click(
      screen.getByRole("button", { name: "建立機構並進入工作台" }),
    );

    expect(
      await screen.findByText("機構已建立，正在前往工作台。"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/organizations",
      expect.objectContaining({ method: "POST" }),
    );
    expect(routerMocks.replace).toHaveBeenCalledWith("/dashboard");
  });
});
