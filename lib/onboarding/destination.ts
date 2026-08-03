export interface WorkspaceState {
  authenticated: boolean;
  hasOrganization: boolean;
  profileCompleted: boolean;
}

export type WorkspaceDestination =
  | "/login?notice=authentication_required"
  | "/onboarding"
  | "/onboarding/organization"
  | RoleHomeDestination;

export type RoleHomeDestination =
  | "/dashboard"
  | "/dashboard/parent"
  | "/dashboard/student"
  | "/dashboard/teacher"
  | "/settings/access";

export function resolveWorkspaceDestination(
  state: WorkspaceState,
): WorkspaceDestination {
  if (!state.authenticated) return "/login?notice=authentication_required";
  if (!state.profileCompleted) return "/onboarding";
  if (!state.hasOrganization) return "/onboarding/organization";
  return "/dashboard";
}

export function resolveRoleHomeDestination(role: string): RoleHomeDestination {
  switch (role) {
    case "organization_owner":
    case "organization_admin":
      return "/settings/access";
    case "teacher":
    case "reviewer":
      return "/dashboard/teacher";
    case "guardian":
      return "/dashboard/parent";
    case "student":
      return "/dashboard/student";
    default:
      return "/dashboard";
  }
}
