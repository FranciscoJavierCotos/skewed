import { expect, test } from "./fixture-api";

test("survival: stays at level 1, wrong answer ends run", async ({ page }) => {
  await page.goto("/play/survival?topics=sql&level=1");
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: /^Option/ }).filter({ hasText: "right-" }).click();
    await page.getByRole("button", { name: /next question/i }).click();
  }
  await expect(page.getByText("Level 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Option/ }).filter({ hasText: "nope-" }).first().click();
  await expect(page.getByText("Game over")).toBeVisible();
  await expect(page.getByText(/Streak: 5/)).toBeVisible();
  await expect(page.getByText(/new personal best/i)).toBeVisible();
});

test("survival: clearing a level offers a new run one level up", async ({ page }) => {
  await page.goto("/play/survival?topics=sql&level=2"); // the fixture bank has 2 level-2 questions
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: /^Option/ }).filter({ hasText: "right-" }).click();
    await page.getByRole("button", { name: /next question/i }).click();
  }
  await expect(page.getByText("Level 2 cleared!")).toBeVisible();
  await page.getByRole("link", { name: "Go to level 3" }).click();
  await expect(page).toHaveURL(/\/play\/survival\?topics=sql&level=3/);
});
