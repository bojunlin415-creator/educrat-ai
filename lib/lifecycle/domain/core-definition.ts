import { validateLifecycleDefinition } from "@/lib/lifecycle/domain/validation";

const STANDARD_REQUIREMENTS = Object.freeze({
  auditRequired: true,
  authorizationRequired: true,
  dependencyCheckRequired: false,
  legalHoldRequired: false,
  reauthenticationRequired: false,
  retentionRequired: false,
});

const PROTECTED_REQUIREMENTS = Object.freeze({
  auditRequired: true,
  authorizationRequired: true,
  dependencyCheckRequired: true,
  legalHoldRequired: true,
  reauthenticationRequired: false,
  retentionRequired: true,
});

const IRREVERSIBLE_REQUIREMENTS = Object.freeze({
  ...PROTECTED_REQUIREMENTS,
  reauthenticationRequired: true,
});

export const CORE_LIFECYCLE_DEFINITION = validateLifecycleDefinition({
  definitionId: "CORE_RESOURCE",
  states: [
    {
      category: "WORKING",
      id: "DRAFT",
      isRestorable: false,
      isTerminal: false,
      readonly: false,
      version: 1,
    },
    {
      category: "RELEASED",
      id: "PUBLISHED",
      isRestorable: false,
      isTerminal: false,
      readonly: true,
      version: 1,
    },
    {
      category: "INACTIVE",
      id: "ARCHIVED",
      isRestorable: true,
      isTerminal: false,
      readonly: true,
      version: 1,
    },
    {
      category: "REMOVAL",
      id: "TRASHED",
      isRestorable: true,
      isTerminal: false,
      readonly: true,
      version: 1,
    },
    {
      category: "TERMINAL",
      id: "DELETED",
      isRestorable: false,
      isTerminal: true,
      readonly: true,
      version: 1,
    },
  ],
  transitions: [
    {
      from: "DRAFT",
      intent: "PUBLISH",
      requirements: STANDARD_REQUIREMENTS,
      to: "PUBLISHED",
      transitionId: "DRAFT_TO_PUBLISHED",
      version: 1,
    },
    {
      from: "PUBLISHED",
      intent: "ARCHIVE",
      requirements: PROTECTED_REQUIREMENTS,
      to: "ARCHIVED",
      transitionId: "PUBLISHED_TO_ARCHIVED",
      version: 1,
    },
    {
      from: "ARCHIVED",
      intent: "RESTORE",
      requirements: PROTECTED_REQUIREMENTS,
      to: "PUBLISHED",
      transitionId: "ARCHIVED_TO_PUBLISHED",
      version: 1,
    },
    {
      from: "ARCHIVED",
      intent: "TRASH",
      requirements: IRREVERSIBLE_REQUIREMENTS,
      to: "TRASHED",
      transitionId: "ARCHIVED_TO_TRASHED",
      version: 1,
    },
    {
      from: "TRASHED",
      intent: "RESTORE",
      requirements: PROTECTED_REQUIREMENTS,
      to: "ARCHIVED",
      transitionId: "TRASHED_TO_ARCHIVED",
      version: 1,
    },
    {
      from: "TRASHED",
      intent: "DELETE",
      requirements: IRREVERSIBLE_REQUIREMENTS,
      to: "DELETED",
      transitionId: "TRASHED_TO_DELETED",
      version: 1,
    },
  ],
  version: 1,
});
