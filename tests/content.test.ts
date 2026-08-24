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
    }
  });
});
