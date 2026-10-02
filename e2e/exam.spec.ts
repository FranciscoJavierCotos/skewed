import { expect, test } from "./fixture-api";

test("exam: shortfall notice, no mid-exam feedback, review at end", async ({ page }) => {
  await page.goto("/play/exam?topics=sql&level=2&length=10");
  await expect(page.getByText(/only 2 questions available/i)).toBeVisible();
  await page.getByRole("button", { name: /^Option/ }).filter({ hasText: "right-" }).click();
  await expect(page.getByText("Question 2 of 2")).toBeVisible();
  await expect(page.getByText(/Explanation right/)).toHaveCount(0);
  await page.getByRole("button", { name: /^Option/ }).filter({ hasText: "nope-" }).first().click();
  await expect(page.getByText(/1 \/ 2 \(50%\)/)).toBeVisible();
  await expect(page.getByText(/Explanation right/)).toHaveCount(2);
});

test("exam: setup flow from /play", async ({ page }) => {
  await page.goto("/play");
  await page.getByText("Exam", { exact: true }).click();
  await page.getByRole("checkbox", { name: "spark" }).uncheck();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/play\/exam\?topics=sql/);
  await expect(page.getByText(/only 8 questions available/i)).toBeVisible();
});
