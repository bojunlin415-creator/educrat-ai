import type { ReAuthenticationChallenge } from "@/lib/re-authentication/domain/challenge";
import type { ReAuthenticationContractVersion } from "@/lib/re-authentication/domain/definition";
import type { ReAuthenticationActionType } from "@/lib/re-authentication/shared/references";

export interface ReAuthenticationCheckRequest {
  readonly actionType: ReAuthenticationActionType;
  readonly challenge?: ReAuthenticationChallenge;
  readonly version: ReAuthenticationContractVersion;
}
