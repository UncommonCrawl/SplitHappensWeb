import { expect, test, type Page } from "@playwright/test";

async function openSidebarIfNeeded(page: Page) {
  const menu = page.getByRole("button", { name: "Open sidebar menu" });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(page.locator("#sidebar-menu")).toHaveClass(/drawer-open/);
  }
}

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
  await expect(page.locator(".criterion-line")).toHaveCount(3);
  await expect(page.locator(".criterion-line").nth(0)).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(page.locator(".criterion-line").nth(1)).toHaveCSS("visibility", "hidden");
  await expect(page.locator(".criterion-line").nth(2)).toHaveCSS("visibility", "hidden");
  await expect(page.locator(".gold-slot")).toHaveCount(0);
  await expect(page.locator(".app-sidebar")).not.toContainText("Streak");
  await openSidebarIfNeeded(page);
  await page.getByRole("button", { name: "Stats" }).click();
  await expect(page.getByRole("dialog")).toContainText("Daily Stats");
  await expect(page.getByRole("dialog")).toContainText("Current Streak");
  await expect(page.getByRole("dialog")).toContainText("Best:");
  await expect(page.getByRole("dialog")).toContainText("Puzzles Solved");
  await page.getByRole("button", { name: "Close" }).click();
  await openSidebarIfNeeded(page);
  await page.getByRole("button", { name: /How to Play/i }).click();
  const howToPlay = page.getByRole("dialog");
  await expect(howToPlay).toContainText("Rearrange every letter");
  await expect(howToPlay).toContainText("Normal, Hard, and Perfect Split");
  await expect(howToPlay).toContainText("Holy Split");
  await expect(howToPlay).not.toContainText(/bronze|silver|gold/i);
  await page.getByRole("button", { name: "Close" }).click();
  await openSidebarIfNeeded(page);
  await expect(page.getByRole("button", { name: "Prev." })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next" })).toHaveCSS("background-color", "rgba(96, 96, 96, 0.5)");
});

test("shows nine equal recent-puzzle buttons ending with today and navigates by date", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });
  await openSidebarIfNeeded(page);

  const dates = page.locator(".puzzle-date-button");
  await expect(dates).toHaveCount(9);
  await expect(dates.first().locator(".puzzle-date-month")).toHaveText("AUG");
  await expect(dates.first().locator(".puzzle-date-day")).toHaveText("26");
  await expect(dates.last().locator(".puzzle-date-month")).toHaveText("SEP");
  await expect(dates.last().locator(".puzzle-date-day")).toHaveText("3");
  await expect(dates.last()).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(dates.last()).toHaveCSS("border-color", "rgb(0, 0, 0)");
  await expect(dates.last()).toHaveCSS("outline-style", "none");
  await expect(dates.last()).toHaveCSS("box-shadow", /rgb\(0, 0, 0\) 0px 0px 0px 3px inset/);

  const firstBox = await dates.first().boundingBox();
  const lastBox = await dates.last().boundingBox();
  expect(firstBox).not.toBeNull();
  expect(lastBox).not.toBeNull();
  if (!firstBox || !lastBox) return;
  expect(Math.abs(firstBox.width - firstBox.height)).toBeLessThan(1);
  expect(Math.abs(firstBox.width - lastBox.width)).toBeLessThan(1);
  const monthSize = Number.parseFloat(await dates.last().locator(".puzzle-date-month").evaluate((element) => getComputedStyle(element).fontSize));
  const daySize = Number.parseFloat(await dates.last().locator(".puzzle-date-day").evaluate((element) => getComputedStyle(element).fontSize));
  expect(daySize / monthSize).toBeCloseTo(2, 1);

  await dates.first().click();
  await expect(dates.first()).toHaveAttribute("aria-pressed", "true");
  await expect(dates.first()).toHaveCSS("border-color", "rgb(0, 0, 0)");
  await expect(dates.first()).toHaveCSS("box-shadow", /rgb\(0, 0, 0\) 0px 0px 0px 3px inset/);
  await expect(page.locator(".sidebar-brand h1")).toContainText("August 26th");
  await expect(dates.last()).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await openSidebarIfNeeded(page);
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();

  await page.getByRole("button", { name: "Prev." }).click();
  await expect(dates.first().locator(".puzzle-date-day")).toHaveText("17");
  await expect(dates.last().locator(".puzzle-date-day")).toHaveText("25");
  await expect(page.locator(".sidebar-brand h1")).toContainText("August 26th");
  await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(dates.first().locator(".puzzle-date-day")).toHaveText("26");
  await expect(dates.first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".sidebar-brand h1")).toContainText("August 26th");

  const previousPage = page.getByRole("button", { name: "Prev." });
  for (let pageIndex = 0; pageIndex < 20 && await previousPage.isEnabled(); pageIndex += 1) await previousPage.click();
  await expect(previousPage).toBeDisabled();
  await expect(page.locator(".puzzle-date-placeholder")).toHaveCount(2);
  await expect(dates).toHaveCount(7);
  await expect(dates.first()).toHaveAttribute("data-date", "2026-05-01");
  await expect(dates.last()).toHaveAttribute("data-date", "2026-05-07");
  const gridBox = await page.locator(".puzzle-date-grid").boundingBox();
  const oldestLastBox = await dates.last().boundingBox();
  expect(gridBox).not.toBeNull();
  expect(oldestLastBox).not.toBeNull();
  if (gridBox && oldestLastBox) {
    expect(oldestLastBox.x).toBeGreaterThan(gridBox.x + gridBox.width * .6);
    expect(oldestLastBox.y).toBeGreaterThan(gridBox.y + gridBox.height * .6);
  }
  await expect(page.locator(".sidebar-brand h1")).toContainText("August 26th");
});

test("colors recent puzzles by their highest saved tier", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });
  const dates = page.locator(".puzzle-date-button");

  for (const index of [0, 1, 2]) {
    await openSidebarIfNeeded(page);
    await dates.nth(index).click();
    await expect(dates.nth(index)).toHaveAttribute("aria-pressed", "true");
  }
  await page.evaluate(() => {
    const storageKey = "split-happens.web.v2";
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (!saved) throw new Error("Expected saved game progress");
    saved.levels.atlanta.firstSplitAt = "2026-08-26T12:00:00.000Z";
    saved.levels.summits.firstSilverAt = "2026-08-27T12:00:00.000Z";
    saved.levels.doors.firstGoldAt = "2026-08-28T12:00:00.000Z";
    localStorage.setItem(storageKey, JSON.stringify(saved));
  });
  await page.reload();

  await expect(page.locator('[data-date="2026-08-26"]')).toHaveCSS("background-color", "rgb(175, 145, 110)");
  await expect(page.locator('[data-date="2026-08-27"]')).toHaveCSS("background-color", "rgb(209, 209, 209)");
  await expect(page.locator('[data-date="2026-08-28"]')).toHaveCSS("background-color", "rgb(255, 216, 107)");
  await expect(page.locator('[data-date="2026-09-03"]')).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("shows completed progression and distinguishes Perfect Split from Holy Split", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });

  const rowCount = await page.locator(".target-row").count();
  const hint = page.getByRole("button", { name: "Hint" });
  for (let row = 0; row < rowCount; row += 1) await hint.click();

  await expect(page.getByRole("dialog")).toContainText("Perfect Split!");
  await expect(page.locator(".tier-step.complete")).toHaveCount(3);
  await expect(page.locator(".criterion-line.met")).toHaveCount(3);
  await expect(page.locator(".criterion-line.met").first()).toHaveCSS("color", "rgb(119, 119, 119)");
  await expect(page.locator('[data-date="2026-09-03"]')).toHaveCSS("background-color", "rgb(255, 216, 107)");
  await expect(page.locator(".tier-lock")).toHaveCount(0);
  const perfectStep = page.locator(".tier-step").filter({ hasText: "Perfect Split" });
  await expect(perfectStep).toHaveClass(/active/);
  await expect(perfectStep).toHaveAttribute("aria-current", "step");
  await expect(page.locator(".tier-objective")).toContainText(/Highlighted tiles spell .* in order/i);
  await expect(page.locator(".gold-slot")).toHaveCount(await page.locator(".gold-word em").count());

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
  await openSidebarIfNeeded(page);
  await page.getByRole("button", { name: "Stats" }).click();
  await expect(page.locator(".stat-row").filter({ hasText: "Holy Splits" })).toBeVisible();
});

test("keeps criteria unlocked while their live completion borders update", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });
  const lockedHeight = (await page.locator(".tier-objective").boundingBox())?.height;

  await page.evaluate(() => {
    const storageKey = "split-happens.web.v2";
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (!saved) throw new Error("Expected saved game progress");
    const current = Object.values(saved.levels)[0] as any;
    current.firstSplitAt = "2026-09-03T12:00:00.000Z";
    current.firstSilverAt = "2026-09-03T12:01:00.000Z";
    localStorage.setItem(storageKey, JSON.stringify(saved));
  });
  await page.reload();

  const steps = page.locator(".tier-step");
  await expect(steps.filter({ has: page.locator(".seal-outline") })).toHaveCount(0);
  await expect(page.locator(".seal-check")).toHaveCount(2);
  await expect(steps.nth(0)).toHaveClass(/unlocked/);
  await expect(steps.nth(1)).toHaveClass(/unlocked/);
  await expect(steps.nth(2)).toHaveClass(/unlocked/);
  await expect(page.locator(".tier-lock")).toHaveCount(0);
  await expect(steps.nth(2)).toHaveClass(/active/);
  await expect(page.locator(".tier-objective")).toContainText(/Highlighted tiles spell .* in order/i);
  await expect(page.locator(".criterion-line").nth(0)).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(page.locator(".criterion-line").nth(1)).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(page.locator(".criterion-line").nth(2)).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(page.locator(".criterion-line.locked")).toHaveCount(0);
  expect((await page.locator(".tier-objective").boundingBox())?.height).toBeCloseTo(lockedHeight ?? 0, 0);
  await expect(page.locator(".gold-slot")).not.toHaveCount(0);
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

test("moves a selected target tile into a clicked empty source slot", async ({ page }) => {
  await page.goto("/");
  const source = page.locator(".letter-tile").first();
  const sourceRow = await source.getAttribute("data-source-row");
  const sourceColumn = await source.getAttribute("data-source-column");
  const targetID = await page.locator(".target-slot.empty").first().getAttribute("data-slot-id");
  expect(sourceRow).toBeTruthy();
  expect(sourceColumn).toBeTruthy();
  expect(targetID).toBeTruthy();
  if (!sourceRow || !sourceColumn || !targetID) return;
  const target = page.locator(`[data-slot-id="${targetID}"]`);

  await source.click();
  await target.click();
  await expect(target).not.toHaveAccessibleName(/empty$/);

  await target.click();
  await expect(target).toHaveClass(/selected/);
  await page.locator(`[data-source-row="${sourceRow}"][data-source-column="${sourceColumn}"]`).click();

  await expect(target).toHaveAccessibleName(/empty$/);
  await expect(page.locator(`[data-source-row="${sourceRow}"][data-source-column="${sourceColumn}"]`)).toHaveClass(/letter-tile/);
});

test("places a typed source letter into a selected target slot", async ({ page }) => {
  await page.goto("/");
  const source = page.locator(".letter-tile").first();
  const sourceLabel = await source.getAttribute("aria-label");
  const sourceRow = await source.getAttribute("data-source-row");
  const sourceColumn = await source.getAttribute("data-source-column");
  const targetID = await page.locator(".target-slot.empty").first().getAttribute("data-slot-id");
  expect(sourceRow).toBeTruthy();
  expect(sourceColumn).toBeTruthy();
  expect(targetID).toBeTruthy();
  const letter = sourceLabel?.replace("Letter ", "");
  expect(letter).toMatch(/^[A-Z]$/);
  if (!letter || !sourceRow || !sourceColumn || !targetID) return;
  const target = page.locator(`[data-slot-id="${targetID}"]`);

  await target.click();
  await page.keyboard.press(letter.toLowerCase());

  await expect(target).toHaveAccessibleName(new RegExp(`letter ${letter}`, "i"));
  await expect(page.locator(`[data-source-row="${sourceRow}"][data-source-column="${sourceColumn}"]`)).toHaveClass(/source-hole/);
});

test("places a typed source letter into the first empty target slot when idle", async ({ page }) => {
  await page.goto("/");
  const source = page.locator(".letter-tile").first();
  const sourceLabel = await source.getAttribute("aria-label");
  const sourceRow = await source.getAttribute("data-source-row");
  const sourceColumn = await source.getAttribute("data-source-column");
  const targetID = await page.locator(".target-slot.empty").first().getAttribute("data-slot-id");
  const letter = sourceLabel?.replace("Letter ", "");
  expect(letter).toMatch(/^[A-Z]$/);
  expect(sourceRow).toBeTruthy();
  expect(sourceColumn).toBeTruthy();
  expect(targetID).toBeTruthy();
  if (!letter || !sourceRow || !sourceColumn || !targetID) return;

  await page.keyboard.press(letter.toLowerCase());

  await expect(page.locator(`[data-slot-id="${targetID}"]`)).toHaveAccessibleName(new RegExp(`letter ${letter}`, "i"));
  await expect(page.locator(`[data-source-row="${sourceRow}"][data-source-column="${sourceColumn}"]`)).toHaveClass(/source-hole/);
});

test("uses Backspace to clear source selection and return target tiles", async ({ page }) => {
  await page.goto("/");
  const source = page.locator(".letter-tile").first();
  const sourceRow = await source.getAttribute("data-source-row");
  const sourceColumn = await source.getAttribute("data-source-column");
  const targetID = await page.locator(".target-slot.empty").first().getAttribute("data-slot-id");
  expect(sourceRow).toBeTruthy();
  expect(sourceColumn).toBeTruthy();
  expect(targetID).toBeTruthy();
  if (!sourceRow || !sourceColumn || !targetID) return;
  const sourceSlot = page.locator(`[data-source-row="${sourceRow}"][data-source-column="${sourceColumn}"]`);
  const target = page.locator(`[data-slot-id="${targetID}"]`);

  await source.click();
  await expect(source).toHaveClass(/selected/);
  await page.keyboard.press("Backspace");
  await expect(source).not.toHaveClass(/selected/);

  await sourceSlot.click();
  await target.click();
  await target.click();
  await expect(target).toHaveClass(/selected/);
  await page.keyboard.press("Backspace");
  await expect(target).toHaveAccessibleName(/empty$/);

  await sourceSlot.click();
  await target.click();
  await page.keyboard.press("Backspace");
  await expect(target).toHaveAccessibleName(/empty$/);
});

test("uses a target letter after the source board is empty", async ({ page }) => {
  await page.goto("/");
  const sourceTiles = page.locator(".letter-tile");
  const emptyTargets = page.locator(".target-slot.empty");
  await expect(sourceTiles.first()).toBeVisible();
  while (await sourceTiles.count()) {
    await sourceTiles.first().click();
    await emptyTargets.first().click();
  }

  const targets = page.locator(".target-slot");
  const donor = targets.nth(0);
  const destination = targets.nth(1);
  const donorLetter = (await donor.getAttribute("aria-label"))?.match(/letter ([A-Z])/i)?.[1];
  const displacedLetter = (await destination.getAttribute("aria-label"))?.match(/letter ([A-Z])/i)?.[1];
  expect(donorLetter).toBeTruthy();
  expect(displacedLetter).toBeTruthy();
  if (!donorLetter || !displacedLetter) return;

  await destination.click();
  await page.keyboard.press(donorLetter.toLowerCase());

  await expect(destination).toHaveAccessibleName(new RegExp(`letter ${donorLetter}`, "i"));
  await expect(page.locator('[data-source-row="0"][data-source-column="0"]')).toHaveAttribute("aria-label", `Letter ${displacedLetter}`);
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

test("clears another letter's selection when a tile is dragged", async ({ page }) => {
  await page.goto("/");
  const selected = page.locator(".letter-tile").first();
  const dragged = page.locator(".letter-tile").nth(1);
  const draggedBox = await dragged.boundingBox();
  expect(draggedBox).not.toBeNull();
  if (!draggedBox) return;

  await selected.click();
  await expect(selected).toHaveClass(/selected/);
  await page.mouse.move(draggedBox.x + draggedBox.width / 2, draggedBox.y + draggedBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(draggedBox.x + draggedBox.width / 2 + 8, draggedBox.y + draggedBox.height / 2);

  await expect(selected).not.toHaveClass(/selected/);
  await page.mouse.up();
});

test("keeps a selected tile visible in its drag preview", async ({ page }) => {
  await page.goto("/");
  const tile = page.locator(".letter-tile").first();
  const tileBox = await tile.boundingBox();
  expect(tileBox).not.toBeNull();
  if (!tileBox) return;

  await tile.click();
  await expect(tile).toHaveClass(/selected/);
  await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(tileBox.x + tileBox.width / 2 + 8, tileBox.y + tileBox.height / 2);

  const preview = page.locator(".drag-tile");
  await expect(tile).not.toHaveClass(/selected/);
  await expect(preview).toBeVisible();
  await expect(preview).not.toHaveClass(/selected/);
  await expect(preview.locator(".tile-letter")).toHaveCSS("opacity", "1");
  await page.mouse.up();
});

test("does not reselect a tile's old slot after dragging it", async ({ page }) => {
  await page.goto("/");
  const source = page.locator(".letter-tile").first();
  const oldSlot = page.locator(".target-slot").first();
  const newSlot = page.locator(".target-slot").nth(1);
  await source.click();
  await oldSlot.click();
  await oldSlot.click();
  await expect(oldSlot).toHaveClass(/selected/);

  const oldBox = await oldSlot.boundingBox();
  const newBox = await newSlot.boundingBox();
  expect(oldBox).not.toBeNull();
  expect(newBox).not.toBeNull();
  if (!oldBox || !newBox) return;

  await page.mouse.move(oldBox.x + oldBox.width / 2, oldBox.y + oldBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(newBox.x + newBox.width / 2, newBox.y + newBox.height / 2);
  await page.mouse.up();

  await expect(oldSlot).not.toHaveClass(/selected/);
  await expect(newSlot).not.toHaveClass(/selected/);
  await expect(page.locator(".target-slot.selected")).toHaveCount(0);
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
  await page.locator('[data-date="2026-09-02"]').click();
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

test("uses an accessible sidebar drawer at constrained widths", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });

  const header = page.locator(".mobile-header");
  const menu = page.getByRole("button", { name: "Open sidebar menu" });
  const drawer = page.locator("#sidebar-menu");
  await expect(header).toBeVisible();
  await expect(page.locator(".workspace")).toHaveCSS("padding-bottom", "16px");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");

  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(drawer).toHaveAttribute("aria-modal", "true");
  await expect(drawer).toHaveClass(/drawer-open/);
  await expect(page.getByRole("button", { name: "Close sidebar menu" }).last()).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
  await expect(menu).toBeFocused();

  await menu.click();
  await page.locator(".drawer-backdrop").click({ position: { x: 900, y: 700 } });
  await expect(menu).toBeFocused();

  await menu.click();
  await page.locator('[data-date="2026-08-26"]').click();
  await expect(header.locator("h1")).toContainText("August 26th");
  await expect(menu).toHaveAttribute("aria-expanded", "false");

  await page.setViewportSize({ width: 500, height: 718 });
  await openSidebarIfNeeded(page);
  await page.locator('[data-date="2026-09-03"]').click();
  const toolbarBox = await page.locator(".game-toolbar").boundingBox();
  expect(toolbarBox).not.toBeNull();
  if (toolbarBox) expect(718 - (toolbarBox.y + toolbarBox.height)).toBeGreaterThanOrEqual(4);
});

test("reserves a fifth target row and keeps four- and five-row tile sizes consistent", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".game-toolbar")).toHaveCSS("margin-bottom", "0px");

  await page.locator('[data-date="2026-08-26"]').click();
  await expect(page.locator(".target-row")).toHaveCount(4);
  const fourRowBoard = await page.locator(".target-board").boundingBox();
  const fourRowTile = await page.locator(".target-slot").first().boundingBox();
  expect(fourRowBoard).not.toBeNull();
  expect(fourRowTile).not.toBeNull();
  if (!fourRowBoard || !fourRowTile) return;

  await page.locator('[data-date="2026-08-28"]').click();
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

test("sizes each row divider to the shorter adjacent word", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-date="2026-08-26"]').click();

  const rows = page.locator(".target-row");
  await expect(rows).toHaveCount(4);
  for (let index = 0; index < await rows.count() - 1; index += 1) {
    const rowLength = await rows.nth(index).locator(".target-slot").count();
    const nextRowLength = await rows.nth(index + 1).locator(".target-slot").count();
    const dividerSlots = Math.min(rowLength, nextRowLength);
    await expect(rows.nth(index)).toHaveAttribute("data-divider-slots", String(dividerSlots));

    const dividerWidth = await rows.nth(index).evaluate((row) =>
      Number.parseFloat(getComputedStyle(row, "::after").width),
    );
    const slotWidth = await rows.nth(index).locator(".target-slot").first().evaluate((slot) =>
      slot.getBoundingClientRect().width,
    );
    expect(dividerWidth).toBeCloseTo(slotWidth * dividerSlots + 6 * (dividerSlots - 1), 1);
  }
  await expect(rows.last()).not.toHaveAttribute("data-divider-slots", /.+/);
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

    const usesPermanentSidebar = viewport.width > 1050;
    if (usesPermanentSidebar) {
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
      await expect(page.locator(".mobile-header")).toBeVisible();
      await expect(page.getByRole("button", { name: "Open sidebar menu" })).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator("#sidebar-menu")).toHaveAttribute("aria-hidden", "true");
      expect(rail.x + rail.width).toBeLessThanOrEqual(1);
    }
  });
}
