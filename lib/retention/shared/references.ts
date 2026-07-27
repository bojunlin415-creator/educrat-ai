declare const retentionResourceTypeBrand: unique symbol;
declare const retentionResourceIdBrand: unique symbol;
declare const retentionCategoryBrand: unique symbol;
declare const retentionTransitionBrand: unique symbol;
declare const retentionMetadataCodeBrand: unique symbol;
declare const legalHoldIdBrand: unique symbol;
declare const legalHoldReasonBrand: unique symbol;
declare const canonicalRetentionPayloadBrand: unique symbol;

export type RetentionResourceType = string & {
  readonly [retentionResourceTypeBrand]: true;
};

export type RetentionResourceId = string & {
  readonly [retentionResourceIdBrand]: true;
};

export type RetentionCategory = string & {
  readonly [retentionCategoryBrand]: true;
};

export type RetentionTransition = string & {
  readonly [retentionTransitionBrand]: true;
};

export type RetentionMetadataCode = string & {
  readonly [retentionMetadataCodeBrand]: true;
};

export type LegalHoldId = string & {
  readonly [legalHoldIdBrand]: true;
};

export type LegalHoldReason = string & {
  readonly [legalHoldReasonBrand]: true;
};

export type CanonicalRetentionPayload = string & {
  readonly [canonicalRetentionPayloadBrand]: true;
};
