import { test, expect } from "@playwright/test";
const password = process.env.FIXTURE_PASSWORD;
test("teacher records and publishes, student enrolls and completes, teacher sees completion", async ({
  browser,
}) => {
  test.skip(!password, "Set FIXTURE_PASSWORD and run db:seed before this test");
  const teacher = await browser.newContext(),
    page = await teacher.newPage();
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("teacher@pianopath.test");
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/student/home");
  await page.goto("/teacher/courses");
  await page.getByLabel("New course title").fill("Developer E2E Course");
  await page
    .getByRole("button", { name: "Create course", exact: true })
    .click();
  await page.waitForURL("**/teacher/courses/*");
  const courseId = page.url().split("/").at(-1)!;
  await page.getByRole("button", { name: "Add module", exact: true }).click();
  await page.getByLabel("Module title").fill("Developer E2E Module");
  await page.getByRole("button", { name: "Add lesson", exact: true }).click();
  await page.getByLabel("Lesson title").fill("Developer E2E Lesson");
  await page.getByRole("button", { name: "Add block", exact: true }).click();
  await page
    .getByLabel("Text", { exact: true })
    .fill("Technical developer fixture.");
  await page.getByLabel("Block type").selectOption("MIDI_EXERCISE");
  await page.getByRole("button", { name: "Add block", exact: true }).click();
  await page.getByText("Record a new example", { exact: true }).click();
  await page.getByRole("button", { name: "Record", exact: true }).click();
  const key = page.getByRole("button", { name: "Play C4", exact: true });
  await key.focus();
  await page.keyboard.down("Space");
  await page.waitForTimeout(250);
  await page.keyboard.up("Space");
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save recording to block", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Recording", exact: true }),
  ).not.toHaveValue("");
  await page
    .getByRole("button", { name: "Preview as student", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Developer E2E Lesson" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  await page
    .getByText("Course details, access and rights", { exact: true })
    .click();
  await page.getByRole("combobox", { name: "Visibility", exact: true }).selectOption("PUBLIC");
  await page.getByLabel("Rights declaration").selectOption("ORIGINAL");
  await page.getByLabel("Rights owner", { exact: true }).fill("Developer test");
  await page
    .getByRole("button", { name: "Publish course", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Create next draft" }),
  ).toBeVisible();
  const student = await browser.newContext(),
    learner = await student.newPage();
  await learner.goto("/login");
  await learner
    .getByLabel("Email", { exact: true })
    .fill("student@pianopath.test");
  await learner.getByLabel("Password", { exact: true }).fill(password!);
  await learner.getByRole("button", { name: "Sign in", exact: true }).click();
  await learner.waitForURL("**/student/home");
  await learner.goto(`/courses/${courseId}`);
  await learner
    .getByRole("button", { name: "Enroll in course", exact: true })
    .click();
  await learner.waitForURL("**/student/learn");
  await learner
    .getByRole("heading", { name: "Developer E2E Course" })
    .locator("..")
    .getByRole("link", { name: "Open course" })
    .click();
  await learner.getByRole("link", { name: "Developer E2E Lesson" }).click();
  await learner
    .getByRole("button", { name: "Start attempt", exact: true })
    .click();
  await learner.getByRole("button", { name: "Play C4", exact: true }).focus();
  await learner.keyboard.down("Space");
  await learner.waitForTimeout(250);
  await learner.keyboard.up("Space");
  await learner
    .getByRole("button", { name: "Finish attempt", exact: true })
    .click();
  await expect(
    learner.getByText("100% · Passed", { exact: true }),
  ).toBeVisible();
  await learner
    .getByRole("button", { name: "Complete lesson", exact: true })
    .click();
  await expect(
    learner.getByText("Lesson complete. Your progress is saved."),
  ).toBeVisible();
  await learner.goto("/teacher/dashboard");
  await expect(learner).toHaveURL(/student\/home/);
  await learner.goto("/admin/users");
  await expect(learner).toHaveURL(/student\/home/);
  await page.goto("/teacher/analytics");
  await expect(
    page.getByRole("cell", { name: "Developer student", exact: true }).first(),
  ).toBeVisible();
  await teacher.close();
  await student.close();
});
