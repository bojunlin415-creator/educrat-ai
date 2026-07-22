declare const lifecycleDefinitionIdBrand: unique symbol;
declare const lifecycleStateIdBrand: unique symbol;
declare const lifecycleTransitionIdBrand: unique symbol;
declare const lifecycleIntentBrand: unique symbol;
declare const canonicalLifecyclePayloadBrand: unique symbol;

export type LifecycleDefinitionId = string & {
  readonly [lifecycleDefinitionIdBrand]: true;
};

export type LifecycleStateId = string & {
  readonly [lifecycleStateIdBrand]: true;
};

export type LifecycleTransitionId = string & {
  readonly [lifecycleTransitionIdBrand]: true;
};

export type LifecycleIntent = string & {
  readonly [lifecycleIntentBrand]: true;
};

export type CanonicalLifecyclePayload = string & {
  readonly [canonicalLifecyclePayloadBrand]: true;
};
