export interface AuthorizationContextProvider {
  provide(): Promise<unknown>;
}
