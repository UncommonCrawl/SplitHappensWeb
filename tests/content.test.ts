import { describe, expect, it } from "vitest";
import scheduleDocument from "../public/daily_schedule.json";
import levelsDocument from "../public/levels.json";
import { normalizeLevel } from "../src/content";
import { recentScheduleEntries } from "../src/recentPuzzles";

describe("production level corpus", () => {
  it("releases the level sequence daily beginning September 1, 2026", () => {
    expect(scheduleDocument.schedule[0]?.date).toBe("2026-09-01");

    for (let index = 1; index < scheduleDocument.schedule.length; index += 1) {
      const previous = new Date(`${scheduleDocument.schedule[index - 1].date}T00:00:00Z`);
      const current = new Date(`${scheduleDocument.schedule[index].date}T00:00:00Z`);
      expect(current.getTime() - previous.getTime()).toBe(24 * 60 * 60 * 1000);
    }

    const visible = recentScheduleEntries(
      scheduleDocument.schedule.map((entry) => ({ date: entry.date, levelID: entry.ID })),
      new Date(2026, 8, 7, 12),
    );
    expect(visible.map((entry) => entry.date)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
      "2026-09-07",
    ]);
  });

  it("normalizes every level with conserved letters and valid gold expectations", () => {
    const levels = levelsDocument.levels.map((level) => normalizeLevel(level));
    expect(levels.length).toBeGreaterThan(100);
    for (const level of levels) {
      expect(level.startingWords.join("").length).toBe(level.answerRows.join("").length);
      expect(level.goldTileExpectations.map((item) => item.letter).join("")).toBe(level.goldWord);
      expect(Object.hasOwn(levelsDocument.levels.find((item) => item.ID === level.id)!, "WIKIPEDIA_ARTICLE")).toBe(true);
    }
  });

  it("links every active level except the eight intentionally phrasal titles", () => {
    const unlinkedIDs = new Set(["part", "bears", "heart", "titan", "eye", "clubs", "sons", "yard"]);
    const activeLevels = levelsDocument.levels
      .map((raw) => normalizeLevel(raw))
      .filter((level) => level.isActive);

    expect(activeLevels).toHaveLength(132);
    for (const level of activeLevels) {
      expect(level.wikipediaArticle === null).toBe(unlinkedIDs.has(level.id));
    }
  });

  it("keeps CROWES hidden and the corrected BAGS gold sequence valid", () => {
    const crowes = normalizeLevel(levelsDocument.levels.find((level) => level.ID === "crowes")!);
    const bags = normalizeLevel(levelsDocument.levels.find((level) => level.ID === "bags")!);

    expect(crowes.isActive).toBe(false);
    expect(bags.goldWord).toBe("BAGS");
    expect(bags.goldTileExpectations.map((item) => item.letter).join("")).toBe("BAGS");
  });
});
