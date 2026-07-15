import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

interface AccountConfiguration {
  email: string;
  passwords: string[];
}

interface AuthenticatedFixture {
  client: SupabaseClient<Database>;
  user: User;
}

type Organization = Database["public"]["Tables"]["organizations"]["Row"];
type Curriculum = Database["public"]["Tables"]["curriculums"]["Row"];

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for the real organization RLS E2E.`);
  }
  return value;
}

function getConfiguration() {
  const primaryPasswords = [
    process.env.E2E_AUTH_PASSWORD,
    process.env.E2E_AUTH_NEW_PASSWORD,
  ].filter((password): password is string => Boolean(password));

  if (primaryPasswords.length === 0) {
    throw new Error(
      "E2E_AUTH_PASSWORD or E2E_AUTH_NEW_PASSWORD is required for the real organization RLS E2E.",
    );
  }

  return {
    publishableKey: requireEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    primary: {
      email: requireEnvironment("E2E_AUTH_EMAIL"),
      passwords: primaryPasswords,
    } satisfies AccountConfiguration,
    rls: {
      email: requireEnvironment("E2E_RLS_EMAIL"),
      passwords: [requireEnvironment("E2E_RLS_PASSWORD")],
    } satisfies AccountConfiguration,
    url: requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
  };
}

function createPublicClient(url: string, publishableKey: string) {
  return createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function signIn(
  url: string,
  publishableKey: string,
  account: AccountConfiguration,
): Promise<AuthenticatedFixture> {
  const client = createPublicClient(url, publishableKey);

  for (const password of account.passwords) {
    const { data, error } = await client.auth.signInWithPassword({
      email: account.email,
      password,
    });
    if (!error && data.user) return { client, user: data.user };
  }

  throw new Error(
    `Unable to authenticate configured development fixture ${createHash(
      "sha256",
    )
      .update(account.email)
      .digest("hex")
      .slice(0, 8)}.`,
  );
}

async function ensureCompletedProfile(fixture: AuthenticatedFixture) {
  const { data: existingProfile, error: selectError } = await fixture.client
    .from("profiles")
    .select("id,onboarding_completed")
    .eq("id", fixture.user.id)
    .maybeSingle();

  expect(selectError).toBeNull();
  if (!existingProfile) {
    const { error } = await fixture.client.from("profiles").insert({
      display_name: "Sprint 6 RLS Fixture",
      id: fixture.user.id,
      onboarding_completed: true,
    });
    expect(error).toBeNull();
    return;
  }

  if (!existingProfile.onboarding_completed) {
    const { error } = await fixture.client
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", fixture.user.id);
    expect(error).toBeNull();
  }
}

function fixtureSlug(prefix: string, userId: string) {
  return `${prefix}-${createHash("sha256")
    .update(userId)
    .digest("hex")
    .slice(0, 12)}`;
}

async function listVisibleOrganizations(
  fixture: AuthenticatedFixture,
): Promise<Organization[]> {
  const { data, error } = await fixture.client
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: true });
  expect(error).toBeNull();
  return data ?? [];
}

async function ensureOwnedOrganization(
  fixture: AuthenticatedFixture,
  slug: string,
): Promise<Organization> {
  const visible = await listVisibleOrganizations(fixture);
  const existing = visible.find((organization) => organization.slug === slug);
  if (existing) return existing;

  const { data: organizationId, error } = await fixture.client.rpc(
    "create_organization_with_owner",
    {
      p_address: null,
      p_business_name: null,
      p_email: null,
      p_name: "Sprint 6 RLS 測試機構",
      p_phone: null,
      p_slug: slug,
    },
  );
  expect(error).toBeNull();
  expect(organizationId).toBeTruthy();

  const afterCreate = await listVisibleOrganizations(fixture);
  const organization = afterCreate.find(({ id }) => id === organizationId);
  expect(organization).toBeDefined();
  return organization as Organization;
}

async function getCurriculumReferences(fixture: AuthenticatedFixture) {
  const [subjects, grades, publishers] = await Promise.all([
    fixture.client
      .from("subjects")
      .select("id,code")
      .eq("code", "math")
      .single(),
    fixture.client.from("grades").select("id,code").eq("code", "4").single(),
    fixture.client
      .from("publishers")
      .select("id,code")
      .eq("code", "kang-hsuan")
      .single(),
  ]);

  expect(subjects.error).toBeNull();
  expect(grades.error).toBeNull();
  expect(publishers.error).toBeNull();
  expect(subjects.data).not.toBeNull();
  expect(grades.data).not.toBeNull();
  expect(publishers.data).not.toBeNull();
  return {
    gradeId: grades.data?.id ?? "",
    publisherId: publishers.data?.id ?? "",
    subjectId: subjects.data?.id ?? "",
  };
}

async function listVisibleCurriculums(
  fixture: AuthenticatedFixture,
): Promise<Curriculum[]> {
  const { data, error } = await fixture.client
    .from("curriculums")
    .select("*")
    .order("created_at", { ascending: true });
  expect(error).toBeNull();
  return data ?? [];
}

async function ensureOwnedCurriculum(
  fixture: AuthenticatedFixture,
  name: string,
): Promise<Curriculum> {
  const existing = (await listVisibleCurriculums(fixture)).find(
    (curriculum) => curriculum.name === name,
  );
  if (existing) return existing;

  const references = await getCurriculumReferences(fixture);
  const { data: curriculumId, error } = await fixture.client.rpc(
    "create_curriculum_with_initial_version",
    {
      p_grade_id: references.gradeId,
      p_name: name,
      p_publisher_id: references.publisherId,
      p_school_year: 115,
      p_semester: 1,
      p_status: "draft",
      p_subject_id: references.subjectId,
      p_version: 1,
      p_version_remark: "Sprint 7 RLS fixture",
    },
  );
  expect(error).toBeNull();
  expect(curriculumId).toBeTruthy();

  const created = (await listVisibleCurriculums(fixture)).find(
    (curriculum) => curriculum.id === curriculumId,
  );
  expect(created).toBeDefined();
  return created as Curriculum;
}

test.describe.configure({ mode: "serial", timeout: 120_000 });

test("development RLS isolates organizations and protects membership context", async () => {
  const configuration = getConfiguration();
  const anonymous = createPublicClient(
    configuration.url,
    configuration.publishableKey,
  );
  const primary = await signIn(
    configuration.url,
    configuration.publishableKey,
    configuration.primary,
  );
  const rls = await signIn(
    configuration.url,
    configuration.publishableKey,
    configuration.rls,
  );

  try {
    await ensureCompletedProfile(primary);
    await ensureCompletedProfile(rls);

    const primarySlug = fixtureSlug("e2e-primary", primary.user.id);
    const secondPrimarySlug = fixtureSlug("e2e-switch", primary.user.id);
    const rlsSlug = fixtureSlug("e2e-rls", rls.user.id);
    const primaryOrganization = await ensureOwnedOrganization(
      primary,
      primarySlug,
    );
    const secondPrimaryOrganization = await ensureOwnedOrganization(
      primary,
      secondPrimarySlug,
    );
    const rlsOrganization = await ensureOwnedOrganization(rls, rlsSlug);

    const { error: anonymousCreateError } = await anonymous.rpc(
      "create_organization_with_owner",
      {
        p_address: null,
        p_business_name: null,
        p_email: null,
        p_name: "匿名機構",
        p_phone: null,
        p_slug: "anonymous-organization",
      },
    );
    expect(anonymousCreateError).not.toBeNull();

    const primaryVisible = await listVisibleOrganizations(primary);
    const rlsVisible = await listVisibleOrganizations(rls);
    expect(primaryVisible.map(({ id }) => id)).toContain(
      primaryOrganization.id,
    );
    expect(primaryVisible.map(({ id }) => id)).toContain(
      secondPrimaryOrganization.id,
    );
    expect(primaryVisible.map(({ id }) => id)).not.toContain(
      rlsOrganization.id,
    );
    expect(rlsVisible.map(({ id }) => id)).toContain(rlsOrganization.id);
    expect(rlsVisible.map(({ id }) => id)).not.toContain(
      primaryOrganization.id,
    );

    const { data: leakedOrganizations, error: leakedOrganizationError } =
      await rls.client
        .from("organizations")
        .select("id")
        .eq("id", primaryOrganization.id);
    expect(leakedOrganizationError).toBeNull();
    expect(leakedOrganizations).toEqual([]);

    const { data: leakedMemberships, error: leakedMembershipError } =
      await rls.client
        .from("organization_members")
        .select("id")
        .eq("organization_id", primaryOrganization.id);
    expect(leakedMembershipError).toBeNull();
    expect(leakedMemberships).toEqual([]);

    const { data: unauthorizedUpdate, error: unauthorizedUpdateError } =
      await rls.client
        .from("organizations")
        .update({ name: "不可跨租戶更新" })
        .eq("id", primaryOrganization.id)
        .select("id");
    expect(unauthorizedUpdateError).toBeNull();
    expect(unauthorizedUpdate).toEqual([]);

    const { error: directOrganizationInsertError } = await primary.client
      .from("organizations")
      .insert({
        created_by: primary.user.id,
        name: "不可直接建立",
        slug: fixtureSlug("direct", primary.user.id),
      });
    expect(directOrganizationInsertError).not.toBeNull();

    const { error: directMembershipInsertError } = await primary.client
      .from("organization_members")
      .insert({
        joined_at: new Date().toISOString(),
        organization_id: rlsOrganization.id,
        role: "organization_owner",
        status: "active",
        user_id: primary.user.id,
      });
    expect(directMembershipInsertError).not.toBeNull();

    const { error: directPreferenceUpdateError } = await primary.client
      .from("user_preferences")
      .update({ active_organization_id: rlsOrganization.id })
      .eq("user_id", primary.user.id);
    expect(directPreferenceUpdateError).not.toBeNull();

    const { error: crossTenantSwitchError } = await primary.client.rpc(
      "switch_active_organization",
      { p_organization_id: rlsOrganization.id },
    );
    expect(crossTenantSwitchError).not.toBeNull();

    const { data: switchedOrganizationId, error: switchError } =
      await primary.client.rpc("switch_active_organization", {
        p_organization_id: secondPrimaryOrganization.id,
      });
    expect(switchError).toBeNull();
    expect(switchedOrganizationId).toBe(secondPrimaryOrganization.id);
    const { data: activeOrganizationId, error: activeOrganizationError } =
      await primary.client.rpc("get_active_organization_id");
    expect(activeOrganizationError).toBeNull();
    expect(activeOrganizationId).toBe(secondPrimaryOrganization.id);

    const visibleCountBeforeDuplicate = (
      await listVisibleOrganizations(primary)
    ).length;
    const { error: duplicateSlugError } = await primary.client.rpc(
      "create_organization_with_owner",
      {
        p_address: null,
        p_business_name: null,
        p_email: null,
        p_name: "重複網址代稱",
        p_phone: null,
        p_slug: primarySlug,
      },
    );
    expect(duplicateSlugError).not.toBeNull();
    expect((await listVisibleOrganizations(primary)).length).toBe(
      visibleCountBeforeDuplicate,
    );

    const { error: invalidSlugError } = await primary.client.rpc(
      "create_organization_with_owner",
      {
        p_address: null,
        p_business_name: null,
        p_email: null,
        p_name: "無效網址代稱",
        p_phone: null,
        p_slug: "Invalid Slug",
      },
    );
    expect(invalidSlugError).not.toBeNull();

    const originalName = primaryOrganization.name;
    const originalUpdatedAt = primaryOrganization.updated_at;
    const { data: ownerUpdate, error: ownerUpdateError } = await primary.client
      .from("organizations")
      .update({ name: "Sprint 6 RLS Owner Update" })
      .eq("id", primaryOrganization.id)
      .select("updated_at")
      .single();
    expect(ownerUpdateError).toBeNull();
    expect(new Date(ownerUpdate?.updated_at ?? 0).getTime()).toBeGreaterThan(
      new Date(originalUpdatedAt).getTime(),
    );
    const { error: restoreUpdateError } = await primary.client
      .from("organizations")
      .update({ name: originalName })
      .eq("id", primaryOrganization.id);
    expect(restoreUpdateError).toBeNull();

    const { data: ownMemberships, error: ownMembershipError } =
      await primary.client
        .from("organization_members")
        .select("id,organization_id,role,status,user_id")
        .eq("organization_id", primaryOrganization.id);
    expect(ownMembershipError).toBeNull();
    const ownerMembership = (ownMemberships ?? []).find(
      ({ user_id: userId }) => userId === primary.user.id,
    );
    expect(ownerMembership?.role).toBe("organization_owner");

    const { error: selfPromotionError } = await primary.client
      .from("organization_members")
      .update({ role: "organization_admin" })
      .eq("id", ownerMembership?.id ?? "");
    expect(selfPromotionError).not.toBeNull();

    const { error: selfRemovalError } = await primary.client
      .from("organization_members")
      .update({ status: "removed" })
      .eq("id", ownerMembership?.id ?? "");
    expect(selfRemovalError).not.toBeNull();

    const { error: restoreActiveOrganizationError } = await primary.client.rpc(
      "switch_active_organization",
      { p_organization_id: primaryOrganization.id },
    );
    expect(restoreActiveOrganizationError).toBeNull();

    const primaryCurriculum = await ensureOwnedCurriculum(
      primary,
      `Sprint 7 Primary ${createHash("sha256")
        .update(primary.user.id)
        .digest("hex")
        .slice(0, 8)}`,
    );
    const rlsCurriculum = await ensureOwnedCurriculum(
      rls,
      `Sprint 7 RLS ${createHash("sha256")
        .update(rls.user.id)
        .digest("hex")
        .slice(0, 8)}`,
    );

    const primaryCurriculums = await listVisibleCurriculums(primary);
    const rlsCurriculums = await listVisibleCurriculums(rls);
    expect(primaryCurriculums.map(({ id }) => id)).toContain(
      primaryCurriculum.id,
    );
    expect(primaryCurriculums.map(({ id }) => id)).not.toContain(
      rlsCurriculum.id,
    );
    expect(rlsCurriculums.map(({ id }) => id)).toContain(rlsCurriculum.id);
    expect(rlsCurriculums.map(({ id }) => id)).not.toContain(
      primaryCurriculum.id,
    );

    const { data: crossTenantCurriculum, error: crossTenantCurriculumError } =
      await rls.client
        .from("curriculums")
        .select("id")
        .eq("id", primaryCurriculum.id);
    expect(crossTenantCurriculumError).toBeNull();
    expect(crossTenantCurriculum).toEqual([]);

    const references = await getCurriculumReferences(primary);
    const { error: directCurriculumInsertError } = await primary.client
      .from("curriculums")
      .insert({
        created_by: primary.user.id,
        grade_id: references.gradeId,
        name: "不可直接建立的教材",
        organization_id: primaryOrganization.id,
        publisher_id: references.publisherId,
        school_year: 115,
        semester: 1,
        subject_id: references.subjectId,
      });
    expect(directCurriculumInsertError).not.toBeNull();

    const { error: duplicateCurriculumError } = await primary.client.rpc(
      "create_curriculum_with_initial_version",
      {
        p_grade_id: references.gradeId,
        p_name: primaryCurriculum.name,
        p_publisher_id: references.publisherId,
        p_school_year: 115,
        p_semester: 1,
        p_status: "draft",
        p_subject_id: references.subjectId,
      },
    );
    expect(duplicateCurriculumError).not.toBeNull();

    const originalCurriculumName = primaryCurriculum.name;
    const { data: ownerCurriculumUpdate, error: ownerCurriculumUpdateError } =
      await primary.client
        .from("curriculums")
        .update({ name: `${originalCurriculumName} Updated` })
        .eq("id", primaryCurriculum.id)
        .select("id")
        .single();
    expect(ownerCurriculumUpdateError).toBeNull();
    expect(ownerCurriculumUpdate?.id).toBe(primaryCurriculum.id);
    const { error: restoreCurriculumError } = await primary.client
      .from("curriculums")
      .update({ name: originalCurriculumName })
      .eq("id", primaryCurriculum.id);
    expect(restoreCurriculumError).toBeNull();

    const { data: initialVersions, error: initialVersionsError } =
      await primary.client
        .from("curriculum_versions")
        .select("curriculum_id,version")
        .eq("curriculum_id", primaryCurriculum.id);
    expect(initialVersionsError).toBeNull();
    expect(initialVersions).toEqual([
      { curriculum_id: primaryCurriculum.id, version: 1 },
    ]);

    const { error: switchToEmptyTenantError } = await primary.client.rpc(
      "switch_active_organization",
      { p_organization_id: secondPrimaryOrganization.id },
    );
    expect(switchToEmptyTenantError).toBeNull();
    expect(
      (await listVisibleCurriculums(primary)).map(({ id }) => id),
    ).not.toContain(primaryCurriculum.id);

    const { error: finalRestoreError } = await primary.client.rpc(
      "switch_active_organization",
      { p_organization_id: primaryOrganization.id },
    );
    expect(finalRestoreError).toBeNull();

    const { data: anonymousCurriculums, error: anonymousCurriculumsError } =
      await anonymous.from("curriculums").select("id");
    expect(anonymousCurriculumsError).not.toBeNull();
    expect(anonymousCurriculums).toBeNull();
  } finally {
    await primary.client.auth.signOut();
    await rls.client.auth.signOut();
  }
});
