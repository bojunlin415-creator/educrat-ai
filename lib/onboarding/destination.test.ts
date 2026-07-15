import { resolveWorkspaceDestination } from "@/lib/onboarding/destination";

describe("workspace onboarding precedence", () => {
  it.each([
    [false, false, false, "/login?notice=authentication_required"],
    [true, false, true, "/onboarding"],
    [true, true, false, "/onboarding/organization"],
    [true, true, true, "/dashboard"],
  ] as const)(
    "resolves auth=%s profile=%s organization=%s",
    (authenticated, profileCompleted, hasOrganization, destination) => {
      expect(
        resolveWorkspaceDestination({
          authenticated,
          hasOrganization,
          profileCompleted,
        }),
      ).toBe(destination);
    },
  );
});
