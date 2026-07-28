export interface RecycleBinEvaluation {
  readonly dependencyCheck: "PASSED" | "BLOCKED";
  readonly policyDecision: "ALLOW";
  readonly retentionCheck: "PASSED" | "BLOCKED";
  readonly validation: "PASSED";
}
