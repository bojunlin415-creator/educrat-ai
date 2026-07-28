declare const recycleBinBrand: unique symbol;

export type RecycleBinActorId = string & {
  readonly [recycleBinBrand]: "RecycleBinActorId";
};

export type RecycleBinDependencyReference = string & {
  readonly [recycleBinBrand]: "RecycleBinDependencyReference";
};

export type RecycleBinLegalHoldReference = string & {
  readonly [recycleBinBrand]: "RecycleBinLegalHoldReference";
};

export type RecycleBinMetadataCode = string & {
  readonly [recycleBinBrand]: "RecycleBinMetadataCode";
};

export type RecycleBinOrganizationId = string & {
  readonly [recycleBinBrand]: "RecycleBinOrganizationId";
};

export type RecycleBinRecycleId = string & {
  readonly [recycleBinBrand]: "RecycleBinRecycleId";
};

export type RecycleBinResourceId = string & {
  readonly [recycleBinBrand]: "RecycleBinResourceId";
};

export type RecycleBinResourceType = string & {
  readonly [recycleBinBrand]: "RecycleBinResourceType";
};

export type RecycleBinRetentionReference = string & {
  readonly [recycleBinBrand]: "RecycleBinRetentionReference";
};

export type RecycleBinTransition = string & {
  readonly [recycleBinBrand]: "RecycleBinTransition";
};
