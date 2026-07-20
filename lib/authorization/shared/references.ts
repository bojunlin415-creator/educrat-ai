export type AuthorizationIdentifier = string;

export interface AuthorizationRequestMetadata {
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly source?: string;
}
