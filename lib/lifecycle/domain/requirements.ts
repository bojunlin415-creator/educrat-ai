export interface LifecycleRequirements {
  readonly auditRequired: boolean;
  readonly authorizationRequired: boolean;
  readonly dependencyCheckRequired: boolean;
  readonly legalHoldRequired: boolean;
  readonly reauthenticationRequired: boolean;
  readonly retentionRequired: boolean;
}
