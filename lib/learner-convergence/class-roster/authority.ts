import {
  CLASS_ROSTER_CUTOVER_VERSION,
  type ClassRosterActorRole,
  type ClassRosterAuthorityObserver,
  type ClassRosterReadResult,
  type ClassRosterSource,
  type ClassRosterStudentProjection,
} from "@/lib/learner-convergence/class-roster/domain";
import { isCanonicalRosterRuntimeFailure } from "@/lib/learner-convergence/class-roster/errors";
import {
  LEARNER_CUTOVER_CONTROL_MODES,
  type LearnerCutoverControlMode,
} from "@/lib/learner-convergence/cutover/domain";

function freezeEntries(
  entries: readonly ClassRosterStudentProjection[],
): readonly ClassRosterStudentProjection[] {
  return Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
}

function result(
  input: Omit<ClassRosterReadResult, "version">,
): ClassRosterReadResult {
  return Object.freeze({
    ...input,
    entries: freezeEntries(input.entries),
    version: CLASS_ROSTER_CUTOVER_VERSION,
  });
}

export function resolveClassRosterAuthorityMode(input: {
  readonly configuredMode?: string;
  readonly selectedMode: LearnerCutoverControlMode;
}): LearnerCutoverControlMode {
  if (
    input.configuredMode === undefined ||
    input.configuredMode.trim() === ""
  ) {
    return input.selectedMode;
  }
  const normalized = input.configuredMode.trim();
  return LEARNER_CUTOVER_CONTROL_MODES.some((mode) => mode === normalized)
    ? (normalized as LearnerCutoverControlMode)
    : "LEGACY_ONLY";
}

export async function readClassRosterByAuthority(input: {
  readonly actorRole: ClassRosterActorRole;
  readonly classId: string;
  readonly correlationId: string;
  readonly mode: LearnerCutoverControlMode;
  readonly observer: ClassRosterAuthorityObserver;
  readonly organizationId: string;
  readonly source: ClassRosterSource;
}): Promise<ClassRosterReadResult> {
  let canonicalCount: number | null = null;
  let legacyCount: number | null = null;
  let fallbackUsed = false;
  let shadowErrorCount = 0;
  let returnedAuthority: "CANONICAL" | "LEGACY";
  let entries: readonly ClassRosterStudentProjection[];

  switch (input.mode) {
    case "LEGACY_ONLY":
      entries = await input.source.loadLegacy();
      legacyCount = entries.length;
      returnedAuthority = "LEGACY";
      break;
    case "LEGACY_PRIMARY_CANONICAL_SHADOW":
      entries = await input.source.loadLegacy();
      legacyCount = entries.length;
      returnedAuthority = "LEGACY";
      try {
        canonicalCount = (await input.source.loadCanonical()).length;
      } catch {
        shadowErrorCount = 1;
      }
      break;
    case "CANONICAL_PRIMARY_LEGACY_FALLBACK":
      try {
        entries = await input.source.loadCanonical();
        canonicalCount = entries.length;
        returnedAuthority = "CANONICAL";
      } catch (error: unknown) {
        if (!isCanonicalRosterRuntimeFailure(error)) throw error;
        entries = await input.source.loadLegacy();
        legacyCount = entries.length;
        fallbackUsed = true;
        returnedAuthority = "LEGACY";
      }
      break;
    case "CANONICAL_ONLY":
      entries = await input.source.loadCanonical();
      canonicalCount = entries.length;
      returnedAuthority = "CANONICAL";
      break;
  }

  const output = result({
    authority: returnedAuthority,
    canonicalCount,
    entries,
    fallbackUsed,
    legacyCount,
    mode: input.mode,
    shadowErrorCount,
  });
  input.observer.record(
    Object.freeze({
      actorRole: input.actorRole,
      canonicalCount,
      classId: input.classId,
      correlationId: input.correlationId,
      fallbackReason: fallbackUsed ? "canonical_read_failure" : null,
      fallbackUsed,
      legacyCount,
      mode: input.mode,
      organizationId: input.organizationId,
      returnedAuthority,
      shadowErrorCount,
      version: CLASS_ROSTER_CUTOVER_VERSION,
    }),
  );
  return output;
}
