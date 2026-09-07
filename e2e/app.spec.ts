import { expect, test, type Page } from "@playwright/test";

async function openSidebarIfNeeded(page: Page) {
  const menu = page.getByRole("button", { name: "Open sidebar menu" });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(page.locator("#sidebar-menu")).toHaveClass(/drawer-open/);
  }
}

async function setCurrentBadges(page: Page, perfectSplit: boolean, licketySplit: boolean) {
  await page.evaluate(({ perfectSplit, licketySplit }) => {
    const storageKey = "split-happens.web.v2";
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (!saved) throw new Error("Expected saved game progress");
    const current = Object.values(saved.levels)[0] as any;
    if (!current) throw new Error("Expected current level progress");
    current.perfectSplit = perfectSplit;
    current.licketySplit = licketySplit;
    localStorage.setItem(storageKey, JSON.stringify(saved));
  }, { perfectSplit, licketySplit });
  await page.reload();
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });
}

test("renders the app behind a game-area loader while the dictionary loads", async ({ page }) => {
  await page.route("**/words.json", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await route.continue();
  });

  await page.goto("/");
  await expect(page.locator(".app-sidebar")).toHaveCSS("background-color", "rgb(255, 216, 107)");
  await expect(page.locator(".game-area")).toBeAttached();
  await expect(page.locator(".game-loading-overlay")).toBeVisible();
  await expect(page.locator(".sidebar-brand")).toBeHidden();
  await expect(page.locator(".game-loading-overlay")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".game-loading-overlay")).toBeHidden({ timeout: 5_000 });
  await expect(page.locator(".sidebar-brand")).toBeVisible();
});

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
  await expect(page.locator(".tier-connector").first()).toHaveCSS("height", "2px");
  await expect(page.locator(".tier-connector").first()).toHaveCSS("background-color", "rgb(222, 222, 222)");
  const sealBox = await page.locator(".seal").first().boundingBox();
  const connectorBox = await page.locator(".tier-connector").first().boundingBox();
  expect(sealBox).not.toBeNull();
  expect(connectorBox).not.toBeNull();
  expect((connectorBox?.y ?? 0) + (connectorBox?.height ?? 0) / 2)
    .toBeCloseTo((sealBox?.y ?? 0) + (sealBox?.height ?? 0) / 2, 1);
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
  await expect(page.getByRole("dialog")).not.toContainText("Streaks");
  await expect(page.getByRole("dialog")).not.toContainText("Best:");
  await expect(page.getByRole("dialog")).toContainText("Progress");
  await expect(page.getByRole("dialog")).toContainText("Hard or Higher");
  await expect(page.locator(".stats-progress-bar span")).toHaveCount(4);
  await expect(page.locator(".stats-progress-bar")).toHaveCSS("overflow", "hidden");
  await expect(page.locator(".stats-progress-bar span").first()).toHaveCSS("border-radius", "0px");
  await page.getByRole("button", { name: "Close" }).click();
  const headerHelp = page.locator(".mobile-header").getByRole("button", { name: "Controls" });
  if (await headerHelp.isVisible()) {
    await headerHelp.click();
    await page.getByRole("dialog", { name: "Controls" }).getByRole("button", { name: "How to Play" }).click();
  } else {
    await page.getByRole("button", { name: "How to Play" }).click();
  }
  const howToPlay = page.getByRole("dialog");
  await expect(howToPlay).toContainText("Rearrange every letter");
  await howToPlay.getByRole("button", { name: "Next instruction" }).click();
  await expect(howToPlay).toContainText("Complete a goal to unlock the next tier");
  await expect(howToPlay).toContainText("Hard and Perfect Split tiers");
  await expect(howToPlay).not.toContainText("Holy Split");
  await expect(howToPlay).not.toContainText(/bronze|silver|gold/i);
  await page.getByRole("button", { name: "Close" }).click();
  await openSidebarIfNeeded(page);
  await page.getByRole("button", { name: "About" }).click();
  const about = page.getByRole("dialog");
  await expect(about).toContainText("© 2026 Keith Herrmann");
  await expect(about.getByRole("link", { name: "Check out my other stuff" })).toHaveAttribute("href", "https://linktr.ee/keithherrmann");
  await page.getByRole("button", { name: "Close" }).click();
  await openSidebarIfNeeded(page);
  await expect(page.getByRole("button", { name: "Prev." })).toBeEnabled();
  const nextButton = page.getByRole("button", { name: "Next" });
  await expect(nextButton).toBeDisabled();
  await expect(nextButton).toHaveCSS("border-color", "rgba(0, 0, 0, 0.22)");
  await expect(nextButton).toHaveCSS("background-color", "rgba(255, 255, 255, 0.08)");
  await expect(nextButton).toHaveCSS("color", "rgba(0, 0, 0, 0.22)");
  await expect(nextButton.locator("svg")).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(nextButton.locator("svg")).toHaveCSS("opacity", "0.22");
});

test("links the level title to Wikipedia in the visible responsive header", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });

  const titleLink = page.locator(".level-title-link:visible");
  await expect(titleLink).toHaveCount(1);
  await expect(titleLink).toHaveAttribute("href", /^https:\/\/en\.wikipedia\.org\/wiki\//);
  await expect(titleLink).toHaveAttribute("target", "_blank");
  await expect(titleLink).toHaveAttribute("rel", "noopener noreferrer");
  await expect(titleLink).toHaveCSS("text-decoration-line", "underline");
});

test("renders an intentionally unlinked level title as plain text", async ({ page }) => {
  await page.route("**/levels.json", async (route) => {
    const response = await route.fetch();
    const document = await response.json();
    for (const level of document.levels) level.WIKIPEDIA_ARTICLE = null;
    await route.fulfill({ response, json: document });
  });

  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".level-title:visible")).toHaveCount(1);
  await expect(page.locator(".level-title-link:visible")).toHaveCount(0);
});

test("opens the victory popup with the localhost-only shortcut", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });

  await page.keyboard.press("Alt+v");

  await expect(page.getByRole("dialog", { name: "Perfect Split!" })).toBeVisible();
  await expect(page.locator(".victory-banana")).toBeVisible();
  await expect(page.locator(".victory-badge")).toHaveCount(0);
});

test("renders each earned badge combination on victory and recent-puzzle tiles", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });

  for (const variant of [
    { perfectSplit: true, licketySplit: false, names: ["Holy Split"] },
    { perfectSplit: false, licketySplit: true, names: ["Lickety Split"] },
    { perfectSplit: true, licketySplit: true, names: ["Holy Split", "Lickety Split"] },
  ]) {
    await setCurrentBadges(page, variant.perfectSplit, variant.licketySplit);
    await page.keyboard.press("Alt+v");

    const dialogBadges = page.locator(".victory-badge");
    await expect(dialogBadges).toHaveCount(variant.names.length);
    await expect(dialogBadges.locator("strong")).toHaveText(variant.names);
    if (variant.names.length === 1) {
      const badgesBox = await page.locator(".victory-badges").boundingBox();
      const badgeBox = await dialogBadges.boundingBox();
      expect(badgesBox).not.toBeNull();
      expect(badgeBox).not.toBeNull();
      expect((badgeBox?.x ?? 0) + (badgeBox?.width ?? 0) / 2)
        .toBeCloseTo((badgesBox?.x ?? 0) + (badgesBox?.width ?? 0) / 2, 0);
    }
    await page.getByRole("button", { name: "Close" }).click();

    await openSidebarIfNeeded(page);
    const activeTile = page.locator('.puzzle-date-button[aria-pressed="true"]');
    const tileBadges = activeTile.locator(".puzzle-tile-badges img");
    await expect(tileBadges).toHaveCount(variant.names.length);
    await expect(activeTile).toHaveAttribute("aria-label", new RegExp(variant.names.join(" and ")));
    for (let index = 0; index < variant.names.length; index += 1) {
      await expect(tileBadges.nth(index)).toHaveCSS("opacity", "0.3");
    }
  }
});

test("previews all three trophy pulses without earning criteria", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });

  const achievementTimesBefore = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("split-happens.web.v2") ?? "null");
    const current = Object.values(saved?.levels ?? {})[0] as any;
    return [current?.firstSplitAt ?? null, current?.firstSilverAt ?? null, current?.firstGoldAt ?? null];
  });

  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", {
    altKey: true,
    code: "KeyT",
    key: "†",
  })));

  await expect(page.locator(".seal.pulsing .seal-trophy")).toHaveCount(3);
  await expect(page.locator(".seal.pulsing .seal-trophy").first()).toHaveCSS("animation-name", "trophy-pulse");
  await expect(page.locator(".tier-step.complete")).toHaveCount(0);
  await expect(page.locator(".criterion-line.met")).toHaveCount(0);
  const achievementTimesAfter = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("split-happens.web.v2") ?? "null");
    const current = Object.values(saved?.levels ?? {})[0] as any;
    return [current?.firstSplitAt ?? null, current?.firstSilverAt ?? null, current?.firstGoldAt ?? null];
  });
  expect(achievementTimesAfter).toEqual(achievementTimesBefore);

  await page.reload();
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".seal.pulsing")).toHaveCount(0);
  await expect(page.locator(".seal-trophy")).toHaveCount(0);
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
  await expect(dates.last()).toHaveCSS("box-shadow", /rgb\(0, 0, 0\) 0px 0px 0px 1px inset/);

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
  await expect(dates.first()).toHaveCSS("box-shadow", /rgb\(0, 0, 0\) 0px 0px 0px 1px inset/);
  await expect(page.locator(".sidebar-brand h1")).toContainText("August 26th");
  await expect(page.locator(".sidebar-brand h1 span")).toHaveCount(2);
  await expect(page.locator(".sidebar-brand h1 span").last()).toHaveText(/^'[^']+'$/);
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

test("does not copy solved progress to the first puzzle selected after refresh", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });

  const hint = page.getByRole("button", { name: "Hint" });
  const rowCount = await page.locator(".target-row").count();
  for (let row = 0; row < rowCount; row += 1) await hint.click();
  await expect(page.getByRole("dialog")).toContainText("Perfect Split!");
  await page.getByRole("button", { name: "Close" }).click();

  await page.reload();
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });
  await openSidebarIfNeeded(page);

  const firstUnselected = page.locator('.puzzle-date-button:not([aria-pressed="true"])').first();
  const destinationDate = await firstUnselected.getAttribute("data-date");
  if (!destinationDate) throw new Error("Expected a destination date");
  const destination = page.locator(`[data-date="${destinationDate}"]`);
  await destination.click();
  await expect(destination).toHaveAttribute("aria-pressed", "true");
  await expect(destination).toHaveCSS("background-color", "rgb(255, 255, 255)");

  const copiedMilestone = await page.evaluate((date) => {
    const saved = JSON.parse(localStorage.getItem("split-happens.web.v2") ?? "null");
    if (!saved || !date) throw new Error("Expected saved progress and a destination date");
    return fetch("/daily_schedule.json")
      .then((response) => response.json())
      .then(({ schedule }) => {
        const levelID = schedule.find((entry: { date: string; ID: string }) => entry.date === date)?.ID;
        if (!levelID) throw new Error("Expected destination level in the schedule");
        return saved.levels[levelID]?.firstSplitAt ?? null;
      });
  }, destinationDate);
  expect(copiedMilestone).toBeNull();
});

test("shows completed progression and uses Perfect Split for every victory", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });

  const rowCount = await page.locator(".target-row").count();
  const hint = page.getByRole("button", { name: "Hint" });
  for (let row = 0; row < rowCount; row += 1) await hint.click();

  await expect(page.getByRole("dialog")).toContainText("Perfect Split!");
  const victorySeal = page.locator(".victory-seal");
  const victoryBanana = victorySeal.locator(".victory-banana");
  await expect(victorySeal).toHaveCSS("background-color", "rgb(250, 250, 248)");
  await expect(victorySeal).toHaveCSS("animation-name", "victory-pulse");
  await expect(victoryBanana).toHaveCSS("background-color", "rgb(255, 216, 107)");
  await expect(victoryBanana).not.toHaveCSS("mask-image", "none");
  const victorySealBox = await victorySeal.boundingBox();
  const victoryBananaBox = await victoryBanana.boundingBox();
  expect(victoryBananaBox?.width).toBeGreaterThan(victorySealBox?.width ?? Infinity);
  await expect(page.locator(".tier-step.complete")).toHaveCount(3);
  await expect(page.locator(".seal-trophy")).toHaveCount(3);
  await expect(page.locator(".criterion-line.met")).toHaveCount(3);
  await expect(page.locator(".criterion-line.met").first()).toHaveCSS("color", "rgb(119, 119, 119)");
  await expect(page.locator('.puzzle-date-button[aria-pressed="true"]')).toHaveClass(/tier-gold/);
  await expect(page.locator(".tier-lock")).toHaveCount(0);
  await expect(page.locator(".seal.pulsing .seal-trophy")).toHaveCount(3);
  await expect(page.locator(".seal.pulsing .seal-trophy").first()).toHaveCSS("animation-name", "trophy-pulse");
  const perfectStep = page.locator(".tier-step").filter({ hasText: "Perfect Split" });
  await expect(perfectStep).toHaveClass(/active/);
  await expect(perfectStep).toHaveAttribute("aria-current", "step");
  await expect(page.locator(".tier-objective")).toHaveText(/Highlighted tiles must spell .* in order\s*$/i);
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

  await expect(page.getByRole("dialog")).toContainText("Perfect Split!");
  await page.getByRole("button", { name: "Close" }).click();
  await openSidebarIfNeeded(page);
  await page.getByRole("button", { name: "Stats" }).click();
  await expect(page.getByRole("dialog")).not.toContainText("Holy Split");
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
  await expect(page.locator(".seal-trophy")).toHaveCount(2);
  await expect(steps.nth(0)).toHaveClass(/unlocked/);
  await expect(steps.nth(1)).toHaveClass(/unlocked/);
  await expect(steps.nth(2)).toHaveClass(/unlocked/);
  await expect(page.locator(".tier-lock")).toHaveCount(0);
  await expect(steps.nth(2)).toHaveClass(/active/);
  await expect(steps.nth(2).locator(".seal")).toHaveCSS("filter", "none");
  await expect(page.locator(".tier-connector.complete")).toHaveCount(2);
  await expect(page.locator(".tier-connector.complete").first()).toHaveCSS("height", "2px");
  await expect(page.locator(".tier-connector.complete").first()).toHaveCSS("background-color", "rgb(96, 96, 96)");
  await expect(page.locator(".tier-objective")).toHaveText(/Highlighted tiles must spell .* in order\s*$/i);
  await expect(page.locator(".criterion-line").nth(0)).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(page.locator(".criterion-line").nth(1)).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(page.locator(".criterion-line").nth(2)).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(page.locator(".criterion-line.locked")).toHaveCount(0);
  expect((await page.locator(".tier-objective").boundingBox())?.height).toBeCloseTo(lockedHeight ?? 0, 0);
  await expect(page.locator(".gold-slot")).not.toHaveCount(0);
});

test("clicking the Perfect Split keyword arranges gold letters and returns displaced tiles in order", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });

  const setup = await page.evaluate(async () => {
    const storageKey = "split-happens.web.v2";
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (!saved) throw new Error("Expected saved game progress");
    const [levelID, progress] = Object.entries(saved.levels)[0] as [string, any];
    const levelsDocument = await fetch("/levels.json").then((response) => response.json());
    const level = levelsDocument.levels.find((item: any) => item.ID === levelID);
    if (!level) throw new Error("Expected current level definition");

    const expectations: Array<{ rowIndex: number; columnIndex: number; letter: string }> = [];
    level.answers.forEach((answer: string, rowIndex: number) => {
      let columnIndex = 0;
      let previous: { columnIndex: number; letter: string } | null = null;
      for (const character of answer.toUpperCase()) {
        if (character === "*") {
          if (previous) expectations.push({ rowIndex, ...previous });
        } else {
          previous = { columnIndex, letter: character };
          columnIndex += 1;
        }
      }
    });
    if (expectations.length < 2) throw new Error("Expected at least two gold slots");

    const goldLetters = new Set(expectations.map(({ letter }) => letter));
    const tiles = level.source.flatMap((word: string, row: number) =>
      [...word].map((letter, column) => ({ id: `${row}:${column}`, letter, row, column })),
    );
    const wrongTiles = tiles.filter(({ letter }) => !goldLetters.has(letter)).slice(0, 2);
    if (wrongTiles.length < 2) throw new Error("Expected two non-gold letters");

    wrongTiles.forEach((tile, index) => {
      progress.sourceSlots[tile.row][tile.column] = null;
      const expectation = expectations[index];
      progress.targetSlots[expectation.rowIndex][expectation.columnIndex] = tile.id;
    });
    progress.firstSplitAt = "2026-09-03T12:00:00.000Z";
    progress.firstSilverAt = "2026-09-03T12:01:00.000Z";
    progress.history = [];
    localStorage.setItem(storageKey, JSON.stringify(saved));

    const characterByID = new Map(tiles.map(({ id, letter }) => [id, letter]));
    const candidates = [...progress.sourceSlots.flat(), ...progress.targetSlots.flat()].filter(Boolean) as string[];
    const used = new Set<string>();
    const selected = expectations.map(({ letter }) => {
      const id = candidates.find((candidate) => !used.has(candidate) && characterByID.get(candidate) === letter);
      if (!id) throw new Error(`Missing candidate for ${letter}`);
      used.add(id);
      return id;
    });
    const plannedSourceSlots = structuredClone(progress.sourceSlots) as Array<Array<string | null>>;
    selected.forEach((id) => {
      plannedSourceSlots.forEach((row) => {
        const column = row.indexOf(id);
        if (column >= 0) row[column] = null;
      });
    });
    const emptySourcePositions = plannedSourceSlots.flatMap((row, rowIndex) =>
      row.flatMap((id, columnIndex) => id ? [] : [{ rowIndex, columnIndex }]),
    );
    const destinations = wrongTiles.map((tile, index) => ({ ...emptySourcePositions[index], letter: tile.letter }));

    return { word: level.GOLD_WORD, destinations };
  });

  await page.reload();
  const keyword = page.getByRole("button", { name: `Arrange highlighted tiles to spell ${setup.word}` });
  await expect(keyword).toBeVisible();
  await keyword.click();

  const goldSlots = page.locator(".gold-slot");
  await expect(goldSlots).toHaveCount(setup.word.length);
  await expect(page.locator(".gold-slot.correct-gold")).toHaveCount(setup.word.length);
  for (const destination of setup.destinations) {
    await expect(page.locator(`[data-source-row="${destination.rowIndex}"][data-source-column="${destination.columnIndex}"]`))
      .toHaveAccessibleName(`Letter ${destination.letter}`);
  }
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

test("uses Escape to clear tile and slot selections", async ({ page }) => {
  await page.goto("/");
  const source = page.locator(".letter-tile").first();
  const target = page.locator(".target-slot").first();

  await source.click();
  await expect(source).toHaveClass(/selected/);
  await page.keyboard.press("Escape");
  await expect(source).not.toHaveClass(/selected/);

  await target.click();
  await expect(target).toHaveClass(/selected/);
  await page.keyboard.press("Escape");
  await expect(target).not.toHaveClass(/selected/);

  await source.click();
  await target.click();
  const sourceHole = page.locator(".source-hole").first();
  await sourceHole.click();
  await expect(sourceHole).toHaveClass(/selected/);
  await page.keyboard.press("Escape");
  await expect(sourceHole).not.toHaveClass(/selected/);
});

test("clears selection when clicking outside the tile and slot areas", async ({ page }) => {
  await page.goto("/");
  const source = page.locator(".letter-tile").first();
  const target = page.locator(".target-slot").first();
  const clickOutside = () => page.mouse.click(5, 5);

  await source.click();
  await expect(source).toHaveClass(/selected/);
  await clickOutside();
  await expect(source).not.toHaveClass(/selected/);

  await target.click();
  await expect(target).toHaveClass(/selected/);
  await clickOutside();
  await expect(target).not.toHaveClass(/selected/);

  await source.click();
  await target.click();
  const sourceHole = page.locator(".source-hole").first();
  await sourceHole.click();
  await expect(sourceHole).toHaveClass(/selected/);
  await clickOutside();
  await expect(sourceHole).not.toHaveClass(/selected/);
});

test("moves empty-target selection to another empty target and toggles it off", async ({ page }) => {
  await page.goto("/");
  const targets = page.locator(".target-slot.empty");
  const first = targets.nth(0);
  const second = targets.nth(1);

  await first.click();
  await expect(first).toHaveClass(/selected/);

  await second.click();
  await expect(first).not.toHaveClass(/selected/);
  await expect(second).toHaveClass(/selected/);

  await second.click();
  await expect(second).not.toHaveClass(/selected/);
  await expect(page.locator(".target-slot.selected")).toHaveCount(0);
});

test("moves a selected target letter into a clicked empty target", async ({ page }) => {
  await page.goto("/");
  const source = page.locator(".letter-tile").first();
  const firstTarget = page.locator(".target-slot").nth(0);
  const secondTarget = page.locator(".target-slot").nth(1);
  const sourceLabel = await source.getAttribute("aria-label");
  expect(sourceLabel).not.toBeNull();
  if (!sourceLabel) return;

  await source.click();
  await firstTarget.click();
  await firstTarget.click();
  await secondTarget.click();

  await expect(firstTarget).toHaveAccessibleName(/empty$/);
  await expect(secondTarget).toHaveAccessibleName(new RegExp(sourceLabel.replace("Letter ", "letter "), "i"));
  await expect(page.locator(".target-slot.selected")).toHaveCount(0);
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

test("selects an empty source slot and moves a subsequently clicked source letter there", async ({ page }) => {
  await page.goto("/");
  const sourceAt = (column: number) => page.locator(`[data-source-row="0"][data-source-column="${column}"]`);
  const target = page.locator(".target-slot").first();
  const movedLabel = await sourceAt(1).getAttribute("aria-label");
  expect(movedLabel).not.toBeNull();
  if (!movedLabel) return;

  await sourceAt(0).click();
  await target.click();
  await sourceAt(0).click();
  await expect(sourceAt(0)).toHaveClass(/selected/);
  await sourceAt(1).click();

  await expect(sourceAt(0)).toHaveAttribute("aria-label", movedLabel);
  await expect(sourceAt(1)).toHaveClass(/source-hole/);
  await expect(page.locator(".source-hole.selected")).toHaveCount(0);
});

test("selects an empty source slot and moves a subsequently clicked target letter there", async ({ page }) => {
  await page.goto("/");
  const source = page.locator(".letter-tile").first();
  const sourceRow = await source.getAttribute("data-source-row");
  const sourceColumn = await source.getAttribute("data-source-column");
  const sourceLabel = await source.getAttribute("aria-label");
  expect(sourceRow).not.toBeNull();
  expect(sourceColumn).not.toBeNull();
  expect(sourceLabel).not.toBeNull();
  if (sourceRow === null || sourceColumn === null || !sourceLabel) return;
  const sourceSlot = page.locator(`[data-source-row="${sourceRow}"][data-source-column="${sourceColumn}"]`);
  const target = page.locator(".target-slot").first();

  await source.click();
  await target.click();
  await sourceSlot.click();
  await expect(sourceSlot).toHaveClass(/selected/);
  await target.click();

  await expect(sourceSlot).toHaveAttribute("aria-label", sourceLabel);
  await expect(target).toHaveAccessibleName(/empty$/);
  await expect(page.locator(".source-hole.selected")).toHaveCount(0);
});

test("moves empty-source selection and toggles it off", async ({ page }) => {
  await page.goto("/");
  const sources = page.locator(".letter-tile");
  const targets = page.locator(".target-slot");
  await sources.nth(0).click();
  await targets.nth(0).click();
  await sources.nth(0).click();
  await targets.nth(1).click();
  const holes = page.locator(".source-hole");
  const first = holes.nth(0);
  const second = holes.nth(1);

  await first.click();
  await expect(first).toHaveClass(/selected/);
  await second.click();
  await expect(first).not.toHaveClass(/selected/);
  await expect(second).toHaveClass(/selected/);
  await second.click();
  await expect(second).not.toHaveClass(/selected/);
});

test("moves and swaps source tiles with select-then-tap", async ({ page }) => {
  await page.goto("/");
  const sourceAt = (column: number) => page.locator(`[data-source-row="0"][data-source-column="${column}"]`);
  const target = page.locator(".target-slot").first();
  const firstLabel = await sourceAt(0).getAttribute("aria-label");
  const secondLabel = await sourceAt(1).getAttribute("aria-label");
  const thirdLabel = await sourceAt(2).getAttribute("aria-label");
  expect(firstLabel).not.toBeNull();
  expect(secondLabel).not.toBeNull();
  expect(thirdLabel).not.toBeNull();
  if (!firstLabel || !secondLabel || !thirdLabel) return;

  await sourceAt(0).click();
  await sourceAt(1).click();
  await expect(sourceAt(0)).toHaveAttribute("aria-label", secondLabel);
  await expect(sourceAt(1)).toHaveAttribute("aria-label", firstLabel);

  await sourceAt(2).click();
  await target.click();
  await expect(sourceAt(2)).toHaveClass(/source-hole/);
  await sourceAt(0).click();
  await sourceAt(2).click();
  await expect(sourceAt(0)).toHaveClass(/source-hole/);
  await expect(sourceAt(2)).toHaveAttribute("aria-label", secondLabel);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(sourceAt(0)).toHaveAttribute("aria-label", secondLabel);
  await expect(sourceAt(2)).toHaveClass(/source-hole/);

  await target.click();
  await sourceAt(0).click();
  await expect(sourceAt(0)).toHaveAttribute("aria-label", thirdLabel);
  await expect(target).toHaveAccessibleName(new RegExp(secondLabel.replace("Letter ", "letter "), "i"));
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(sourceAt(0)).toHaveAttribute("aria-label", secondLabel);
  await expect(target).toHaveAccessibleName(new RegExp(thirdLabel.replace("Letter ", "letter "), "i"));
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

test("selects a target tile on the first click after dragging it into place", async ({ page }) => {
  await page.goto("/");
  const source = page.locator(".letter-tile").first();
  const targetID = await page.locator(".target-slot.empty").first().getAttribute("data-slot-id");
  expect(targetID).not.toBeNull();
  if (!targetID) return;
  const target = page.locator(`[data-slot-id="${targetID}"]`);
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!sourceBox || !targetBox) return;

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  await page.mouse.up();
  await expect(target).not.toHaveAccessibleName(/empty$/);

  await target.click();

  await expect(target).toHaveClass(/selected/);
});

test("returns a target tile only when its second click is within 500ms", async ({ page }) => {
  await page.goto("/");
  const source = page.locator(".letter-tile").first();
  const target = page.locator(".target-slot").first();
  await source.click();
  await target.click();

  await target.click();
  await page.waitForTimeout(550);
  await target.click();
  await expect(target).not.toHaveAccessibleName(/empty$/);
  await expect(target).not.toHaveClass(/selected/);

  await target.click();
  await page.waitForTimeout(100);
  await target.click();
  await expect(target).toHaveAccessibleName(/empty$/);
});

test("auto-places a source tile only when its second click is within 500ms", async ({ page }) => {
  await page.goto("/");
  const source = page.locator(".letter-tile").first();
  const sourceRow = await source.getAttribute("data-source-row");
  const sourceColumn = await source.getAttribute("data-source-column");
  expect(sourceRow).not.toBeNull();
  expect(sourceColumn).not.toBeNull();
  if (sourceRow === null || sourceColumn === null) return;
  const sourceSlot = page.locator(`[data-source-row="${sourceRow}"][data-source-column="${sourceColumn}"]`);
  const target = page.locator(".target-slot").first();

  await sourceSlot.click();
  await page.waitForTimeout(550);
  await sourceSlot.click();
  await expect(sourceSlot).toHaveClass(/letter-tile/);
  await expect(sourceSlot).not.toHaveClass(/selected/);

  await sourceSlot.click();
  await page.waitForTimeout(100);
  await sourceSlot.click();
  await expect(sourceSlot).toHaveClass(/source-hole/);
  await expect(target).not.toHaveAccessibleName(/empty$/);
});

test("shows exact source drop hover and swaps source tiles by dragging", async ({ page }) => {
  await page.goto("/");
  const sourceAt = (column: number) => page.locator(`[data-source-row="0"][data-source-column="${column}"]`);
  const origin = sourceAt(0);
  const destination = sourceAt(1);
  const originLabel = await origin.getAttribute("aria-label");
  const destinationLabel = await destination.getAttribute("aria-label");
  const originBox = await origin.boundingBox();
  const destinationBox = await destination.boundingBox();
  expect(originLabel).not.toBeNull();
  expect(destinationLabel).not.toBeNull();
  expect(originBox).not.toBeNull();
  expect(destinationBox).not.toBeNull();
  if (!originLabel || !destinationLabel || !originBox || !destinationBox) return;

  await page.mouse.move(originBox.x + originBox.width / 2, originBox.y + originBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(destinationBox.x + destinationBox.width / 2, destinationBox.y + destinationBox.height / 2);
  await expect(destination).toHaveClass(/drop-hover/);
  await expect(origin).not.toHaveClass(/drop-hover/);
  await page.mouse.up();

  await expect(sourceAt(0)).toHaveAttribute("aria-label", destinationLabel);
  await expect(sourceAt(1)).toHaveAttribute("aria-label", originLabel);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(sourceAt(0)).toHaveAttribute("aria-label", originLabel);
  await expect(sourceAt(1)).toHaveAttribute("aria-label", destinationLabel);
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

test("moves a target tile into the exact empty source slot", async ({ page }) => {
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
  const emptySourceBox = await sourceAt(1).boundingBox();
  expect(placedTileBox).not.toBeNull();
  expect(emptySourceBox).not.toBeNull();
  if (!placedTileBox || !emptySourceBox || !returningTileLabel) return;

  await page.mouse.move(placedTileBox.x + placedTileBox.width / 2, placedTileBox.y + placedTileBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(emptySourceBox.x + emptySourceBox.width / 2, emptySourceBox.y + emptySourceBox.height / 2);
  await expect(sourceAt(1)).toHaveClass(/drop-hover/);
  await page.mouse.up();

  await expect(sourceAt(0)).toHaveClass(/source-hole/);
  await expect(sourceAt(1)).toHaveAttribute("aria-label", returningTileLabel);
  await expect(targets.nth(0)).toHaveAccessibleName(/empty$/);
});

test("swaps target and source tiles at the exact occupied source slot", async ({ page }) => {
  await page.goto("/");
  const sourceAt = (column: number) => page.locator(`[data-source-row="0"][data-source-column="${column}"]`);
  const target = page.locator(".target-slot").first();
  const returningLabel = await sourceAt(1).getAttribute("aria-label");
  const displacedLabel = await sourceAt(2).getAttribute("aria-label");
  expect(returningLabel).not.toBeNull();
  expect(displacedLabel).not.toBeNull();
  if (!returningLabel || !displacedLabel) return;

  await sourceAt(1).click();
  await target.click();
  const targetBox = await target.boundingBox();
  const sourceBox = await sourceAt(2).boundingBox();
  expect(targetBox).not.toBeNull();
  expect(sourceBox).not.toBeNull();
  if (!targetBox || !sourceBox) return;

  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await expect(sourceAt(2)).toHaveClass(/drop-hover/);
  await page.mouse.up();

  await expect(sourceAt(2)).toHaveAttribute("aria-label", returningLabel);
  await expect(target).toHaveAccessibleName(new RegExp(displacedLabel.replace("Letter ", "letter "), "i"));
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(sourceAt(2)).toHaveAttribute("aria-label", displacedLabel);
  await expect(target).toHaveAccessibleName(new RegExp(returningLabel.replace("Letter ", "letter "), "i"));
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

test("uses an accessible help popup and sidebar drawer at constrained widths", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });

  const header = page.locator(".mobile-header");
  const menu = page.getByRole("button", { name: "Open sidebar menu" });
  const help = header.getByRole("button", { name: "Controls" });
  const drawer = page.locator("#sidebar-menu");
  await expect(header).toBeVisible();
  await expect(help).toBeVisible();
  await expect(page.locator(".workspace")).toHaveCSS("padding-bottom", "16px");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");

  await help.click();
  const controlsPopup = page.getByRole("dialog", { name: "Controls" });
  await expect(controlsPopup).toContainText("Click to select");
  await expect(controlsPopup).toContainText("Drag to place");
  await expect(controlsPopup).toContainText("Click any two tiles to swap positions");
  await expect(controlsPopup).toContainText("Double-click to move tile to/from source");
  await controlsPopup.getByRole("button", { name: "How to Play" }).click();
  const helpPopup = page.getByRole("dialog", { name: "How to Play" });
  await expect(helpPopup).toContainText("Rearrange every letter");
  await expect(helpPopup).toContainText("Valid words will light up in GREEN.");
  await expect(helpPopup).toContainText("Invalid words will light up in RED.");
  await expect(helpPopup.locator(".help-valid-word")).toHaveCSS("font-weight", "600");
  await expect(helpPopup.locator(".help-valid-word")).toHaveCSS("color", "rgb(0, 176, 80)");
  await expect(helpPopup.locator(".help-invalid-word")).toHaveCSS("font-weight", "600");
  await expect(helpPopup.locator(".help-invalid-word")).toHaveCSS("color", "rgb(217, 48, 37)");
  await expect(helpPopup).toHaveClass(/modal/);
  await expect(helpPopup).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const helpHeading = helpPopup.getByRole("heading", { name: "How to Play" });
  await expect(helpHeading).toHaveCSS("text-align", "center");
  await expect(helpPopup.getByRole("button", { name: "Close" })).toBeFocused();
  await expect(helpPopup.locator(".help-page-active .help-tile")).toHaveCount(36);
  const previousInstruction = helpPopup.getByRole("button", { name: "Previous instruction" });
  const nextInstruction = helpPopup.getByRole("button", { name: "Next instruction" });
  await expect(previousInstruction).toBeDisabled();
  await expect(nextInstruction).toBeEnabled();
  await nextInstruction.click();
  await expect(helpPopup).toContainText("Complete a goal to unlock the next tier");
  await expect(helpPopup).toContainText("ROW TWO MUST BEGIN WITH F");
  let helpCriteria = helpPopup.locator(".help-page-active .help-criteria > span");
  await expect(helpCriteria).toHaveCount(2);
  await expect(helpCriteria.nth(0)).toHaveCSS("color", "rgb(119, 119, 119)");
  await expect(helpCriteria.nth(1)).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(previousInstruction).toBeEnabled();
  await nextInstruction.click();
  await expect(helpPopup).toContainText("GOLD LETTERS MUST SPELL TEA");
  helpCriteria = helpPopup.locator(".help-page-active .help-criteria > span");
  await expect(helpCriteria).toHaveCount(3);
  await expect(helpCriteria.nth(0)).toHaveCSS("color", "rgb(119, 119, 119)");
  await expect(helpCriteria.nth(1)).toHaveCSS("color", "rgb(119, 119, 119)");
  await expect(helpCriteria.nth(2)).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(helpPopup.locator(".help-tile-correctGold")).toHaveCount(3);
  await expect(nextInstruction).toBeDisabled();
  await helpPopup.getByRole("button", { name: "Close" }).click();
  await expect(helpPopup).toBeHidden();
  await expect(help).toBeFocused();

  await help.click();
  await page.keyboard.press("Escape");
  await expect(help).toBeFocused();

  await help.click();
  await page.locator(".modal-backdrop").click({ position: { x: 20, y: 20 } });
  await expect(help).toBeFocused();

  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(drawer).toHaveAttribute("aria-modal", "true");
  await expect(drawer).toHaveClass(/drawer-open/);
  await expect(page.getByRole("button", { name: "Close sidebar menu" }).last()).toBeFocused();
  const drawerHeading = drawer.getByRole("heading", { name: "Menu" });
  await expect(drawerHeading).toBeVisible();
  await expect(drawerHeading).toHaveText("Menu");
  await expect(drawerHeading).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(drawerHeading).toHaveCSS("font-size", "24px");
  await expect(drawerHeading).toHaveCSS("font-weight", "600");
  await expect(drawerHeading).toHaveCSS("letter-spacing", "normal");
  await expect(drawerHeading).toHaveCSS("text-align", "center");
  await expect(drawerHeading).toHaveCSS("text-transform", "none");
  const drawerActions = drawer.locator(".sidebar-actions button");
  await expect(drawerActions.first()).toHaveAccessibleName("How to Play");
  await expect(drawerActions.first()).toBeVisible();
  await expect(drawer.locator(".sidebar-controls")).toBeHidden();
  await expect(drawer.locator(".sidebar-stats")).toHaveCSS("border-bottom-width", "0px");

  await page.keyboard.press("Escape");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
  await expect(menu).toBeFocused();

  await menu.click();
  await page.locator(".drawer-backdrop").click({ position: { x: 900, y: 700 } });
  await expect(menu).toBeFocused();

  await menu.click();
  await page.locator('[data-date="2026-08-31"]').click();
  await expect(header.locator("h1")).toContainText("August 31st");
  await expect(menu).toHaveAttribute("aria-expanded", "false");

  await page.setViewportSize({ width: 500, height: 718 });
  await openSidebarIfNeeded(page);
  await page.locator('[data-date="2026-09-03"]').click();
  const toolbarBox = await page.locator(".game-toolbar").boundingBox();
  expect(toolbarBox).not.toBeNull();
  if (toolbarBox) expect(718 - (toolbarBox.y + toolbarBox.height)).toBeGreaterThanOrEqual(4);
});

test("keeps every help page inside compact viewports", async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });
    await page.locator(".mobile-header").getByRole("button", { name: "Controls" }).click();
    await page.getByRole("dialog", { name: "Controls" }).getByRole("button", { name: "How to Play" }).click();

    const popup = page.getByRole("dialog", { name: "How to Play" });
    const next = popup.getByRole("button", { name: "Next instruction" });
    const popupHeights: number[] = [];
    const pageTops: number[] = [];
    const boardBottoms: number[] = [];
    const arrowTops: number[] = [];
    for (let helpPage = 0; helpPage < 3; helpPage += 1) {
      const popupBox = await popup.boundingBox();
      const activePage = popup.locator(".help-page-active");
      const tiles = activePage.locator(".help-tile");
      const firstTile = await tiles.first().boundingBox();
      const lastTile = await tiles.last().boundingBox();
      expect(popupBox).not.toBeNull();
      expect(firstTile).not.toBeNull();
      expect(lastTile).not.toBeNull();
      if (popupBox) popupHeights.push(popupBox.height);
      if (popupBox && firstTile && lastTile) {
        expect(firstTile.x).toBeGreaterThanOrEqual(popupBox.x - 1);
        expect(lastTile.x + lastTile.width).toBeLessThanOrEqual(popupBox.x + popupBox.width + 1);
        expect(lastTile.y + lastTile.height).toBeLessThanOrEqual(popupBox.y + popupBox.height + 1);
      }
      const arrowsBox = await popup.locator(".help-pagination").boundingBox();
      const activePageBox = await activePage.boundingBox();
      const boardsBox = await activePage.locator(".help-transformation").boundingBox();
      expect(arrowsBox).not.toBeNull();
      expect(activePageBox).not.toBeNull();
      expect(boardsBox).not.toBeNull();
      if (arrowsBox && activePageBox && boardsBox) {
        pageTops.push(activePageBox.y);
        boardBottoms.push(boardsBox.y + boardsBox.height);
        arrowTops.push(arrowsBox.y);
        expect(arrowsBox.y).toBeGreaterThanOrEqual(activePageBox.y + activePageBox.height - 1);
      }
      expect(await popup.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
      if (helpPage < 2) await next.click();
    }
    expect(Math.max(...popupHeights) - Math.min(...popupHeights)).toBeLessThanOrEqual(1);
    expect(Math.max(...pageTops) - Math.min(...pageTops)).toBeLessThanOrEqual(1);
    expect(Math.max(...boardBottoms) - Math.min(...boardBottoms)).toBeLessThanOrEqual(1);
    expect(Math.max(...arrowTops) - Math.min(...arrowTops)).toBeLessThanOrEqual(1);
    await popup.getByRole("button", { name: "Close" }).click();
  }
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

test("keeps source and target tile scaling proportional at desktop heights", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".target-row")).toHaveCount(5);

  const game = await page.locator(".game-area").boundingBox();
  const targetTile = await page.locator(".target-slot").first().boundingBox();
  const sourceTile = await page.locator(".letter-tile").first().boundingBox();
  const toolbar = await page.locator(".game-toolbar").boundingBox();

  expect(game).not.toBeNull();
  expect(targetTile).not.toBeNull();
  expect(sourceTile).not.toBeNull();
  expect(toolbar).not.toBeNull();
  if (!game || !targetTile || !sourceTile || !toolbar) return;

  expect(targetTile.width).toBeGreaterThan(55);
  expect(targetTile.width).toBeLessThan(60);
  expect(sourceTile.width).toBeGreaterThan(40);
  expect(sourceTile.width).toBeLessThan(45);
  expect(sourceTile.width / targetTile.width).toBeGreaterThan(0.65);
  expect(sourceTile.width / targetTile.width).toBeLessThan(0.8);
  expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(game.y + game.height + 1);
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
  if (targetTileBox && sourceTileBox) {
    const sourceToTargetRatio = sourceTileBox.width / targetTileBox.width;
    expect(sourceToTargetRatio).toBeGreaterThan(0.65);
    expect(sourceToTargetRatio).toBeLessThan(0.8);
  }
  expect(overflow).toBeLessThanOrEqual(1);
  if (gameBox && toolbarBox) expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(gameBox.y + gameBox.height + 1);
});

test("moves recent puzzles into a popup when a desktop sidebar cannot fit", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 450 });
  await page.goto("/");
  await expect(page.locator(".game-area")).toBeVisible({ timeout: 15_000 });

  const sidebar = page.locator(".app-sidebar");
  const recentPuzzlesButton = page.getByRole("button", { name: "Recent Puzzles", exact: true });
  await expect(page.locator(".sidebar-stats")).toBeHidden();
  await expect(recentPuzzlesButton).toBeVisible();
  await expect(recentPuzzlesButton).toHaveCSS("font-size", "13px");
  expect(await sidebar.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(0);

  await recentPuzzlesButton.click();
  const popup = page.getByRole("dialog", { name: "Recent Puzzles" });
  await expect(popup).toBeVisible();
  await expect(popup.locator(".puzzle-date-button")).toHaveCount(9);
  await expect(popup.locator(".puzzle-date-button.tier-none").first()).toHaveCSS("background-color", "rgb(250, 250, 248)");

  await popup.getByRole("button", { name: "Close" }).click();
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(page.locator(".sidebar-stats")).toBeVisible();
  await expect(recentPuzzlesButton).toBeHidden();
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
