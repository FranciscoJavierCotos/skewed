import { expect, test } from "./fixture-api";

test("practice: answer shows explanations for all options", async ({ page }) => {
  await page.goto("/play/practice?topics=sql&level=1");
  await expect(page.getByRole("heading", { name: /Fixture sql-l1-/ })).toBeVisible();
  await page.getByRole("button", { name: /^Option/ }).filter({ hasText: "right-" }).click();
  await expect(page.getByText("Correct!")).toBeVisible();
  await expect(page.getByText(/Explanation nope 3/)).toBeVisible();
  await page.getByRole("button", { name: /next question/i }).click();
  await expect(page.getByRole("heading", { name: /Fixture sql-l1-/ })).toBeVisible();
});
