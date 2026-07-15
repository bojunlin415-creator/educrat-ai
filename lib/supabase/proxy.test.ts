import { NextRequest } from "next/server";
import { updateSession } from "./proxy";

describe("Supabase Proxy without configuration", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    "/dashboard",
    "/onboarding",
    "/onboarding/organization",
    "/settings/profile",
    "/settings/organization",
  ])("redirects the protected route %s to login", async (path) => {
    const response = await updateSession(
      new NextRequest(`http://localhost:3000${path}`),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?notice=authentication_required",
    );
  });

  it("allows a public auth route to render", async () => {
    const response = await updateSession(
      new NextRequest("http://localhost:3000/login"),
    );

    expect(response.status).toBe(200);
  });

  it("does not apply workspace onboarding rules to the auth callback", async () => {
    const response = await updateSession(
      new NextRequest("http://localhost:3000/auth/callback?code=test"),
    );

    expect(response.status).toBe(200);
  });
});
