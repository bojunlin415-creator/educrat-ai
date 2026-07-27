declare const reAuthenticationBrand: unique symbol;

export type ReAuthenticationActionType = string & {
  readonly [reAuthenticationBrand]: "ReAuthenticationActionType";
};

export type ReAuthenticationChallengeId = string & {
  readonly [reAuthenticationBrand]: "ReAuthenticationChallengeId";
};

export type ReAuthenticationChallengeType = string & {
  readonly [reAuthenticationBrand]: "ReAuthenticationChallengeType";
};

export type ReAuthenticationMetadataCode = string & {
  readonly [reAuthenticationBrand]: "ReAuthenticationMetadataCode";
};
