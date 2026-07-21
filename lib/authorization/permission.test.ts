import {
  AUTHORIZATION_DECISIONS,
  AuthorizationError,
  DECISION_REASONS,
  isPermissionKey,
  matchesPermissionExpression,
  parsePermissionExpression,
  parsePermissionKey,
  RESOURCE_SCOPE_TYPES,
} from "@/lib/authorization";

describe("authorization domain primitives", () => {
  it.each([
    "curriculum.read",
    "lesson.update",
    "worksheet.generate",
    "assessment.publish",
  ])("accepts a structurally valid permission key: %s", (permission) => {
    expect(parsePermissionKey(permission)).toBe(permission);
    expect(isPermissionKey(permission)).toBe(true);
  });

  it.each([
    "",
    "isAdmin",
    "curriculum",
    "curriculum.read.extra",
    "Curriculum.read",
    "curriculum.Read",
    "curriculum-read",
    " curriculum.read",
  ])("rejects an invalid or boolean-style permission key: %s", (value) => {
    expect(isPermissionKey(value)).toBe(false);

    try {
      parsePermissionKey(value);
      throw new Error("Expected an invalid permission key to be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationError);
      expect((error as AuthorizationError).code).toBe("INVALID_PERMISSION_KEY");
    }
  });

  it("exposes stable machine-readable decisions and reasons", () => {
    expect(AUTHORIZATION_DECISIONS).toEqual(["ALLOW", "DENY"]);
    expect(DECISION_REASONS).toEqual([
      "PERMISSION_MATCH",
      "ALLOWED_BY_POLICY",
      "DENIED_BY_POLICY",
      "DEFAULT_DENY",
      "INVALID_PERMISSION",
      "INVALID_SCOPE",
      "INVALID_POLICY",
      "MISSING_CONTEXT",
      "SCOPE_MISMATCH",
      "PERMISSION_MISMATCH",
      "CONDITION_NOT_MET",
      "UNSUPPORTED_CONDITION",
      "POLICY_DISABLED",
      "NO_MATCHING_POLICY",
      "CONFLICT_DENY_OVERRIDE",
      "INTERNAL_RESOLUTION_ERROR",
      "NOT_FOUND",
      "OUT_OF_SCOPE",
      "INSUFFICIENT_PERMISSION",
      "EXPLICIT_DENY",
      "SYSTEM_ERROR",
    ]);
  });

  it.each([
    ["curriculum.read", "curriculum.read", true],
    ["curriculum.*", "curriculum.read", true],
    ["*", "curriculum.read", true],
    ["curriculum.read", "curriculum.update", false],
    ["curriculum.read", "curriculum.read_all", false],
    ["curriculum.*", "curriculums.read", false],
  ])(
    "matches runtime expression %s against %s without fuzzy boundaries",
    (expression, requested, expected) => {
      expect(
        matchesPermissionExpression(
          parsePermissionExpression(expression),
          parsePermissionKey(requested),
        ),
      ).toBe(expected);
    },
  );

  it.each(["Curriculum.*", "curriculum*", "*.*", "curriculum.read.*", ""])(
    "rejects malformed runtime permission expression: %s",
    (expression) => {
      expect(() => parsePermissionExpression(expression)).toThrow(
        AuthorizationError,
      );
    },
  );

  it("defines the AP-004A scope type baseline without resolving scopes", () => {
    expect(RESOURCE_SCOPE_TYPES).toEqual([
      "PLATFORM",
      "ORGANIZATION",
      "CAMPUS",
      "SCHOOL",
      "GRADE",
      "CLASS",
      "COURSE",
      "CURRICULUM",
      "CHAPTER",
      "LESSON",
      "WORKSHEET",
      "ASSESSMENT",
      "STUDENT",
      "GUARDIAN",
      "REPORT",
      "AUDIT",
      "NOTIFICATION",
    ]);
  });
});
