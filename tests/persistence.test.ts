import { describe, expect, it } from "vitest";
import { createGame, gameReducer } from "../src/engine";
import { awardVictoryBadges, emptyPersistedState, loadPersistedState, progressFromGame, savePersistedState, STORAGE_KEY } from "../src/persistence";
import type { LevelDefinition } from "../src/types";

const level: LevelDefinition = {
  id: "test",
  isActive: true,
  startingWords: ["ACT", "DOG"],
  targetRowLengths: [3, 3],
  answerRows: ["CAT", "DOG"],
  criterion: "*_STARTS_D",
  goldTileExpectations: [{ rowIndex: 0, columnIndex: 0, letter: "C" }],
  goldWord: "C",
  wikipediaArticle: null,
  note: "",
};

describe("persistence", () => {
  it("round trips the versioned store", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    const state = emptyPersistedState();
    state.settings.soundEnabled = false;
    savePersistedState(state, storage);
    expect(values.has(STORAGE_KEY)).toBe(true);
    expect(loadPersistedState(storage).settings.soundEnabled).toBe(false);
  });

  it("recovers from malformed or obsolete data", () => {
    expect(loadPersistedState({ getItem: () => "not-json" })).toEqual(emptyPersistedState());
    expect(loadPersistedState({ getItem: () => JSON.stringify({ version: 1 }) })).toEqual(emptyPersistedState());
  });

  it("accepts version 2 progress saved before the optional Silver milestone existed", () => {
    const legacy = emptyPersistedState();
    const loaded = loadPersistedState({ getItem: () => JSON.stringify(legacy) });
    expect(loaded.version).toBe(2);
    expect(loaded.levels).toEqual({});
  });

  it("awards both badges for a hint-free victory on the local release date", () => {
    const progress = progressFromGame(createGame(level));
    const achieved = awardVictoryBadges(progress, "2026-09-06", new Date(2026, 8, 6, 23, 59), true);

    expect(achieved.perfectSplit).toBe(true);
    expect(achieved.licketySplit).toBe(true);
  });

  it("does not award Lickety Split after the local release date", () => {
    const progress = progressFromGame(createGame(level));
    const achieved = awardVictoryBadges(progress, "2026-09-06", new Date(2026, 8, 7, 0, 0), true);

    expect(achieved.perfectSplit).toBe(true);
    expect(achieved.licketySplit).toBe(false);
  });

  it("does not award Holy Split after a hint is recalled", () => {
    const reduce = gameReducer(level, new Set(["CAT", "DOG"]));
    let game = reduce(createGame(level), { type: "HINT" });
    game = reduce(game, { type: "RECALL" });
    const achieved = awardVictoryBadges(progressFromGame(game), "2026-09-06", new Date(2026, 8, 6), true);

    expect(game.hintedRows).toEqual([]);
    expect(game.usedHint).toBe(true);
    expect(achieved.perfectSplit).toBe(false);
  });

  it("keeps previously earned badges after later hinted play", () => {
    const previous = {
      ...progressFromGame(createGame(level)),
      perfectSplit: true,
      licketySplit: true,
    };
    const hinted = gameReducer(level, new Set(["CAT", "DOG"]))(createGame(level, previous), { type: "HINT" });
    const achieved = awardVictoryBadges(progressFromGame(hinted, previous), "2026-09-05", new Date(2026, 8, 6), true);

    expect(achieved.perfectSplit).toBe(true);
    expect(achieved.licketySplit).toBe(true);
  });

  it("does not retroactively award missing badges when reopening a completed puzzle", () => {
    const completed = {
      ...progressFromGame(createGame(level)),
      firstGoldAt: "2026-09-06T12:00:00.000Z",
    };
    const reopened = awardVictoryBadges(completed, "2026-09-06", new Date(2026, 8, 6, 13, 0), false);

    expect(reopened.perfectSplit).toBe(false);
    expect(reopened.licketySplit).toBe(false);
  });

  it("defaults legacy in-progress hint state from locked hinted rows", () => {
    const legacy = progressFromGame(createGame(level));
    legacy.hintedRows = [0];
    delete (legacy as Partial<typeof legacy>).usedHint;

    expect(createGame(level, legacy).usedHint).toBe(true);
  });
});
