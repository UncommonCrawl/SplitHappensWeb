import { describe, expect, it } from "vitest";
import levelsDocument from "../public/levels.json";
import { normalizeLevel } from "../src/content";

describe("production level corpus", () => {
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
