import {
  CANONICAL_SUBJECT_IDS,
  LEGACY_SUBJECT_ID_ALIASES,
  SUBJECT_CAPABILITIES,
  SUBJECT_CAPABILITY_PROFILE_VERSION,
  SUBJECT_CAPABILITY_REGISTRY,
  SubjectCapabilityError,
  getSubjectCapabilityAvailability,
  getSubjectCapabilityUiState,
  isSubjectCapabilityApproved,
  isSubjectCapabilityAvailable,
  listSubjectCapabilityProfiles,
  requireSubjectCapability,
  resolveCanonicalSubjectId,
  subjectCapabilityFailure,
} from "@/lib/subjects";

const generationOnlySubjects = [
  "chinese",
  "science",
  "social_studies",
  "life_curriculum",
] as const;

describe("subject capability registry", () => {
  it("uses canonical identifiers and explicit Sprint 7 aliases", () => {
    expect(CANONICAL_SUBJECT_IDS).toEqual([
      "english",
      "math",
      "chinese",
      "science",
      "social_studies",
      "life_curriculum",
    ]);
    expect(LEGACY_SUBJECT_ID_ALIASES).toEqual({
      life: "life_curriculum",
      social: "social_studies",
    });
    expect(resolveCanonicalSubjectId("social")).toBe("social_studies");
    expect(resolveCanonicalSubjectId("life")).toBe("life_curriculum");
    expect(resolveCanonicalSubjectId("數學")).toBeNull();
    expect(resolveCanonicalSubjectId("unknown")).toBeNull();
  });

  it("publishes one complete immutable profile per subject", () => {
    expect(listSubjectCapabilityProfiles()).toHaveLength(6);
    expect(new Set(SUBJECT_CAPABILITIES).size).toBe(
      SUBJECT_CAPABILITIES.length,
    );

    for (const subject of CANONICAL_SUBJECT_IDS) {
      const profile = SUBJECT_CAPABILITY_REGISTRY[subject];
      expect(profile.version).toBe(SUBJECT_CAPABILITY_PROFILE_VERSION);
      expect(Object.keys(profile.availability)).toHaveLength(
        SUBJECT_CAPABILITIES.length,
      );
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.approvedCapabilities)).toBe(true);
      expect(Object.isFrozen(profile.availability)).toBe(true);
    }
  });

  it("encodes the approved English roadmap without claiming future availability", () => {
    expect(isSubjectCapabilityApproved("english", "content_generation")).toBe(
      true,
    );
    expect(isSubjectCapabilityApproved("english", "online_answering")).toBe(
      true,
    );
    expect(isSubjectCapabilityApproved("english", "cefr_tracking")).toBe(true);
    expect(isSubjectCapabilityApproved("english", "speaking_assessment")).toBe(
      true,
    );
    expect(isSubjectCapabilityAvailable("english", "cefr_tracking")).toBe(
      false,
    );
    expect(isSubjectCapabilityAvailable("english", "speaking_assessment")).toBe(
      false,
    );
    expect(
      getSubjectCapabilityAvailability("english", "online_answering"),
    ).toBe("PARTIAL");
  });

  it("encodes the approved Math roadmap and rejects English-only capabilities", () => {
    expect(isSubjectCapabilityApproved("math", "content_generation")).toBe(
      true,
    );
    expect(isSubjectCapabilityApproved("math", "online_answering")).toBe(true);
    expect(isSubjectCapabilityApproved("math", "mastery_tracking")).toBe(true);
    expect(isSubjectCapabilityApproved("math", "knowledge_graph")).toBe(true);
    expect(isSubjectCapabilityApproved("math", "cefr_tracking")).toBe(false);
    expect(isSubjectCapabilityApproved("math", "speaking_assessment")).toBe(
      false,
    );
    expect(isSubjectCapabilityAvailable("math", "knowledge_graph")).toBe(false);
  });

  it.each(generationOnlySubjects)(
    "keeps %s inside the generation-only boundary",
    (subject) => {
      expect(isSubjectCapabilityApproved(subject, "content_generation")).toBe(
        true,
      );
      expect(isSubjectCapabilityApproved(subject, "pdf_export")).toBe(true);
      expect(isSubjectCapabilityApproved(subject, "word_export")).toBe(true);
      expect(isSubjectCapabilityAvailable(subject, "word_export")).toBe(false);
      expect(isSubjectCapabilityApproved(subject, "skill_diagnosis")).toBe(
        false,
      );
      expect(isSubjectCapabilityApproved(subject, "online_answering")).toBe(
        false,
      );
      expect(isSubjectCapabilityApproved(subject, "knowledge_graph")).toBe(
        false,
      );
    },
  );

  it("fails closed for unknown subjects and capabilities", () => {
    expect(isSubjectCapabilityApproved("history", "content_generation")).toBe(
      false,
    );
    expect(isSubjectCapabilityAvailable("math", "telepathy")).toBe(false);
    expect(
      getSubjectCapabilityAvailability("history", "pdf_export"),
    ).toBeNull();
    expect(getSubjectCapabilityUiState("history", "pdf_export")).toBe(
      "NOT_SUPPORTED",
    );
  });

  it("distinguishes available, approved roadmap, and unsupported UI states", () => {
    expect(getSubjectCapabilityUiState("english", "pdf_export")).toBe(
      "AVAILABLE_NOW",
    );
    expect(getSubjectCapabilityUiState("english", "cefr_tracking")).toBe(
      "COMING_LATER",
    );
    expect(getSubjectCapabilityUiState("chinese", "cefr_tracking")).toBe(
      "NOT_SUPPORTED",
    );
  });
});

describe("subject capability guard", () => {
  it("returns a frozen canonical decision for implemented capabilities", () => {
    const result = requireSubjectCapability("social", "content_generation");
    expect(result).toEqual({
      availability: "IMPLEMENTED",
      capability: "content_generation",
      subjectId: "social_studies",
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it.each([
    ["english", "cefr_tracking", "NOT_AVAILABLE"],
    ["chinese", "skill_diagnosis", "NOT_APPROVED"],
    ["unknown", "content_generation", "UNKNOWN_SUBJECT"],
    ["math", "unknown", "UNKNOWN_CAPABILITY"],
  ] as const)("rejects %s / %s with %s", (subject, capability, reason) => {
    expect(() => requireSubjectCapability(subject, capability)).toThrowError(
      expect.objectContaining({
        code: "subject_capability_unavailable",
        reason,
      }),
    );
  });

  it("creates a structured response without exposing roadmap state", () => {
    const error = new SubjectCapabilityError({
      capability: "skill_diagnosis",
      reason: "NOT_APPROVED",
      subject: "chinese",
    });
    expect(subjectCapabilityFailure(error)).toEqual({
      error: {
        capability: "skill_diagnosis",
        code: "subject_capability_unavailable",
        subject: "chinese",
      },
      message: "此科目目前不支援這項功能。",
      success: false,
    });
    expect(JSON.stringify(subjectCapabilityFailure(error))).not.toContain(
      "NOT_APPROVED",
    );
  });
});
