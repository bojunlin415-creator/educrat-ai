import {
  evaluateScopeCompatibility,
  parsePermissionKey,
  RESOURCE_SCOPE_TYPES,
  type AuthorizationContext,
  type ResourceScope,
  type ResourceScopeType,
} from "@/lib/authorization";

const organizationId = "organization-1";
const permission = parsePermissionKey("curriculum.read");

function scopeFor(type: ResourceScopeType): ResourceScope {
  if (type === "PLATFORM") return { type };
  if (type === "ORGANIZATION") {
    return { organizationId, scopeId: organizationId, type };
  }
  if (["CAMPUS", "SCHOOL", "GRADE", "CLASS", "COURSE"].includes(type)) {
    return { organizationId, scopeId: `${type.toLowerCase()}-1`, type };
  }
  return { organizationId, resourceId: `${type.toLowerCase()}-1`, type };
}

function context(scopes: readonly ResourceScope[]): AuthorizationContext {
  return {
    identity: { id: "account-1", personId: "person-1", type: "ACCOUNT" },
    memberships: scopes.some((scope) => scope.type !== "PLATFORM")
      ? [
          {
            id: "membership-1",
            organizationId,
            status: "ACTIVE",
          },
        ]
      : [],
    permissions: [permission],
    personas: [
      {
        id: "persona-1",
        organizationId,
        status: "ACTIVE",
        type: "TEACHER",
      },
    ],
    roles: [],
    scopes,
  };
}

describe("scope compatibility evaluator", () => {
  it.each(RESOURCE_SCOPE_TYPES)("supports exact %s scope", (type) => {
    const scope = scopeFor(type);
    expect(
      evaluateScopeCompatibility({
        context: context([scope]),
        grantedScopes: [scope],
        requestedScope: scope,
      }),
    ).toMatchObject({ matches: true, reason: "SCOPE_MATCH" });
  });

  it("allows an organization scope to cover a tenant child resource", () => {
    const organizationScope = scopeFor("ORGANIZATION");
    expect(
      evaluateScopeCompatibility({
        context: context([organizationScope]),
        grantedScopes: [organizationScope],
        requestedScope: scopeFor("LESSON"),
      }).matches,
    ).toBe(true);
  });

  it("uses explicit lineage when a non-organization parent covers a child", () => {
    const courseScope = scopeFor("COURSE");
    expect(
      evaluateScopeCompatibility({
        attributes: { lineage: { COURSE: courseScope.scopeId } },
        context: context([courseScope]),
        grantedScopes: [courseScope],
        requestedScope: scopeFor("LESSON"),
      }).matches,
    ).toBe(true);
    expect(
      evaluateScopeCompatibility({
        context: context([courseScope]),
        grantedScopes: [courseScope],
        requestedScope: scopeFor("LESSON"),
      }).matches,
    ).toBe(false);
  });

  it("denies cross-tenant and forged organization scopes", () => {
    const organizationScope = scopeFor("ORGANIZATION");
    const requested = {
      organizationId: "organization-2",
      resourceId: "lesson-1",
      type: "LESSON",
    } as const;
    expect(
      evaluateScopeCompatibility({
        context: context([organizationScope]),
        grantedScopes: [organizationScope],
        requestedScope: requested,
      }),
    ).toMatchObject({ matches: false });
  });

  it("denies a tenant scope without active membership context", () => {
    const organizationScope = scopeFor("ORGANIZATION");
    const missingMembership = {
      ...context([organizationScope]),
      memberships: [],
    };
    expect(
      evaluateScopeCompatibility({
        context: missingMembership,
        grantedScopes: [organizationScope],
        requestedScope: scopeFor("LESSON"),
      }),
    ).toEqual({ matches: false, reason: "MISSING_SCOPE_CONTEXT" });
  });

  it.each([
    ["MEMBERSHIP", { resourceMembershipId: "membership-other" }],
    ["PERSON", { resourcePersonId: "person-other" }],
    [
      "PROFILE",
      { actorProfileId: "profile-1", resourceProfileId: "profile-other" },
    ],
    ["PERSONA", { resourcePersonaId: "persona-other" }],
    ["OWN_RESOURCE", { resourceOwnerPersonId: "person-other" }],
    ["MANAGED_RESOURCE", { managedByPersonIds: ["person-other"] }],
  ] as const)(
    "denies mismatched %s relationship",
    (relationship, attributes) => {
      const organizationScope = scopeFor("ORGANIZATION");
      expect(
        evaluateScopeCompatibility({
          attributes,
          context: context([organizationScope]),
          grantedScopes: [organizationScope],
          policyScope: { ...organizationScope, relationship },
          requestedScope: scopeFor("CURRICULUM"),
        }),
      ).toEqual({ matches: false, reason: "RELATIONSHIP_MISMATCH" });
    },
  );

  it.each([
    ["MEMBERSHIP", { resourceMembershipId: "membership-1" }],
    ["PERSON", { resourcePersonId: "person-1" }],
    [
      "PROFILE",
      { actorProfileId: "profile-1", resourceProfileId: "profile-1" },
    ],
    ["PERSONA", { resourcePersonaId: "persona-1" }],
    ["OWN_RESOURCE", { resourceOwnerPersonId: "person-1" }],
    ["MANAGED_RESOURCE", { managedByPersonIds: ["person-1"] }],
  ] as const)(
    "accepts verified %s relationship",
    (relationship, attributes) => {
      const organizationScope = scopeFor("ORGANIZATION");
      expect(
        evaluateScopeCompatibility({
          attributes,
          context: context([organizationScope]),
          grantedScopes: [organizationScope],
          policyScope: { ...organizationScope, relationship },
          requestedScope: scopeFor("CURRICULUM"),
        }).matches,
      ).toBe(true);
    },
  );

  it.each([
    { type: "UNKNOWN" },
    { organizationId, type: "LESSON" },
    { type: "ORGANIZATION" },
    { resourceId: "lesson-1", type: "PLATFORM" },
  ])("fails closed for invalid scope %o", (requestedScope) => {
    const organizationScope = scopeFor("ORGANIZATION");
    expect(
      evaluateScopeCompatibility({
        context: context([organizationScope]),
        grantedScopes: [organizationScope],
        requestedScope,
      }),
    ).toEqual({ matches: false, reason: "INVALID_SCOPE" });
  });
});
