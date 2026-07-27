import type { ReAuthenticationChallenge } from "@/lib/re-authentication/domain/challenge";
import type { ReAuthenticationRequirement } from "@/lib/re-authentication/domain/definition";
import type { ReAuthenticationCheckRequest } from "@/lib/re-authentication/domain/request";

export interface ValidatedReAuthenticationEvaluationInput {
  readonly challenge?: ReAuthenticationChallenge;
  readonly requirement: ReAuthenticationRequirement;
  readonly request: ReAuthenticationCheckRequest;
}
