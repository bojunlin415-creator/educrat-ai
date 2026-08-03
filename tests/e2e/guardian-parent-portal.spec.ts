import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createE2ERunId } from "./helpers/test-data";

interface AccountConfiguration {
  email: string;
  passwords: readonly string[];
}

interface AuthenticatedFixture {
  client: SupabaseClient<Database>;
  user: User;
}

type GuardianInvitationRow =
  Database["public"]["Tables"]["guardian_invitations"]["Row"];
type StudentGuardianRow =
  Database["public"]["Tables"]["student_guardians"]["Row"];

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for GV-001E guardian E2E.`);
  }
  return value;
}

function passwordCandidates(...names: readonly string[]) {
  return names
    .map((name) => process.env[name])
    .filter((password): password is string => Boolean(password));
}

function getConfiguration() {
  const adminPasswords = passwordCandidates(
    "E2E_AUTH_PASSWORD",
    "E2E_AUTH_NEW_PASSWORD",
  );
  if (adminPasswords.length === 0) {
    throw new Error("E2E_AUTH_PASSWORD is required for GV-001E guardian E2E.");
  }

  return {
    admin: {
      email: requireEnvironment("E2E_AUTH_EMAIL"),
      passwords: adminPasswords,
    } satisfies AccountConfiguration,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    guardian: {
      email: requireEnvironment("E2E_GUARDIAN_EMAIL"),
      passwords: [requireEnvironment("E2E_GUARDIAN_PASSWORD")],
    } satisfies AccountConfiguration,
    organizationId: process.env.E2E_GV_ORGANIZATION_ID,
    publishableKey: requireEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    secondStudentId: requireEnvironment("E2E_GV_SECOND_STUDENT_ID"),
    studentId: requireEnvironment("E2E_GV_STUDENT_ID"),
    supabaseUrl: requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    wrongGuardian: {
      email:
        process.env.E2E_WRONG_GUARDIAN_EMAIL ??
        requireEnvironment("E2E_RLS_EMAIL"),
      passwords: [
        process.env.E2E_WRONG_GUARDIAN_PASSWORD ??
          requireEnvironment("E2E_RLS_PASSWORD"),
      ],
    } satisfies AccountConfiguration,
  };
}

function maskedEmail(email: string) {
  return createHash("sha256").update(email).digest("hex").slice(0, 10);
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

async function signInSupabase(
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
    `Unable to authenticate GV-001E fixture ${maskedEmail(account.email)}.`,
  );
}

async function loginByUi(page: Page, account: AccountConfiguration) {
  await page.context().clearCookies();
  await page.goto("/login");
  let authenticated = false;
  for (const password of account.passwords) {
    await page.getByLabel("電子郵件").fill(account.email);
    await page.getByLabel("密碼").fill(password);
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/auth/login" &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "登入", exact: true }).click();
    const response = await responsePromise;
    if (response.ok()) {
      authenticated = true;
      break;
    }
  }
  expect(authenticated, `login failed for ${maskedEmail(account.email)}`).toBe(
    true,
  );
}

async function logout(page: Page) {
  await page.context().request.post("/api/auth/logout");
  await page.context().clearCookies();
}

async function ensureActiveOrganization(
  page: Page,
  fixture: AuthenticatedFixture,
  organizationId?: string,
): Promise<string> {
  if (organizationId) {
    const { error } = await fixture.client.rpc("switch_active_organization", {
      p_organization_id: organizationId,
    });
    expect(error).toBeNull();
    const response = await page
      .context()
      .request.put("/api/organizations/active", {
        data: { organizationId },
      });
    expect(response.status()).toBe(200);
    return organizationId;
  }

  const { data, error } = await fixture.client.rpc(
    "get_active_organization_id",
  );
  expect(error).toBeNull();
  expect(data).toMatch(/[0-9a-f-]{36}/);
  if (!data) {
    throw new Error(
      "Active organization is required for GV-001E guardian E2E.",
    );
  }
  return data;
}

async function requireStudentFixture(
  admin: AuthenticatedFixture,
  organizationId: string,
  studentId: string,
): Promise<{ readonly displayName: string; readonly id: string }> {
  const { data: membership, error: membershipError } = await admin.client
    .from("organization_members")
    .select("id,role,status,user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", studentId)
    .eq("role", "student")
    .eq("status", "active")
    .maybeSingle();
  expect(membershipError).toBeNull();
  expect(
    membership,
    `Missing active student fixture ${studentId}`,
  ).not.toBeNull();

  const { data: profile, error: profileError } = await admin.client
    .from("profiles")
    .select("id,display_name")
    .eq("id", studentId)
    .maybeSingle();
  expect(profileError).toBeNull();
  expect(
    profile,
    `Missing profile for student fixture ${studentId}`,
  ).not.toBeNull();
  if (!profile?.display_name) {
    throw new Error(`Student fixture ${studentId} requires display_name.`);
  }
  return { displayName: profile.display_name, id: profile.id };
}

async function createInvitation(input: {
  readonly guardianEmail: string;
  readonly page: Page;
  readonly studentId: string;
}) {
  const response = await input.page
    .context()
    .request.post("/api/guardian-invitations", {
      data: {
        guardianEmail: input.guardianEmail,
        relationshipType: "parent",
        studentId: input.studentId,
      },
    });
  expect(response.status()).toBe(201);
  const payload = (await response.json()) as {
    readonly invitation?: {
      readonly invitationId: string;
      readonly invitationUrl: string;
      readonly rawToken: string;
    };
    readonly success?: boolean;
  };
  expect(payload.success).toBe(true);
  expect(payload.invitation?.invitationId).toMatch(/[0-9a-f-]{36}/);
  expect(payload.invitation?.invitationUrl).toContain(
    "/guardian-invitations/accept?token=",
  );
  expect(payload.invitation?.rawToken).toBeTruthy();
  return payload.invitation as {
    readonly invitationId: string;
    readonly invitationUrl: string;
    readonly rawToken: string;
  };
}

async function selectInvitation(
  admin: AuthenticatedFixture,
  invitationId: string,
) {
  const { data, error } = await admin.client
    .from("guardian_invitations")
    .select("*")
    .eq("id", invitationId)
    .single();
  expect(error).toBeNull();
  return data as GuardianInvitationRow;
}

async function selectRelationship(
  admin: AuthenticatedFixture,
  relationshipId: string,
) {
  const { data, error } = await admin.client
    .from("student_guardians")
    .select("*")
    .eq("id", relationshipId)
    .single();
  expect(error).toBeNull();
  return data as StudentGuardianRow;
}

async function acceptInvitationByUi(page: Page, invitationUrl: string) {
  await page.goto(invitationUrl);
  await expect(
    page.getByRole("heading", { name: /接受家長邀請/ }),
  ).toBeVisible();
  await expect(page.getByText("Guardian Verification")).toBeVisible();
  const source = await page.content();
  const token = new URL(invitationUrl).searchParams.get("token");
  if (!token) throw new Error("Guardian invitation URL is missing token.");
  expect(source).not.toContain(token);
  await page.getByRole("checkbox").check();
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/guardian-invitations/accept" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "同意並啟用家長入口" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as {
    readonly relationshipId?: string;
    readonly success?: boolean;
  };
  expect(payload.success).toBe(true);
  expect(payload.relationshipId).toMatch(/[0-9a-f-]{36}/);
  await expect(page).toHaveURL(/\/dashboard\/parent/);
  return payload.relationshipId as string;
}

test.describe.configure({ mode: "serial", timeout: 300_000 });

test("guardian invitation, consent, parent portal, revocation, and security boundaries", async ({
  page,
}, testInfo) => {
  const configuration = getConfiguration();
  const runId = createE2ERunId(testInfo.workerIndex);
  const admin = await signInSupabase(
    configuration.supabaseUrl,
    configuration.publishableKey,
    configuration.admin,
  );
  const guardian = await signInSupabase(
    configuration.supabaseUrl,
    configuration.publishableKey,
    configuration.guardian,
  );
  const wrongGuardian = await signInSupabase(
    configuration.supabaseUrl,
    configuration.publishableKey,
    configuration.wrongGuardian,
  );

  await loginByUi(page, configuration.admin);
  const organizationId = await ensureActiveOrganization(
    page,
    admin,
    configuration.organizationId,
  );
  const firstStudent = await requireStudentFixture(
    admin,
    organizationId,
    configuration.studentId,
  );
  const secondStudent = await requireStudentFixture(
    admin,
    organizationId,
    configuration.secondStudentId,
  );

  const adminInvitationResponse = await page
    .context()
    .request.post("/api/guardian-invitations", {
      data: {
        guardianEmail: configuration.guardian.email,
        relationshipType: "parent",
        studentId: configuration.studentId,
      },
    });
  expect(adminInvitationResponse.status()).toBe(201);
  const firstInvitationPayload = (await adminInvitationResponse.json()) as {
    readonly invitation: {
      readonly invitationId: string;
      readonly invitationUrl: string;
      readonly rawToken: string;
    };
  };
  const firstInvitation = firstInvitationPayload.invitation;
  const pendingInvitation = await selectInvitation(
    admin,
    firstInvitation.invitationId,
  );
  expect(pendingInvitation.status).toBe("pending");
  expect(pendingInvitation.token_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(pendingInvitation)).not.toContain(
    firstInvitation.rawToken,
  );

  await logout(page);
  const anonymousCreateResponse = await page
    .context()
    .request.post("/api/guardian-invitations", {
      data: {
        guardianEmail: configuration.guardian.email,
        relationshipType: "parent",
        studentId: configuration.studentId,
      },
    });
  expect(anonymousCreateResponse.status()).toBe(401);

  await loginByUi(page, configuration.wrongGuardian);
  const wrongEmailAcceptResponse = await page
    .context()
    .request.post("/api/guardian-invitations/accept", {
      data: {
        consentVersion: "guardian-consent-v1",
        token: firstInvitation.rawToken,
      },
    });
  expect(wrongEmailAcceptResponse.status()).toBe(403);
  expect(await wrongEmailAcceptResponse.text()).not.toContain("token_hash");
  await page.goto(firstInvitation.invitationUrl);
  await expect(page.getByText("邀請無法使用")).toBeVisible();
  await expect(page.getByText("找不到可使用的家長邀請")).toBeVisible();
  await logout(page);

  await loginByUi(page, configuration.guardian);
  const relationshipId = await acceptInvitationByUi(
    page,
    firstInvitation.invitationUrl,
  );
  const acceptedInvitation = await selectInvitation(
    admin,
    firstInvitation.invitationId,
  );
  expect(acceptedInvitation.status).toBe("accepted");
  expect(acceptedInvitation.accepted_at).toBeTruthy();
  expect(acceptedInvitation.consumed_by_account_id).toBe(guardian.user.id);
  expect(acceptedInvitation.consent_version).toBe("guardian-consent-v1");

  const relationship = await selectRelationship(admin, relationshipId);
  expect(relationship.status).toBe("active");
  expect(relationship.guardian_user_id).toBe(guardian.user.id);
  expect(relationship.student_id).toBe(configuration.studentId);
  expect(relationship.verified_at).toBeTruthy();
  expect(relationship.consent_granted_at).toBeTruthy();
  expect(relationship.activated_at).toBeTruthy();

  await page.goto("/dashboard/parent");
  await expect(page.getByText("Child Selector")).toBeVisible();
  await expect(page.getByText(firstStudent.displayName)).toBeVisible();
  await expect(page.getByText("Learning Progress")).toBeVisible();
  await expect(page.getByText("Assignment Summary")).toBeVisible();
  await expect(page.getByText("Recommended Practice")).toBeVisible();
  await expect(page.getByText("Parent Insight")).toBeVisible();

  const summaryResponse = await page
    .context()
    .request.get(
      `/api/dashboard/parent/students/${configuration.studentId}/summary`,
    );
  expect(summaryResponse.status()).toBe(200);
  const assignmentsResponse = await page
    .context()
    .request.get(
      `/api/dashboard/parent/students/${configuration.studentId}/assignments`,
    );
  expect(assignmentsResponse.status()).toBe(200);
  const recommendationsResponse = await page
    .context()
    .request.get(
      `/api/dashboard/parent/students/${configuration.studentId}/recommendations`,
    );
  expect(recommendationsResponse.status()).toBe(200);

  const unrelatedChildResponse = await page
    .context()
    .request.get(
      `/api/dashboard/parent/students/00000000-0000-4000-8000-000000000099/summary`,
    );
  expect(unrelatedChildResponse.status()).toBe(404);

  const replayResponse = await page
    .context()
    .request.post("/api/guardian-invitations/accept", {
      data: {
        consentVersion: "guardian-consent-v1",
        token: firstInvitation.rawToken,
      },
    });
  expect(replayResponse.status()).toBe(410);

  const directRelationshipInsert = await guardian.client
    .from("student_guardians")
    .insert({
      guardian_account_id: guardian.user.id,
      guardian_user_id: guardian.user.id,
      organization_id: organizationId,
      relationship_type: "parent",
      status: "active",
      student_id: configuration.secondStudentId,
    });
  expect(directRelationshipInsert.error).not.toBeNull();

  const directRelationshipActivation = await guardian.client
    .from("student_guardians")
    .update({ status: "active" })
    .eq("id", relationshipId);
  expect(directRelationshipActivation.error).not.toBeNull();

  const directConsentWrite = await guardian.client
    .from("guardian_invitations")
    .update({ consent_version: "guardian-consent-v1" })
    .eq("id", firstInvitation.invitationId);
  expect(directConsentWrite.error).not.toBeNull();

  const crossTenantRead = await wrongGuardian.client
    .from("student_guardians")
    .select("id")
    .eq("id", relationshipId);
  expect(crossTenantRead.error).toBeNull();
  expect(crossTenantRead.data).toEqual([]);

  await logout(page);
  await loginByUi(page, configuration.admin);
  await ensureActiveOrganization(page, admin, organizationId);
  const secondInvitation = await createInvitation({
    guardianEmail: configuration.guardian.email,
    page,
    studentId: configuration.secondStudentId,
  });
  await logout(page);
  await loginByUi(page, configuration.guardian);
  const secondRelationshipId = await acceptInvitationByUi(
    page,
    secondInvitation.invitationUrl,
  );

  await page.goto("/dashboard/parent");
  await expect(page.getByText(firstStudent.displayName)).toBeVisible();
  await expect(page.getByText(secondStudent.displayName)).toBeVisible();
  await page
    .getByRole("link", { name: new RegExp(secondStudent.displayName) })
    .click();
  await expect(page).toHaveURL(new RegExp(configuration.secondStudentId));
  await expect(page.getByText("Assignment Summary")).toBeVisible();

  await logout(page);
  await loginByUi(page, configuration.admin);
  await ensureActiveOrganization(page, admin, organizationId);
  const revokeFirstResponse = await page
    .context()
    .request.post(`/api/guardian-relationships/${relationshipId}/revoke`, {
      data: { reason: `GV-001E first child revoke ${runId}` },
    });
  expect(revokeFirstResponse.status()).toBe(200);
  const revokedFirstRelationship = await selectRelationship(
    admin,
    relationshipId,
  );
  expect(revokedFirstRelationship.status).toBe("revoked");
  expect(revokedFirstRelationship.revoked_at).toBeTruthy();

  await logout(page);
  await loginByUi(page, configuration.guardian);
  await page.goto("/dashboard/parent");
  await expect(page.getByText(firstStudent.displayName)).toHaveCount(0);
  await expect(page.getByText(secondStudent.displayName)).toBeVisible();
  const revokedChildResponse = await page
    .context()
    .request.get(
      `/api/dashboard/parent/students/${configuration.studentId}/summary`,
    );
  expect(revokedChildResponse.status()).toBe(404);

  await logout(page);
  await loginByUi(page, configuration.admin);
  await ensureActiveOrganization(page, admin, organizationId);
  const revokeSecondResponse = await page
    .context()
    .request.post(
      `/api/guardian-relationships/${secondRelationshipId}/revoke`,
      { data: { reason: `GV-001E second child cleanup ${runId}` } },
    );
  expect(revokeSecondResponse.status()).toBe(200);

  const { data: auditEvents, error: auditError } = await admin.client
    .from("parent_portal_audit_events")
    .select("action,metadata")
    .eq("organization_id", organizationId)
    .in("action", [
      "GUARDIAN_INVITATION_CREATED",
      "GUARDIAN_INVITATION_ACCEPTED",
      "GUARDIAN_CONSENT_GRANTED",
      "GUARDIAN_RELATIONSHIP_CREATED",
      "GUARDIAN_RELATIONSHIP_REVOKED",
      "PARENT_STUDENT_REPORT_VIEWED",
    ]);
  expect(auditError).toBeNull();
  const actions = new Set((auditEvents ?? []).map((event) => event.action));
  expect(actions).toContain("GUARDIAN_INVITATION_CREATED");
  expect(actions).toContain("GUARDIAN_INVITATION_ACCEPTED");
  expect(actions).toContain("GUARDIAN_CONSENT_GRANTED");
  expect(actions).toContain("GUARDIAN_RELATIONSHIP_CREATED");
  expect(actions).toContain("GUARDIAN_RELATIONSHIP_REVOKED");
  expect(JSON.stringify(auditEvents)).not.toContain(firstInvitation.rawToken);
  expect(JSON.stringify(auditEvents)).not.toContain(secondInvitation.rawToken);
});
