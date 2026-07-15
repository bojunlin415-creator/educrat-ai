import {
  createOrganizationSchema,
  organizationSlugSchema,
  switchOrganizationSchema,
  updateOrganizationSchema,
} from "@/lib/validation/organization";
import {
  normalizeOrganizationSlug,
  suggestOrganizationSlug,
} from "@/lib/organization/slug";
import { canEditOrganization } from "@/lib/organization/constants";

const validCreateInput = {
  address: "台北市中正區測試路 1 號",
  businessName: "星光文理補習班",
  email: "school@example.com",
  name: "星光課堂",
  phone: "02-2345-6789",
  slug: "starlight-school",
};

describe("organization validation", () => {
  it("accepts and trims a valid organization", () => {
    const result = createOrganizationSchema.parse({
      ...validCreateInput,
      name: "  星光課堂  ",
    });

    expect(result.name).toBe("星光課堂");
  });

  it.each(["Admin", "two--hyphens", "-leading", "尾端", "support"])(
    "rejects an invalid or reserved slug: %s",
    (slug) => {
      expect(organizationSlugSchema.safeParse(slug).success).toBe(false);
    },
  );

  it("rejects unknown server input fields", () => {
    const result = createOrganizationSchema.safeParse({
      ...validCreateInput,
      createdBy: "00000000-0000-0000-0000-000000000000",
    });

    expect(result.success).toBe(false);
  });

  it.each([
    { field: "address", value: "A" },
    { field: "businessName", value: "A" },
    { field: "email", value: "not-an-email" },
    { field: "phone", value: "phone-number" },
  ])("rejects invalid optional $field input", ({ field, value }) => {
    const result = createOrganizationSchema.safeParse({
      ...validCreateInput,
      [field]: value,
    });

    expect(result.success).toBe(false);
  });

  it("normalizes repeated separators and provides a Chinese-name fallback", () => {
    expect(normalizeOrganizationSlug("  Star Light__School  ")).toBe(
      "star-light-school",
    );
    expect(suggestOrganizationSlug("星光課堂")).toBe("my-school");
  });

  it("validates update and switch payloads", () => {
    expect(
      updateOrganizationSchema.safeParse({
        address: "",
        businessName: "",
        email: "",
        name: "星光課堂",
        phone: "",
        taxId: "12345678",
      }).success,
    ).toBe(true);
    expect(
      switchOrganizationSchema.safeParse({ organizationId: "not-a-uuid" })
        .success,
    ).toBe(false);
  });

  it.each([
    ["organization_owner", true],
    ["organization_admin", true],
    ["teacher", false],
    ["reviewer", false],
    ["branch_manager", false],
    ["student", false],
    ["guardian", false],
  ] as const)("applies Sprint 6 edit access for %s", (role, expected) => {
    expect(canEditOrganization(role)).toBe(expected);
  });
});
