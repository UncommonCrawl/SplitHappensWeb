import { describe, expect, it } from "vitest";
import { createGame, gameReducer } from "../src/engine";
import { progressFromGame } from "../src/persistence";
import { highestPuzzleTier, recentScheduleEntries } from "../src/recentPuzzles";
import type { LevelDefinition, ScheduleEntry } from "../src/types";

const level: LevelDefinition = {
  id: "test",
  isActive: true,
  startingWords: ["ACT", "DOG"],
  targetRowLengths: [3, 3],
  answerRows: ["CAT", "DOG"],
  criterion: "*_STARTS_D",
  goldTileExpectations: [{ rowIndex: 0, columnIndex: 0, letter: "C" }],
  goldWord: "C",
  note: "",
};
const words = new Set(["CAT", "DOG", "GOD"]);

describe("recent puzzle grid", () => {
  it("returns nine calendar entries from oldest through today", () => {
    const schedule: ScheduleEntry[] = Array.from({ length: 12 }, (_, index) => ({
      date: `2026-08-${String(23 + index).padStart(2, "0")}`,
      levelID: `level-${index}`,
    }));
    const entries = recentScheduleEntries(schedule, new Date(2026, 7, 31));
    expect(entries).toHaveLength(9);
    expect(entries[0].date).toBe("2026-08-23");
    expect(entries[8].date).toBe("2026-08-31");
  });

  it("pages backward in non-overlapping groups of nine", () => {
    const schedule: ScheduleEntry[] = Array.from({ length: 18 }, (_, index) => ({
      date: `2026-08-${String(14 + index).padStart(2, "0")}`,
      levelID: `level-${index}`,
    }));
    const olderEntries = recentScheduleEntries(schedule, new Date(2026, 7, 31), 9, 1);
    expect(olderEntries).toHaveLength(9);
    expect(olderEntries[0].date).toBe("2026-08-14");
    expect(olderEntries[8].date).toBe("2026-08-22");
  });

  it("returns only the remaining dates on the oldest partial page", () => {
    const schedule: ScheduleEntry[] = Array.from({ length: 16 }, (_, index) => ({
      date: `2026-08-${String(16 + index).padStart(2, "0")}`,
      levelID: `level-${index}`,
    }));
    const oldestEntries = recentScheduleEntries(schedule, new Date(2026, 7, 31), 9, 1);
    expect(oldestEntries).toHaveLength(7);
    expect(oldestEntries[0].date).toBe("2026-08-16");
    expect(oldestEntries[6].date).toBe("2026-08-22");
  });

  it("reports the highest earned tier and infers legacy Silver progress", () => {
    const reduce = gameReducer(level, words);
    let silverGame = createGame(level);
    silverGame = reduce(silverGame, { type: "HINT" });
    silverGame = reduce(silverGame, { type: "HINT" });
    const silverProgress = progressFromGame(silverGame);
    silverProgress.firstSplitAt = "2026-09-01T00:00:00.000Z";

    expect(highestPuzzleTier(level, undefined, words)).toBe("none");
    expect(highestPuzzleTier(level, { ...silverProgress, targetSlots: silverProgress.targetSlots.map((row) => row.map(() => null)), sourceSlots: createGame(level).sourceSlots }, words)).toBe("bronze");
    expect(highestPuzzleTier(level, silverProgress, words)).toBe("silver");
    expect(highestPuzzleTier(level, { ...silverProgress, firstGoldAt: "2026-09-02T00:00:00.000Z" }, words)).toBe("gold");
  });

  it("keeps a persisted Silver milestone after the board changes", () => {
    const progress = progressFromGame(createGame(level));
    progress.firstSplitAt = "2026-09-01T00:00:00.000Z";
    progress.firstSilverAt = "2026-09-01T00:01:00.000Z";
    expect(highestPuzzleTier(level, progress, words)).toBe("silver");
  });
});
