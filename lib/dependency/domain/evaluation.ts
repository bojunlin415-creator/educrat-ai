export interface DependencyEvaluation {
  readonly dependencyCount: number;
  readonly policyDecision: "ALLOW";
  readonly readonlyDependencyCount: number;
  readonly validation: "PASSED";
}
