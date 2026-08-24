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

const layoutViewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
];

for (const viewport of layoutViewports) {
  test(`fits the full six-row game at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /View Archive/i }).click();
    await page.getByRole("button", { name: /DENZEL/i }).click();
    await expect(page.locator(".target-row")).toHaveCount(6);
    await page.evaluate(() => window.scrollTo(0, 0));

    const game = await page.locator(".game-area").boundingBox();
    const rail = await page.locator(".progress-rail").boundingBox();
    const target = await page.locator(".target-board").boundingBox();
    const source = await page.locator(".source-board").boundingBox();
    const toolbar = await page.locator(".game-toolbar").boundingBox();
    const targetTile = await page.locator(".target-slot").first().boundingBox();
    const sourceTile = await page.locator(".letter-tile").first().boundingBox();

    expect(game).not.toBeNull();
    expect(rail).not.toBeNull();
    expect(target).not.toBeNull();
    expect(source).not.toBeNull();
    expect(toolbar).not.toBeNull();
    expect(targetTile).not.toBeNull();
    expect(sourceTile).not.toBeNull();
    if (!game || !rail || !target || !source || !toolbar || !targetTile || !sourceTile) return;

    expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(target.x).toBeGreaterThanOrEqual(game.x - 1);
    expect(target.x + target.width).toBeLessThanOrEqual(game.x + game.width + 1);
    expect(source.x).toBeGreaterThanOrEqual(game.x - 1);
    expect(source.x + source.width).toBeLessThanOrEqual(game.x + game.width + 1);
    expect(targetTile.width).toBeGreaterThanOrEqual(32);
    expect(sourceTile.width).toBeGreaterThanOrEqual(24);

    if (viewport.width >= 900) {
      expect(rail.x + rail.width).toBeLessThanOrEqual(game.x);
    } else {
      expect(rail.y).toBeGreaterThanOrEqual(game.y + game.height);
    }
  });
}
