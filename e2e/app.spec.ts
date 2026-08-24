import { expect, test } from "@playwright/test";

test("loads the daily game and opens core dialogs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "Split Happens" })).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /How to Play/i }).click();
  await expect(page.getByRole("dialog")).toContainText("Rearrange every letter");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: /View Archive/i }).click();
  await expect(page.getByRole("dialog")).toContainText("Puzzle Archive");
});

test("supports keyboard-style select then place", async ({ page }) => {
  await page.goto("/");
  const tile = page.getByRole("button", { name: /^Letter / }).first();
  await tile.focus();
  await page.keyboard.press("Enter");
  const slot = page.getByRole("button", { name: /Row 1, position 1/ });
  await slot.focus();
  await page.keyboard.press("Enter");
  await expect(slot).not.toHaveAccessibleName(/empty$/);
});
