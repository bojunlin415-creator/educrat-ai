import { expect, test } from "@playwright/test";

const email = process.env.E2E_AUTH_EMAIL;
const passwordCandidates = [
  process.env.E2E_AUTH_PASSWORD,
  process.env.E2E_AUTH_NEW_PASSWORD,
].filter((password): password is string => Boolean(password));

test.describe.configure({ timeout: 60_000 });

test("authenticated user completes and manages their profile", async ({
  page,
}) => {
  test.skip(
    !email || passwordCandidates.length === 0,
    "E2E auth account is not configured.",
  );

  await page.goto("/login");
  let authenticated = false;
  for (const password of passwordCandidates) {
    await page.getByLabel("電子郵件").fill(email ?? "");
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
  await expect(page).toHaveURL(/\/(dashboard|onboarding)$/);

  // Exercise the authenticated profile UI at a phone viewport in this same
  // session. Keeping one real login avoids unnecessary Supabase Auth traffic
  // while the separate mobile project continues to cover public navigation.
  await page.setViewportSize({ width: 390, height: 844 });
  if (new URL(page.url()).pathname === "/onboarding") {
    await expect(
      page.getByRole("heading", { name: "先完成老師基本資料" }),
    ).toBeVisible();
    await expect(page.getByLabel("顯示名稱")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "完成基本資料" }),
    ).toBeVisible();
  } else {
    await page.goto("/settings/profile");
    await expect(page.getByRole("heading", { name: "個人資料" })).toBeVisible();
    await expect(page.getByLabel("顯示名稱")).toBeVisible();
    await expect(page.getByLabel("選擇個人圖片")).toBeVisible();
  }

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/(dashboard|onboarding)$/);

  if (new URL(page.url()).pathname === "/onboarding") {
    await page.getByLabel("顯示名稱").fill("Sprint 5 測試老師");
    await page.getByLabel("電話").fill("0912-345-678");
    await page.getByLabel("介面語言").selectOption("zh-TW");
    await page.getByLabel("時區").selectOption("Asia/Taipei");
    await page.getByRole("button", { name: "完成基本資料" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  }

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
