import { expect, test, type Page } from "@playwright/test";

interface AccountConfiguration {
  readonly email: string;
  readonly passwords: readonly string[];
}

interface ClassSummary {
  readonly id: string;
  readonly status: "active" | "archived" | "inactive";
}

interface RosterEnrollment {
  readonly membership_status: string;
  readonly [key: string]: unknown;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing_environment:${name}`);
  return value;
}

function primaryAccount(): AccountConfiguration {
  return {
    email: requiredEnvironment("E2E_AUTH_EMAIL"),
    passwords: [
      process.env.E2E_AUTH_PASSWORD,
      process.env.E2E_AUTH_NEW_PASSWORD,
    ].filter((value): value is string => Boolean(value?.trim())),
  };
}

function secondaryAccount(): AccountConfiguration {
  return {
    email: requiredEnvironment("E2E_RLS_EMAIL"),
    passwords: [requiredEnvironment("E2E_RLS_PASSWORD")],
  };
}

async function signIn(page: Page, account: AccountConfiguration) {
  if (account.passwords.length === 0) throw new Error("missing_password");
  await page.goto("/login");
  for (const password of account.passwords) {
    await page.getByLabel("電子郵件").fill(account.email);
    await page.getByLabel("密碼").fill(password);
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/auth/login" &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "登入", exact: true }).click();
    if ((await responsePromise).ok()) return;
  }
  throw new Error("development_auth_failed");
}

test("Class detail roster denies anonymous access", async ({ request }) => {
  const response = await request.get(
    "/api/classes/10000000-0000-4000-8000-000000000001",
  );
  expect(response.status()).toBe(401);
});

test("Owner reads the canonical Class roster projection and another tenant is denied", async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Run Development tenant verification once.",
  );

  const ownerContext = await browser.newContext();
  const otherTenantContext = await browser.newContext();
  try {
    const ownerPage = await ownerContext.newPage();
    await signIn(ownerPage, primaryAccount());
    const classesResponse = await ownerContext.request.get("/api/classes");
    expect(classesResponse.status()).toBe(200);
    const classesPayload = (await classesResponse.json()) as {
      readonly classes: readonly ClassSummary[];
    };
    const classroom = classesPayload.classes[0];
    expect(classroom).toBeDefined();
    if (!classroom) throw new Error("development_class_fixture_unavailable");

    const detailResponse = await ownerContext.request.get(
      `/api/classes/${classroom.id}`,
    );
    expect(detailResponse.status()).toBe(200);
    const detail = (await detailResponse.json()) as {
      readonly class: {
        readonly enrollments: readonly RosterEnrollment[];
        readonly id: string;
        readonly status: string;
      };
    };
    expect(detail.class).toMatchObject({
      id: classroom.id,
      status: classroom.status,
    });
    for (const enrollment of detail.class.enrollments) {
      expect(enrollment.membership_status).toBe("active");
      expect(enrollment).not.toHaveProperty("birthday");
      expect(enrollment).not.toHaveProperty("gender");
      expect(enrollment).not.toHaveProperty("school");
      expect(enrollment).not.toHaveProperty("account_id");
      expect(enrollment).not.toHaveProperty("account_link_id");
      expect(enrollment).not.toHaveProperty("profile_id");
    }

    const otherTenantPage = await otherTenantContext.newPage();
    await signIn(otherTenantPage, secondaryAccount());
    const crossTenantResponse = await otherTenantContext.request.get(
      `/api/classes/${classroom.id}`,
    );
    expect(crossTenantResponse.status()).toBe(404);
  } finally {
    await ownerContext.close();
    await otherTenantContext.close();
  }
});
