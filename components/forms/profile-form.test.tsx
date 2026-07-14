import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileForm } from "./profile-form";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

const validProfile = {
  displayName: "林老師",
  locale: "zh-TW",
  phone: "0912345678",
  timezone: "Asia/Taipei",
};

describe("ProfileForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows validation errors before an invalid profile is submitted", async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        allowAvatar={false}
        defaultValues={{ ...validProfile, displayName: "" }}
        initialAvatarUrl={null}
        mode="onboarding"
      />,
    );

    await user.click(screen.getByRole("button", { name: "完成基本資料" }));

    expect(await screen.findByText("請輸入顯示名稱。")).toBeInTheDocument();
  });

  it("saves valid profile data and shows a success state", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          message: "個人資料已儲存。",
          redirectTo: "/dashboard",
        }),
        { headers: { "content-type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProfileForm
        allowAvatar={false}
        defaultValues={validProfile}
        initialAvatarUrl={null}
        mode="settings"
      />,
    );
    await user.click(screen.getByRole("button", { name: "儲存變更" }));

    expect(await screen.findByText("個人資料已儲存。")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/profile",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(routerMocks.refresh).not.toHaveBeenCalled();
  });

  it("rejects an unsupported avatar before making a request", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProfileForm
        allowAvatar
        defaultValues={validProfile}
        initialAvatarUrl={null}
        mode="settings"
      />,
    );
    await user.upload(
      screen.getByLabelText("選擇個人圖片"),
      new File(["not-an-image"], "profile.txt", { type: "text/plain" }),
    );

    expect(
      await screen.findByText("只支援 JPEG、PNG 或 WebP 圖片。"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
