import { expect, test } from "@playwright/test";

test("loads the daily game and opens core dialogs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "Split Happens" })).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible({ timeout: 15_000 });
  const steps = page.locator(".tier-step");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText("Normal");
  await expect(steps.nth(0)).toHaveAttribute("aria-current", "step");
  await expect(steps.nth(0)).toHaveClass(/tier-bronze/);
  await expect(steps.nth(1)).toHaveClass(/future/);
  await expect(steps.nth(1)).toContainText("Hard");
  await expect(steps.nth(2)).toHaveClass(/future/);
  await expect(steps.nth(2)).toContainText("Perfect Split");
  await expect(page.locator(".tier-lock")).toHaveCount(2);
  await expect(page.locator(".tier-objective")).toContainText("REARRANGE ALL LETTERS INTO VALID ENGLISH WORDS");
  await page.getByRole("button", { name: /How to Play/i }).click();
  const howToPlay = page.getByRole("dialog");
  await expect(howToPlay).toContainText("Rearrange every letter");
  await expect(howToPlay).toContainText("Normal, Hard, and Perfect Split");
  await expect(howToPlay).toContainText("Holy Split");
  await expect(howToPlay).not.toContainText(/bronze|silver|gold/i);
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: /View Archive/i }).click();
  await expect(page.getByRole("dialog")).toContainText("Puzzle Archive");
});

test("shows completed progression and distinguishes Perfect Split from Holy Split", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });

  const rowCount = await page.locator(".target-row").count();
  const hint = page.getByRole("button", { name: "Hint" });
  for (let row = 0; row < rowCount; row += 1) await hint.click();

  await expect(page.getByRole("dialog")).toContainText("Perfect Split!");
  await expect(page.locator(".tier-step.complete")).toHaveCount(3);
  await expect(page.locator(".tier-lock")).toHaveCount(0);
  const perfectStep = page.locator(".tier-step").filter({ hasText: "Perfect Split" });
  await expect(perfectStep).toHaveClass(/active/);
  await expect(perfectStep).toHaveAttribute("aria-current", "step");
  await expect(page.locator(".tier-objective")).toContainText(/Highlighted tiles spell .* in order/i);

  await page.getByRole("button", { name: "Close" }).click();
  await page.evaluate(() => {
    const storageKey = "split-happens.web.v2";
    const raw = localStorage.getItem(storageKey);
    if (!raw) throw new Error("Expected saved game progress");
    const saved = JSON.parse(raw);
    const completed = Object.values(saved.levels).find((level: any) => level.firstGoldAt);
    if (!completed) throw new Error("Expected completed level progress");
    completed.hintedRows = [];
    completed.firstGoldAt = null;
    completed.perfectSplit = false;
    localStorage.setItem(storageKey, JSON.stringify(saved));
  });
  await page.reload();

  await expect(page.getByRole("dialog")).toContainText("Holy Split!");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".stat-row").filter({ hasText: "Holy Splits" })).toBeVisible();
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

test("uses target-tile sizing and preserves the proportional grab offset while dragging", async ({ page }) => {
  await page.goto("/");
  const source = page.locator(".letter-tile").first();
  const target = page.locator(".target-slot").first();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  const targetFontSize = await target.evaluate((element) => getComputedStyle(element).fontSize);
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!sourceBox || !targetBox) return;

  const grabX = sourceBox.x + sourceBox.width * .25;
  const grabY = sourceBox.y + sourceBox.height * .75;
  await page.mouse.move(grabX, grabY);
  await page.mouse.down();
  await page.mouse.move(grabX + 20, grabY + 15);

  const draggedBox = await page.locator(".drag-tile").boundingBox();
  expect(draggedBox).not.toBeNull();
  if (!draggedBox) return;
  expect(draggedBox.width).toBeCloseTo(targetBox.width, 0);
  expect(draggedBox.height).toBeCloseTo(targetBox.height, 0);
  expect(draggedBox.x).toBeCloseTo(grabX + 20 - targetBox.width * .25, 0);
  expect(draggedBox.y).toBeCloseTo(grabY + 15 - targetBox.height * .75, 0);
  await expect(page.locator(".drag-tile")).toHaveCSS("font-size", targetFontSize);
  await expect(page.locator(".drag-tile")).toHaveCSS("opacity", "0.5");

  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  await expect(target).toHaveClass(/drop-hover/);
  await page.mouse.up();
  await expect(target).not.toHaveAccessibleName(/empty$/);
});

test("returns a target tile to the first free source slot regardless of where it lands", async ({ page }) => {
  await page.goto("/");
  const sourceAt = (column: number) => page.locator(`[data-source-row="0"][data-source-column="${column}"]`);
  const targets = page.locator(".target-slot");
  const returningTileLabel = await sourceAt(1).getAttribute("aria-label");
  expect(returningTileLabel).not.toBeNull();

  await sourceAt(1).click();
  await targets.nth(0).click();
  await sourceAt(0).click();
  await targets.nth(1).click();

  const placedTileBox = await targets.nth(0).boundingBox();
  const occupiedSourceBox = await sourceAt(2).boundingBox();
  expect(placedTileBox).not.toBeNull();
  expect(occupiedSourceBox).not.toBeNull();
  if (!placedTileBox || !occupiedSourceBox || !returningTileLabel) return;

  await page.mouse.move(placedTileBox.x + placedTileBox.width / 2, placedTileBox.y + placedTileBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(occupiedSourceBox.x + occupiedSourceBox.width / 2, occupiedSourceBox.y + occupiedSourceBox.height / 2);
  await page.mouse.up();

  await expect(sourceAt(0)).toHaveAttribute("aria-label", returningTileLabel);
  await expect(sourceAt(1)).toHaveClass(/source-hole/);
  await expect(targets.nth(0)).toHaveAccessibleName(/empty$/);
});

test("fits the daily game within the reported short desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1207, height: 744 });
  await page.goto("/");
  const game = page.locator(".game-area");
  await expect(game).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".target-row")).toHaveCount(5);
  const criteria = await page.locator(".criteria").boundingBox();
  const target = await page.locator(".target-board").boundingBox();
  const source = await page.locator(".source-board").boundingBox();
  const toolbar = await page.locator(".game-toolbar").boundingBox();
  const gameBox = await game.boundingBox();
  const overflow = await game.evaluate((element) => element.scrollHeight - element.clientHeight);
  expect(criteria).not.toBeNull();
  expect(target).not.toBeNull();
  expect(source).not.toBeNull();
  expect(toolbar).not.toBeNull();
  expect(gameBox).not.toBeNull();
  if (!criteria || !target || !source || !toolbar || !gameBox) return;
  expect(criteria.y + criteria.height).toBeLessThanOrEqual(target.y + 1);
  expect(target.y + target.height).toBeLessThanOrEqual(source.y + 1);
  expect(source.y + source.height).toBeLessThanOrEqual(toolbar.y + 1);
  expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(744 + 1);
  expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(gameBox.y + gameBox.height + 1);
  expect(overflow).toBeLessThanOrEqual(1);
});

const layoutViewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1207, height: 600 },
  { width: 1024, height: 500 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
];

test("reserves a fifth target row and keeps four- and five-row tile sizes consistent", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /View Archive/i }).click();
  await page.getByRole("button", { name: /COFFEE/i }).click();
  await expect(page.locator(".target-row")).toHaveCount(4);
  const fourRowBoard = await page.locator(".target-board").boundingBox();
  const fourRowTile = await page.locator(".target-slot").first().boundingBox();
  expect(fourRowBoard).not.toBeNull();
  expect(fourRowTile).not.toBeNull();
  if (!fourRowBoard || !fourRowTile) return;

  await page.getByRole("button", { name: /View Archive/i }).click();
  await page.getByRole("button", { name: /CATS/i }).click();
  await expect(page.locator(".target-row")).toHaveCount(5);
  const fiveRowBoard = await page.locator(".target-board").boundingBox();
  const fiveRowTile = await page.locator(".target-slot").first().boundingBox();
  expect(fiveRowBoard).not.toBeNull();
  expect(fiveRowTile).not.toBeNull();
  if (fiveRowBoard && fiveRowTile) {
    expect(Math.abs(fourRowBoard.height - fiveRowBoard.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(fourRowTile.width - fiveRowTile.width)).toBeLessThanOrEqual(1);
  }
});

test("lets game controls shrink below their preferred sizes for a tiny window", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 360 });
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });

  const game = page.locator(".game-area");
  const gameBox = await game.boundingBox();
  const sealBox = await page.locator(".seal").first().boundingBox();
  const targetTileBox = await page.locator(".target-slot").first().boundingBox();
  const sourceTileBox = await page.locator(".letter-tile").first().boundingBox();
  const toolbarButtonBox = await page.locator(".game-toolbar button").first().boundingBox();
  const toolbarBox = await page.locator(".game-toolbar").boundingBox();
  const overflow = await game.evaluate((element) => element.scrollHeight - element.clientHeight);

  expect(gameBox).not.toBeNull();
  expect(sealBox?.width).toBeLessThan(68);
  expect(targetTileBox?.width).toBeLessThan(68);
  expect(sourceTileBox?.width).toBeLessThan(58);
  expect(toolbarButtonBox?.width).toBeLessThan(52);
  expect(overflow).toBeLessThanOrEqual(1);
  if (gameBox && toolbarBox) expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(gameBox.y + gameBox.height + 1);
});

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
    const gameOverflow = await page.locator(".game-area").evaluate((element) => element.scrollHeight - element.clientHeight);

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
    expect(targetTile.width).toBeGreaterThan(0);
    expect(targetTile.width).toBeLessThanOrEqual(70);
    expect(sourceTile.width).toBeGreaterThan(0);
    expect(sourceTile.width).toBeLessThanOrEqual(60);
    expect(gameOverflow).toBeLessThanOrEqual(1);

    const usesDesktopLayout = await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches);
    if (usesDesktopLayout) {
      expect(rail.x + rail.width).toBeLessThanOrEqual(game.x);
      const documentOverflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      const sidebar = page.locator(".app-sidebar");
      const sidebarBox = await sidebar.boundingBox();
      const sidebarOverflow = await sidebar.evaluate((element) => element.scrollHeight - element.clientHeight);
      expect(sidebarBox).not.toBeNull();
      if (sidebarBox) expect(sidebarBox.y + sidebarBox.height).toBeLessThanOrEqual(viewport.height + 1);
      expect(sidebarOverflow).toBeLessThanOrEqual(0);
      expect(documentOverflow).toBeLessThanOrEqual(0);
    } else {
      expect(rail.y).toBeGreaterThanOrEqual(game.y + game.height);
    }
  });
}
