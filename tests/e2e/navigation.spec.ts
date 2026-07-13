import { expect, test } from "@playwright/test";

test("home, login, and dashboard are available", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("好教材");
  await page.getByRole("link", { name: "登入", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "下一堂好課",
  );
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?notice=authentication_required$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "下一堂好課",
  );
});
