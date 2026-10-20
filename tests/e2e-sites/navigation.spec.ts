import { test, expect } from "@playwright/test";

test.use({
  extraHTTPHeaders: {
    "oai-authenticated-user-id": "local-teacher",
    "oai-authenticated-user-email": "local@pianopath.test",
    "oai-authenticated-user-full-name": "Developer teacher",
  },
});

for (const route of [
  { path: "/student/repertoire", link: "Repertoire", heading: "Repertoire" },
  { path: "/", link: "Dashboard", heading: "Welcome, Developer" },
]) {
  test(`repeated navigation stays usable on ${route.link}`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible();
    for (let count = 0; count < 2; count++) {
      await page.getByRole("navigation").getByRole("link", { name: route.link, exact: true }).click();
      await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible();
      await expect(page.getByText("Loading PianoPath…", { exact: true })).toHaveCount(0);
    }
    await page.reload();
    await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible();
  });
}
