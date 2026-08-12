import { expect, test, type Page } from "@playwright/test";
import { createE2ERunId } from "./helpers/test-data";

const email = process.env.E2E_AUTH_EMAIL;
const passwordCandidates = [
  process.env.E2E_AUTH_PASSWORD,
  process.env.E2E_AUTH_NEW_PASSWORD,
].filter((password): password is string => Boolean(password));

function requireConfiguredAuthAccount() {
  if (!email || passwordCandidates.length === 0) {
    throw new Error(
      "E2E auth account is not configured for Sprint 8 Development verification.",
    );
  }
  return { email, passwordCandidates };
}

async function signIn(page: Page) {
  const account = requireConfiguredAuthAccount();
  await page.goto("/login");
  for (const password of account.passwordCandidates) {
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
  throw new Error("Unable to authenticate the configured Development account.");
}

test("classes and students APIs fail closed for anonymous users", async ({
  request,
}) => {
  expect((await request.get("/api/classes")).status()).toBe(401);
  expect((await request.get("/api/students")).status()).toBe(401);
  expect(
    (
      await request.post("/api/students", {
        data: {
          gender: "undisclosed",
          grade: "五年級",
          name: "未授權學生",
          studentNo: "NO-AUTH",
        },
      })
    ).status(),
  ).toBe(401);
});

test("authenticated owner manages a student through the real Development runtime", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Run the stateful Development mutation once.",
  );
  await signIn(page);

  const [classesResponse, studentsResponse] = await Promise.all([
    page.context().request.get("/api/classes"),
    page.context().request.get("/api/students"),
  ]);
  expect(classesResponse.status()).toBe(200);
  expect(studentsResponse.status()).toBe(200);

  const invalidResponse = await page.context().request.post("/api/students", {
    data: { name: "缺少必要欄位" },
  });
  expect(invalidResponse.status()).toBe(400);
  expect(await invalidResponse.json()).toMatchObject({
    code: "invalid_input",
    success: false,
  });

  const runId = createE2ERunId(testInfo.workerIndex);
  const studentNo = `S8V-${runId.toUpperCase()}`;
  const studentName = `Sprint 8 驗證學生 ${runId}`;
  const updatedName = `${studentName} 更新`;

  await page.goto("/students");
  await expect(page.getByRole("heading", { name: "學生管理" })).toBeVisible();
  await page.getByRole("button", { name: "建立學生" }).click();
  await page.getByLabel("學號").fill(studentNo);
  await page.getByLabel("姓名", { exact: true }).fill(studentName);
  await page.getByLabel("年級").fill("五年級");
  const createResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/students" &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "建立學生", exact: true })
    .last()
    .click();
  const createResponse = await createResponsePromise;
  expect(createResponse.status()).toBe(201);
  const createdPayload = (await createResponse.json()) as {
    student: { id: string };
  };

  await page.getByLabel("搜尋學生").fill(studentNo);
  await expect(page.getByRole("heading", { name: studentName })).toBeVisible();
  const activeCard = page
    .getByRole("heading", { name: studentName })
    .locator("..");
  await activeCard.getByRole("button", { name: "編輯" }).click();
  await page.getByLabel("姓名", { exact: true }).fill(updatedName);
  const updateResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/students/${createdPayload.student.id}` &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "儲存變更" }).click();
  expect((await updateResponsePromise).status()).toBe(200);
  await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();

  const updatedCard = page
    .getByRole("heading", { name: updatedName })
    .locator("..");
  const archiveResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/students/${createdPayload.student.id}` &&
      response.request().method() === "DELETE",
  );
  await updatedCard.getByRole("button", { name: "封存" }).click();
  expect((await archiveResponsePromise).status()).toBe(200);

  await page.getByLabel("狀態").selectOption("archived");
  await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();
  const archivedCard = page
    .getByRole("heading", { name: updatedName })
    .locator("..");
  const restoreResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/students/${createdPayload.student.id}` &&
      response.request().method() === "POST",
  );
  await archivedCard.getByRole("button", { name: "還原" }).click();
  expect((await restoreResponsePromise).status()).toBe(200);
  await page.getByLabel("狀態").selectOption("active");
  await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();
  expect(
    (
      await page
        .context()
        .request.delete(`/api/students/${createdPayload.student.id}`)
    ).status(),
  ).toBe(200);
});

test("authenticated owner verifies the Classes runtime", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(90_000);
  test.skip(
    testInfo.project.name !== "chromium",
    "Run the authenticated page check once.",
  );
  await signIn(page);
  await page.goto("/classes");
  await expect(page.getByRole("heading", { name: "班級管理" })).toBeVisible();
  const createButton = page.getByRole("button", { name: "建立班級" });
  if (process.env.E2E_S8_TEACHER_READY !== "1") {
    await expect(createButton).toBeDisabled();
    await expect(page.getByText("尚無可指派教師")).toBeVisible();
    return;
  }

  await expect(createButton).toBeEnabled();
  const runId = createE2ERunId(testInfo.workerIndex);
  const studentResponse = await page.context().request.post("/api/students", {
    data: {
      gender: "undisclosed",
      grade: "五年級",
      name: `Sprint 8 班級驗證學生 ${runId}`,
      studentNo: `S8C-${runId.toUpperCase()}`,
    },
  });
  expect(studentResponse.status()).toBe(201);
  const studentPayload = (await studentResponse.json()) as {
    student: { id: string };
  };

  const classCode = `S8V-${runId.toUpperCase()}`;
  const className = `Sprint 8 驗證班級 ${runId}`;
  const updatedName = `${className} 更新`;
  let classId: string | null = null;
  let membershipActive = false;

  try {
    await page.reload();
    await page.getByRole("button", { name: "建立班級" }).click();
    await page.getByLabel("班級名稱").fill(className);
    await page.getByLabel("班級代碼").fill(classCode);
    await page.getByLabel("學校").fill("Sprint 8 驗證學校");
    await page.getByLabel("年級").fill("五年級");
    await page.getByLabel("科目").fill("數學");
    const createResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/classes" &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "建立班級", exact: true })
      .last()
      .click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const classPayload = (await createResponse.json()) as {
      class: { id: string };
    };
    classId = classPayload.class.id;

    await page.getByLabel("搜尋班級").fill(classCode);
    await expect(page.getByRole("heading", { name: className })).toBeVisible();
    let classCard = page
      .getByRole("heading", { name: className })
      .locator("..");
    await classCard.getByRole("button", { name: "編輯" }).click();
    await page.getByLabel("班級名稱").fill(updatedName);
    await page.getByLabel("學校").fill("");
    const updateResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/classes/${classId}` &&
        response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "儲存變更" }).click();
    const updateResponse = await updateResponsePromise;
    expect(updateResponse.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: updatedName }),
    ).toBeVisible();
    expect(await updateResponse.json()).toMatchObject({
      class: { school: null },
    });

    classCard = page.getByRole("heading", { name: updatedName }).locator("..");
    await classCard.getByRole("button", { name: "指派學生" }).click();
    await page.getByLabel("學生").selectOption(studentPayload.student.id);
    const assignResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/classes/${classId}/students` &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "確認指派" }).click();
    expect((await assignResponsePromise).status()).toBe(201);
    membershipActive = true;

    const duplicateResponse = await page
      .context()
      .request.post(`/api/classes/${classId}/students`, {
        data: { studentId: studentPayload.student.id },
      });
    expect(duplicateResponse.status()).toBe(409);
    expect(await duplicateResponse.json()).toMatchObject({
      code: "membership_conflict",
    });

    const removeResponse = await page
      .context()
      .request.delete(
        `/api/classes/${classId}/students/${studentPayload.student.id}`,
      );
    expect(removeResponse.status()).toBe(200);
    membershipActive = false;
    const reassignResponse = await page
      .context()
      .request.post(`/api/classes/${classId}/students`, {
        data: { studentId: studentPayload.student.id },
      });
    expect(reassignResponse.status()).toBe(201);
    membershipActive = true;

    const archiveResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/classes/${classId}` &&
        response.request().method() === "DELETE",
    );
    await classCard.getByRole("button", { name: "封存" }).click();
    expect((await archiveResponsePromise).status()).toBe(200);
    await page.getByLabel("狀態").selectOption("archived");
    await expect(
      page.getByRole("heading", { name: updatedName }),
    ).toBeVisible();
    const archivedCard = page
      .getByRole("heading", { name: updatedName })
      .locator("..");
    await expect(
      archivedCard.getByRole("button", { name: "編輯" }),
    ).toHaveCount(0);
    await expect(
      archivedCard.getByRole("button", { name: "指派學生" }),
    ).toHaveCount(0);

    const archivedAssignResponse = await page
      .context()
      .request.post(`/api/classes/${classId}/students`, {
        data: { studentId: studentPayload.student.id },
      });
    expect(archivedAssignResponse.status()).toBe(404);

    const restoreResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/classes/${classId}/restore` &&
        response.request().method() === "POST",
    );
    await archivedCard.getByRole("button", { name: "還原" }).click();
    expect((await restoreResponsePromise).status()).toBe(200);
  } finally {
    if (classId && membershipActive) {
      await page
        .context()
        .request.delete(
          `/api/classes/${classId}/students/${studentPayload.student.id}`,
        );
    }
    if (classId) {
      const classResponse = await page
        .context()
        .request.get(`/api/classes/${classId}`);
      if (classResponse.ok()) {
        const payload = (await classResponse.json()) as {
          class: { status: string };
        };
        if (payload.class.status !== "archived") {
          await page.context().request.delete(`/api/classes/${classId}`);
        }
      }
    }
    await page
      .context()
      .request.delete(`/api/students/${studentPayload.student.id}`);
  }
});
