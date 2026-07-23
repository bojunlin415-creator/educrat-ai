declare const dependencyResourceTypeBrand: unique symbol;
declare const dependencyResourceIdBrand: unique symbol;
declare const dependencyTypeBrand: unique symbol;
declare const dependencyTransitionBrand: unique symbol;
declare const canonicalDependencyPayloadBrand: unique symbol;

export type DependencyResourceType = string & {
  readonly [dependencyResourceTypeBrand]: true;
};

export type DependencyResourceId = string & {
  readonly [dependencyResourceIdBrand]: true;
};

export type DependencyType = string & {
  readonly [dependencyTypeBrand]: true;
};

export type DependencyTransition = string & {
  readonly [dependencyTransitionBrand]: true;
};

export type CanonicalDependencyPayload = string & {
  readonly [canonicalDependencyPayloadBrand]: true;
};
