import type { ReAuthenticationContractVersion } from "@/lib/re-authentication/domain/definition";
import type {
  ReAuthenticationChallengeId,
  ReAuthenticationChallengeType,
} from "@/lib/re-authentication/shared/references";

export interface ReAuthenticationChallenge {
  readonly challengeId: ReAuthenticationChallengeId;
  readonly challengeType: ReAuthenticationChallengeType;
  readonly expiresAt: string;
  readonly issuedAt: string;
  readonly version: ReAuthenticationContractVersion;
}
