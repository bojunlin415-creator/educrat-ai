import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import {
  createE2ERunId,
  createUniqueCurriculumName,
  createUpdatedCurriculumName,
} from "./helpers/test-data";

const email = process.env.E2E_AUTH_EMAIL;
const passwordCandidates = [
  process.env.E2E_AUTH_PASSWORD,
  process.env.E2E_AUTH_NEW_PASSWORD,
].filter((password): password is string => Boolean(password));

function requireConfiguredAuthAccount() {
  if (!email || passwordCandidates.length === 0) {
    throw new Error(
      "E2E auth account is not configured. Set local E2E_AUTH_EMAIL and password variables.",
    );
  }

  return { email, passwordCandidates };
}

// This real browser flow covers the integrated Sprint 5 profile, Sprint 6
// organization, and Sprint 7 curriculum journeys against Development
// Supabase. Keep one authenticated session to avoid provider rate limits, but
// allow enough time for the full remote round-trip sequence on slower runs.
test.describe.configure({ timeout: 240_000 });

test("authenticated user completes and manages their profile", async ({
  page,
}, testInfo) => {
  const authAccount = requireConfiguredAuthAccount();
  const runId = createE2ERunId(testInfo.workerIndex);

  const fixtureSlug = `e2e-${createHash("sha256")
    .update(authAccount.email)
    .digest("hex")
    .slice(0, 12)}`;
  const curriculumFixtureName = createUniqueCurriculumName(runId);
  const updatedCurriculumFixtureName = createUpdatedCurriculumName(
    curriculumFixtureName,
  );
  const conflictingCurriculumFixtureName = createUniqueCurriculumName(
    runId,
    "名稱衝突教材",
  );
  const unauthenticatedCreateResponse = await page
    .context()
    .request.post("/api/organizations", {
      data: {
        address: "",
        businessName: "",
        email: "",
        name: "未登入測試機構",
        phone: "",
        slug: "unauthenticated-school",
      },
    });
  expect(unauthenticatedCreateResponse.status()).toBe(401);
  const unauthenticatedCurriculumsResponse = await page
    .context()
    .request.get("/api/curriculums");
  expect(unauthenticatedCurriculumsResponse.status()).toBe(401);
  const unauthenticatedExportResponse = await page
    .context()
    .request.get(
      "/api/curricula/00000000-0000-4000-8000-000000000000/versions/00000000-0000-4000-8000-000000000001/export?mode=worksheet",
    );
  expect(unauthenticatedExportResponse.status()).toBe(401);
  expect(
    (
      await page
        .context()
        .request.get(
          "/api/chapters?curriculumId=00000000-0000-4000-8000-000000000000",
        )
    ).status(),
  ).toBe(401);
  expect(
    (
      await page
        .context()
        .request.get(
          "/api/lessons?chapterId=00000000-0000-4000-8000-000000000000",
        )
    ).status(),
  ).toBe(401);

  await page.goto("/login");
  let authenticated = false;
  for (const password of authAccount.passwordCandidates) {
    await page.getByLabel("電子郵件").fill(authAccount.email);
    await page.getByLabel("密碼").fill(password);
    const loginResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/auth/login" &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "登入", exact: true }).click();
    const loginResponse = await loginResponsePromise;
    if (loginResponse.ok()) {
      authenticated = true;
      break;
    }
  }
  expect(authenticated).toBe(true);

  // A direct navigation also proves the login response wrote a usable session
  // cookie, without depending on a pending development-mode RSC transition.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(
    /\/(dashboard|onboarding|onboarding\/organization)$/,
  );

  // Exercise the authenticated profile UI at a phone viewport in this same
  // session. Keeping one real login avoids unnecessary Supabase Auth traffic
  // while the separate mobile project continues to cover public navigation.
  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePath = new URL(page.url()).pathname;
  if (mobilePath === "/onboarding") {
    await expect(
      page.getByRole("heading", { name: "先完成老師基本資料" }),
    ).toBeVisible();
    await expect(page.getByLabel("顯示名稱")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "完成基本資料" }),
    ).toBeVisible();
  } else if (mobilePath === "/onboarding/organization") {
    await expect(
      page.getByRole("heading", { name: "建立你的補習班機構" }),
    ).toBeVisible();
    await expect(page.getByLabel("機構／補習班名稱")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "建立機構並進入工作台" }),
    ).toBeVisible();
  } else {
    await expect(page.getByLabel("目前機構")).toBeVisible();
    await page.goto("/settings/profile");
    await expect(page.getByRole("heading", { name: "個人資料" })).toBeVisible();
    await expect(page.getByLabel("顯示名稱")).toBeVisible();
    await expect(page.getByLabel("選擇個人圖片")).toBeVisible();
  }

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(
    /\/(dashboard|onboarding|onboarding\/organization)$/,
  );

  if (new URL(page.url()).pathname === "/onboarding") {
    await page.getByLabel("顯示名稱").fill("Sprint 5 測試老師");
    await page.getByLabel("電話").fill("0912-345-678");
    await page.getByLabel("介面語言").selectOption("zh-TW");
    await page.getByLabel("時區").selectOption("Asia/Taipei");
    await page.getByRole("button", { name: "完成基本資料" }).click();
    await expect(page).toHaveURL(/\/(dashboard|onboarding\/organization)$/);
  }

  await page.goto("/dashboard");
  if (new URL(page.url()).pathname === "/onboarding/organization") {
    await page.getByLabel("機構／補習班名稱").fill("Sprint 6 E2E 機構");
    await page.getByRole("textbox", { name: /網址代稱/ }).fill(fixtureSlug);
    await page.getByRole("button", { name: "建立機構並進入工作台" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  }

  await expect(page.getByLabel("目前機構")).toBeVisible();
  await expect(page.getByText(/機構擁有者/).first()).toBeVisible();

  await page.goto("/curriculums");
  await expect(page.getByRole("heading", { name: "教材列表" })).toBeVisible();
  await page
    .getByRole("link", { name: /建立.*教材/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/curriculums\/new$/);
  await page.getByLabel("教材名稱").fill(curriculumFixtureName);
  await page.getByLabel("科目").selectOption({ label: "數學" });
  await page.getByLabel("年級").selectOption({ label: "四年級" });
  await page
    .getByLabel("教材進度架構")
    .selectOption({ label: "教學進度模板 2" });
  await page.getByLabel("學年度").fill("115");
  await page.getByLabel("學期").selectOption("1");
  await page.getByLabel("狀態").selectOption("draft");
  await page.getByLabel("初始版本備註（選填）").fill("E2E 初始版本");
  const createCurriculumResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/curriculums" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "建立教材" }).click();
  const createCurriculumResponse = await createCurriculumResponsePromise;
  expect(createCurriculumResponse.ok()).toBe(true);
  await expect(page).toHaveURL(/\/curriculums\/[0-9a-f-]+$/);

  await expect(
    page.getByRole("heading", { name: curriculumFixtureName }),
  ).toBeVisible();
  await expect(page.getByText("版本 1", { exact: true })).toBeVisible();
  const curriculumId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  const curriculumDetailResponse = await page
    .context()
    .request.get(`/api/curriculums/${curriculumId}`);
  expect(curriculumDetailResponse.status()).toBe(200);
  const curriculumDetailPayload = (await curriculumDetailResponse.json()) as {
    curriculum: {
      grade_id: string;
      publisher_id: string;
      subject_id: string;
      versions: Array<{ id: string; version: number }>;
    };
  };
  const versionId = curriculumDetailPayload.curriculum.versions[0]?.id ?? "";
  expect(versionId).toMatch(/[0-9a-f-]{36}/);
  for (const mode of ["worksheet", "answer-sheet", "combined"] as const) {
    const exportResponse = await page
      .context()
      .request.get(
        `/api/curricula/${curriculumId}/versions/${versionId}/export?mode=${mode}`,
      );
    expect(exportResponse.status()).toBe(200);
    expect(exportResponse.headers()["content-type"]).toContain(
      "application/pdf",
    );
    expect((await exportResponse.body()).byteLength).toBeGreaterThan(500);
  }

  const invalidCurriculumResponse = await page
    .context()
    .request.post("/api/curriculums", {
      data: {
        gradeId: "invalid",
        name: "非法教材",
        organizationId: "00000000-0000-4000-8000-000000000000",
        publisherId: "invalid",
        schoolYear: 99,
        semester: 3,
        status: "draft",
        subjectId: "invalid",
        versionRemark: "",
      },
    });
  expect(invalidCurriculumResponse.status()).toBe(422);

  const conflictingCurriculumResponse = await page
    .context()
    .request.post("/api/curriculums", {
      data: {
        gradeId: curriculumDetailPayload.curriculum.grade_id,
        name: conflictingCurriculumFixtureName,
        publisherId: curriculumDetailPayload.curriculum.publisher_id,
        schoolYear: 115,
        semester: 1,
        status: "draft",
        subjectId: curriculumDetailPayload.curriculum.subject_id,
        versionRemark: "",
      },
    });
  expect(conflictingCurriculumResponse.status()).toBe(201);

  const duplicateCurriculumUpdateResponse = await page
    .context()
    .request.patch(`/api/curriculums/${curriculumId}`, {
      data: {
        curriculumReferenceId: curriculumDetailPayload.curriculum.publisher_id,
        gradeId: curriculumDetailPayload.curriculum.grade_id,
        name: conflictingCurriculumFixtureName,
        schoolYear: 115,
        semester: 1,
        status: "draft",
        subjectId: curriculumDetailPayload.curriculum.subject_id,
      },
    });
  expect(duplicateCurriculumUpdateResponse.status()).toBe(409);
  await expect(duplicateCurriculumUpdateResponse.json()).resolves.toMatchObject(
    {
      message: "目前機構已有相同名稱的教材，請更換名稱。",
      success: false,
    },
  );

  await page.getByRole("link", { name: "編輯基本資料" }).click();
  await page.getByLabel("教材名稱").fill(updatedCurriculumFixtureName);
  await page.getByLabel("學期").selectOption("2");
  const updateCurriculumResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/curriculums/${curriculumId}` &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "儲存教材" }).click();
  const updateCurriculumResponse = await updateCurriculumResponsePromise;
  expect(updateCurriculumResponse.ok()).toBe(true);
  await expect(page).toHaveURL(new RegExp(`/curriculums/${curriculumId}$`));
  await expect(
    page.getByRole("heading", { name: updatedCurriculumFixtureName }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: updatedCurriculumFixtureName }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/curriculums/${curriculumId}`);
  await expect(page.getByText("目前版本")).toBeVisible();
  await expect(page.getByText("v1", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/curriculums/${curriculumId}/edit`);
  await page.getByLabel("教材名稱").fill(curriculumFixtureName);
  await page.getByLabel("學期").selectOption("1");
  await page.getByRole("button", { name: "儲存教材" }).click();
  await expect(page).toHaveURL(new RegExp(`/curriculums/${curriculumId}$`));

  // Sprint 8 Curriculum Editor: clean deterministic fixtures, then exercise
  // chapter/lesson create, edit, server reorder, and delete through the UI.
  const existingHierarchyResponse = await page
    .context()
    .request.get(`/api/chapters?curriculumId=${curriculumId}`);
  expect(existingHierarchyResponse.status()).toBe(200);
  const existingHierarchy = (await existingHierarchyResponse.json()) as {
    hierarchy: { chapters: Array<{ id: string; title: string }> };
  };
  for (const chapter of existingHierarchy.hierarchy.chapters.filter(
    ({ title }) => title.startsWith("Sprint 8 E2E"),
  )) {
    const cleanupResponse = await page
      .context()
      .request.delete("/api/chapters", {
        data: { chapterId: chapter.id },
      });
    expect(cleanupResponse.ok()).toBe(true);
  }

  await page.goto(`/curriculums/${curriculumId}/editor`);
  await expect(
    page.getByRole("heading", { name: curriculumFixtureName }),
  ).toBeVisible();
  await expect(page.getByText("版本 1", { exact: true })).toBeVisible();
  await expect(page.getByText("草稿", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "新增章節" }).first().click();
  await page.getByLabel("章節編號").fill("91");
  await page.getByLabel("章節標題").fill("Sprint 8 E2E Chapter A");
  await page.getByLabel("章節說明").fill("章節 A 說明");
  await page.getByRole("button", { name: "建立章節" }).click();
  await expect(page.getByText("Sprint 8 E2E Chapter A")).toBeVisible();

  await page.getByRole("button", { name: "新增章節" }).first().click();
  await page.getByLabel("章節編號").fill("92");
  await page.getByLabel("章節標題").fill("Sprint 8 E2E Chapter B");
  await page.getByRole("button", { name: "建立章節" }).click();
  await expect(page.getByText("Sprint 8 E2E Chapter B")).toBeVisible();

  await page.getByRole("button", { name: "將第 92 章向上移" }).click();
  await expect(
    page.getByRole("tree").locator("li[role='treeitem']").first(),
  ).toContainText("Sprint 8 E2E Chapter B");

  await page
    .getByRole("button", { name: /第 91 章.*Sprint 8 E2E Chapter A/ })
    .click();
  await page.getByLabel("章節標題").fill("Sprint 8 E2E Chapter A Updated");
  await page.getByLabel("狀態").selectOption("active");
  await page.getByRole("button", { name: "儲存章節" }).click();
  await expect(page.getByText("Sprint 8 E2E Chapter A Updated")).toBeVisible();

  const chapterAItem = page
    .getByRole("treeitem")
    .filter({ hasText: "Sprint 8 E2E Chapter A Updated" })
    .first();
  await chapterAItem.getByRole("button", { name: "新增課次" }).click();
  await page.getByLabel("課次編號").fill("1");
  await page.getByLabel("課次標題").fill("Sprint 8 E2E Lesson One");
  await page.getByLabel("預估分鐘（選填）").fill("40");
  await page.getByLabel("學習目標（每行一項）").fill("能完成第一個目標");
  await page.getByLabel("教學備註").fill("第一課教學備註");
  await page.getByRole("button", { name: "建立課次" }).click();
  await expect(page.getByText("Sprint 8 E2E Lesson One")).toBeVisible();

  await chapterAItem.getByRole("button", { name: "新增課次" }).click();
  await page.getByLabel("課次編號").fill("2");
  await page.getByLabel("課次標題").fill("Sprint 8 E2E Lesson Two");
  await page.getByLabel("預估分鐘（選填）").fill("45");
  await page.getByRole("button", { name: "建立課次" }).click();
  await expect(page.getByText("Sprint 8 E2E Lesson Two")).toBeVisible();

  await page.getByRole("button", { name: "將第 2 課向上移" }).click();
  const chapterAAfterLessons = page
    .getByRole("treeitem")
    .filter({ hasText: "Sprint 8 E2E Chapter A Updated" })
    .first();
  await expect(
    chapterAAfterLessons.locator("li[role='treeitem']").first(),
  ).toContainText("Sprint 8 E2E Lesson Two");

  await page
    .getByRole("button", { name: /第 1 課.*Sprint 8 E2E Lesson One/ })
    .click();
  await page.getByLabel("課次標題").fill("Sprint 8 E2E Lesson One Updated");
  await page.getByLabel("狀態").selectOption("active");
  await page.getByRole("button", { name: "儲存課次" }).click();
  await expect(page.getByText("Sprint 8 E2E Lesson One Updated")).toBeVisible();

  await page
    .getByRole("button", { name: /第 2 課.*Sprint 8 E2E Lesson Two/ })
    .click();
  await page.getByRole("button", { name: "刪除課次" }).click();
  await page.getByRole("button", { name: "確定刪除" }).click();
  await expect(page.getByText("Sprint 8 E2E Lesson Two")).not.toBeVisible();

  await page
    .getByRole("button", { name: /第 92 章.*Sprint 8 E2E Chapter B/ })
    .click();
  await page.getByRole("button", { name: "刪除章節" }).click();
  await page.getByRole("button", { name: "確定刪除" }).click();
  await expect(page.getByText("Sprint 8 E2E Chapter B")).not.toBeVisible();

  await page
    .getByRole("button", {
      name: /第 91 章.*Sprint 8 E2E Chapter A Updated/,
    })
    .click();
  await page.getByRole("button", { name: "刪除章節" }).click();
  await page.getByRole("button", { name: "確定刪除" }).click();
  await expect(page.getByText("尚未建立章節")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/curriculums/${curriculumId}/editor`);
  await expect(page.getByText("教材結構")).toBeVisible();
  await expect(page.getByText("選擇一個章節或課次")).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto("/settings/profile");
  await expect(page.getByRole("heading", { name: "個人資料" })).toBeVisible();
  const displayNameInput = page.getByLabel("顯示名稱");
  const phoneInput = page.getByLabel("電話");
  const localeInput = page.getByLabel("介面語言");
  const timezoneInput = page.getByLabel("時區");
  const originalProfile = {
    displayName: await displayNameInput.inputValue(),
    locale: await localeInput.inputValue(),
    phone: await phoneInput.inputValue(),
    timezone: await timezoneInput.inputValue(),
  };

  await displayNameInput.fill("Sprint 5 驗收老師");
  await phoneInput.fill("02-2345-6789");
  await localeInput.selectOption("zh-TW");
  await timezoneInput.selectOption("Asia/Taipei");
  await page.getByRole("button", { name: "儲存變更" }).click();
  await expect(page.getByText("個人資料已儲存。")).toBeVisible();

  const invalidProfileResponse = await page
    .context()
    .request.put("/api/profile", {
      data: {
        displayName: "",
        locale: "unsupported",
        phone: "invalid-phone",
        timezone: "unsupported",
      },
    });
  expect(invalidProfileResponse.status()).toBe(400);

  await page.getByLabel("選擇個人圖片").setInputFiles({
    buffer: Buffer.from("not-an-image"),
    mimeType: "image/png",
    name: "invalid.png",
  });
  await expect(page.getByText("只支援 JPEG、PNG 或 WebP 圖片。")).toBeVisible();

  await page.getByLabel("選擇個人圖片").setInputFiles({
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    mimeType: "image/png",
    name: "avatar.png",
  });
  await expect(page.getByText("個人圖片已更新。")).toBeVisible();
  await page.getByRole("button", { name: "移除圖片" }).click();
  await expect(page.getByText("個人圖片已移除。")).toBeVisible({
    timeout: 15_000,
  });

  await page.goto("/dashboard");
  await expect(page.getByText("下午好，Sprint 5 驗收老師")).toBeVisible();

  await page.goto("/settings/organization");
  await expect(page.getByRole("heading", { name: "機構設定" })).toBeVisible();
  const currentOrganizationSlug = await page
    .getByText("網址代稱", { exact: true })
    .locator("..")
    .locator("dd")
    .innerText();
  const organizationNameInput = page.getByLabel("機構名稱");
  const businessNameInput = page.getByLabel("立案或公司名稱");
  const taxIdInput = page.getByLabel("統一編號／稅籍編號");
  const organizationPhoneInput = page.getByLabel("機構電話");
  const organizationEmailInput = page.getByLabel("機構電子郵件");
  const organizationAddressInput = page.getByLabel("機構地址");
  const originalOrganization = {
    address: await organizationAddressInput.inputValue(),
    businessName: await businessNameInput.inputValue(),
    email: await organizationEmailInput.inputValue(),
    name: await organizationNameInput.inputValue(),
    phone: await organizationPhoneInput.inputValue(),
    taxId: await taxIdInput.inputValue(),
  };

  await organizationNameInput.fill("Sprint 6 驗收機構");
  await businessNameInput.fill("Sprint 6 測試補習班");
  await taxIdInput.fill("12345678");
  await organizationPhoneInput.fill("02-2345-6789");
  await organizationEmailInput.fill("school@example.com");
  await organizationAddressInput.fill("台北市測試路 6 號");
  await page.getByRole("button", { name: "儲存機構資料" }).click();
  await expect(page.getByText("機構資料已儲存。")).toBeVisible();

  const invalidOrganizationResponse = await page
    .context()
    .request.put("/api/organizations/current", {
      data: {
        ...originalOrganization,
        createdBy: "00000000-0000-0000-0000-000000000000",
      },
    });
  expect(invalidOrganizationResponse.status()).toBe(422);

  const invalidSwitchResponse = await page
    .context()
    .request.put("/api/organizations/active", {
      data: { organizationId: "00000000-0000-4000-8000-000000000000" },
    });
  expect(invalidSwitchResponse.status()).toBe(403);

  const duplicateSlugResponse = await page
    .context()
    .request.post("/api/organizations", {
      data: {
        address: "",
        businessName: "",
        email: "",
        name: "重複網址測試機構",
        phone: "",
        slug: currentOrganizationSlug,
      },
    });
  expect(duplicateSlugResponse.status()).toBe(409);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page.getByLabel("目前機構")).toBeVisible();
  await expect(page.getByText("Sprint 6 驗收機構").first()).toBeVisible();
  await page.goto("/settings/organization");
  await expect(page.getByRole("heading", { name: "機構設定" })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/settings/organization");
  await page.getByLabel("機構名稱").fill(originalOrganization.name);
  await page
    .getByLabel("立案或公司名稱")
    .fill(originalOrganization.businessName);
  await page.getByLabel("統一編號／稅籍編號").fill(originalOrganization.taxId);
  await page.getByLabel("機構電話").fill(originalOrganization.phone);
  await page.getByLabel("機構電子郵件").fill(originalOrganization.email);
  await page.getByLabel("機構地址").fill(originalOrganization.address);
  await page.getByRole("button", { name: "儲存機構資料" }).click();
  await expect(page.getByText("機構資料已儲存。")).toBeVisible();

  await page.goto("/settings/profile");
  await page.getByLabel("顯示名稱").fill(originalProfile.displayName);
  await page.getByLabel("電話").fill(originalProfile.phone);
  await page.getByLabel("介面語言").selectOption(originalProfile.locale);
  await page.getByLabel("時區").selectOption(originalProfile.timezone);
  await page.getByRole("button", { name: "儲存變更" }).click();
  await expect(page.getByText("個人資料已儲存。")).toBeVisible();

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "登出" }).click();
  await expect(page).toHaveURL(/\/login\?notice=signed_out$/);
  await page.goto("/settings/profile");
  await expect(page).toHaveURL(/\/login\?notice=authentication_required$/);
});
