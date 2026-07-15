import {
  ORGANIZATION_RESERVED_SLUGS,
  ORGANIZATION_SLUG_MAX_LENGTH,
} from "@/lib/organization/constants";

export function normalizeOrganizationSlug(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, ORGANIZATION_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

export function suggestOrganizationSlug(name: string): string {
  const normalized = normalizeOrganizationSlug(name);
  if (
    normalized.length >= 3 &&
    !ORGANIZATION_RESERVED_SLUGS.some((slug) => slug === normalized)
  ) {
    return normalized;
  }
  return "my-school";
}
