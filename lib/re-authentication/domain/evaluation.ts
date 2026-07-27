export interface ReAuthenticationEvaluation {
  readonly challengeStatus: "NOT_REQUIRED" | "REQUIRED" | "VALID";
  readonly policyDecision: "ALLOW";
  readonly validation: "PASSED";
}
