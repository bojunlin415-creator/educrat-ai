export interface WorkspaceState {
  authenticated: boolean;
  hasOrganization: boolean;
  profileCompleted: boolean;
}

export type WorkspaceDestination =
  | "/login?notice=authentication_required"
  | "/onboarding"
  | "/onboarding/organization"
  | "/dashboard";

export function resolveWorkspaceDestination(
  state: WorkspaceState,
): WorkspaceDestination {
  if (!state.authenticated) return "/login?notice=authentication_required";
  if (!state.profileCompleted) return "/onboarding";
  if (!state.hasOrganization) return "/onboarding/organization";
  return "/dashboard";
}
