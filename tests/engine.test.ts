import { describe, expect, it } from "vitest";
import { createGame, deriveGame, gameReducer } from "../src/engine";
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
const words = new Set(["CAT", "DOG"]);

describe("game engine", () => {
  it("places, swaps, returns, and undoes tiles", () => {
    const reduce = gameReducer(level, words);
    let state = createGame(level);
    state = reduce(state, { type: "PLACE", tileID: "0:0", slotID: "0:0" });
    state = reduce(state, { type: "PLACE", tileID: "0:1", slotID: "0:0" });
    expect(state.targetSlots[0][0]).toBe("0:1");
    expect(state.sourceSlots[0][1]).toBe("0:0");
    state = reduce(state, { type: "UNDO" });
    expect(state.targetSlots[0][0]).toBe("0:0");
    state = reduce(state, { type: "RETURN", tileID: "0:0" });
    expect(state.targetSlots[0][0]).toBeNull();
  });

  it("swaps occupied source slots and moves into empty source slots", () => {
    const reduce = gameReducer(level, words);
    let state = createGame(level);

    state = reduce(state, { type: "MOVE_SOURCE", tileID: "0:0", row: 0, column: 1 });
    expect(state.sourceSlots[0]).toEqual(["0:1", "0:0", "0:2"]);

    state = reduce(state, { type: "PLACE", tileID: "0:2", slotID: "0:0" });
    expect(state.sourceSlots[0][2]).toBeNull();
    state = reduce(state, { type: "MOVE_SOURCE", tileID: "0:0", row: 0, column: 2 });
    expect(state.sourceSlots[0]).toEqual(["0:1", null, "0:0"]);
  });

  it("moves target tiles into exact source slots and swaps across boards", () => {
    const reduce = gameReducer(level, words);
    let state = createGame(level);

    state = reduce(state, { type: "PLACE", tileID: "0:0", slotID: "0:0" });
    state = reduce(state, { type: "PLACE", tileID: "0:1", slotID: "0:1" });
    state = reduce(state, { type: "MOVE_SOURCE", tileID: "0:0", row: 0, column: 1 });
    expect(state.sourceSlots[0]).toEqual([null, "0:0", "0:2"]);
    expect(state.targetSlots[0]).toEqual([null, "0:1", null]);

    state = reduce(state, { type: "MOVE_SOURCE", tileID: "0:1", row: 0, column: 2 });
    expect(state.sourceSlots[0]).toEqual([null, "0:0", "0:1"]);
    expect(state.targetSlots[0]).toEqual([null, "0:2", null]);

    state = reduce(state, { type: "UNDO" });
    expect(state.sourceSlots[0]).toEqual([null, "0:0", "0:2"]);
    expect(state.targetSlots[0]).toEqual([null, "0:1", null]);
  });

  it("returns a target tile to the first free source slot when requested", () => {
    const reduce = gameReducer(level, words);
    let state = createGame(level);
    state = reduce(state, { type: "PLACE", tileID: "0:1", slotID: "0:0" });
    state = reduce(state, { type: "PLACE", tileID: "0:0", slotID: "0:1" });

    state = reduce(state, { type: "RETURN_FIRST_FREE", tileID: "0:1" });

    expect(state.sourceSlots[0]).toEqual(["0:1", null, "0:2"]);
    expect(state.targetSlots[0]).toEqual([null, "0:0", null]);
  });

  it("returns a displaced keyboard-placement tile to the first free source slot", () => {
    const reduce = gameReducer(level, words);
    let state = createGame(level);
    state = reduce(state, { type: "PLACE", tileID: "0:0", slotID: "0:0" });
    state = reduce(state, { type: "PLACE", tileID: "0:1", slotID: "0:1" });

    state = reduce(state, { type: "PLACE_RETURNING_DISPLACED", tileID: "0:2", slotID: "0:1" });

    expect(state.targetSlots[0]).toEqual(["0:0", "0:2", null]);
    expect(state.sourceSlots[0]).toEqual(["0:1", null, null]);
  });

  it("returns a typed target tile to source when it is already in the selected slot", () => {
    const reduce = gameReducer(level, words);
    let state = reduce(createGame(level), { type: "PLACE", tileID: "0:0", slotID: "0:0" });

    state = reduce(state, { type: "PLACE_RETURNING_DISPLACED", tileID: "0:0", slotID: "0:0" });

    expect(state.targetSlots[0][0]).toBeNull();
    expect(state.sourceSlots[0][0]).toBe("0:0");
  });

  it("fills and locks official answer rows with sequential hints", () => {
    const reduce = gameReducer(level, words);
    let state = reduce(createGame(level), { type: "HINT" });
    expect(deriveGame(state, level, words).rowWords[0]).toBe("CAT");
    expect(state.hintedRows).toEqual([0]);
    const locked = state;
    state = reduce(state, { type: "RETURN", tileID: state.targetSlots[0][0]! });
    expect(state).toEqual(locked);
  });

  it("recalls every tile to its exact original source position and clears hints", () => {
    const reduce = gameReducer(level, words);
    const initial = createGame(level);
    let state = reduce(initial, { type: "PLACE", tileID: "0:0", slotID: "1:0" });
    state = reduce(state, { type: "HINT" });
    state = reduce(state, { type: "RECALL" });
    expect(state.sourceSlots).toEqual(initial.sourceSlots);
    expect(state.targetSlots).toEqual(initial.targetSlots);
    expect(state.hintedRows).toEqual([]);
    expect(state.history).toEqual([]);
    expect(reduce(state, { type: "UNDO" })).toEqual(state);
  });

  it("recognizes all words, bonus, and ordered gold tiles", () => {
    const reduce = gameReducer(level, words);
    let state = createGame(level);
    state = reduce(state, { type: "HINT" });
    state = reduce(state, { type: "HINT" });
    const result = deriveGame(state, level, words);
    expect(result.allWordsValid).toBe(true);
    expect(result.goldSatisfied).toBe(true);
    expect(result.victorySatisfied).toBe(true);
  });

  it("still requires lower criteria for victory when the gold tiles match", () => {
    const reduce = gameReducer(level, words);
    const state = reduce(createGame(level), { type: "PLACE", tileID: "0:1", slotID: "0:0" });
    const result = deriveGame(state, level, words);

    expect(result.goldSatisfied).toBe(true);
    expect(result.allWordsValid).toBe(false);
    expect(result.victorySatisfied).toBe(false);
  });

  it("arranges interchangeable gold letters, preserves correct tiles, and returns displacements in order", () => {
    const goldLevel: LevelDefinition = {
      ...level,
      startingWords: ["AABC", "XYZZ"],
      targetRowLengths: [4, 4],
      answerRows: ["AABC", "XYZZ"],
      goldTileExpectations: [
        { rowIndex: 0, columnIndex: 0, letter: "A" },
        { rowIndex: 0, columnIndex: 2, letter: "A" },
        { rowIndex: 1, columnIndex: 1, letter: "B" },
      ],
      goldWord: "AAB",
    };
    const reduce = gameReducer(goldLevel, words);
    let state = createGame(goldLevel);
    state = reduce(state, { type: "PLACE", tileID: "0:1", slotID: "0:0" });
    state = reduce(state, { type: "PLACE", tileID: "1:0", slotID: "0:2" });
    state = reduce(state, { type: "PLACE", tileID: "1:1", slotID: "1:1" });
    const before = structuredClone(state);

    state = reduce(state, { type: "ARRANGE_GOLD" });

    expect(state.targetSlots[0][0]).toBe("0:1");
    expect(state.targetSlots[0][2]).toBe("0:0");
    expect(state.targetSlots[1][1]).toBe("0:2");
    expect(state.sourceSlots[0][0]).toBe("1:0");
    expect(state.sourceSlots[0][1]).toBe("1:1");

    state = reduce(state, { type: "UNDO" });
    expect(state.sourceSlots).toEqual(before.sourceSlots);
    expect(state.targetSlots).toEqual(before.targetSlots);
  });

  it("prefers the first matching source tile in visual order over a matching target tile", () => {
    const goldLevel: LevelDefinition = {
      ...level,
      startingWords: ["AAAAB", "CDEF"],
      targetRowLengths: [5, 4],
      answerRows: ["AAAAB", "CDEF"],
      goldTileExpectations: [
        { rowIndex: 0, columnIndex: 0, letter: "A" },
        { rowIndex: 0, columnIndex: 1, letter: "A" },
      ],
      goldWord: "AA",
    };
    const reduce = gameReducer(goldLevel, words);
    let state = createGame(goldLevel);
    state = reduce(state, { type: "PLACE", tileID: "0:0", slotID: "0:0" });
    state = reduce(state, { type: "PLACE", tileID: "0:1", slotID: "1:0" });
    state = reduce(state, { type: "MOVE_SOURCE", tileID: "0:3", row: 0, column: 2 });

    state = reduce(state, { type: "ARRANGE_GOLD" });

    expect(state.targetSlots[0][0]).toBe("0:0");
    expect(state.targetSlots[0][1]).toBe("0:3");
    expect(state.targetSlots[1][0]).toBe("0:1");
    expect(state.sourceSlots[0][3]).toBe("0:2");
  });

  it("uses a movable target tile only after source matches are exhausted", () => {
    const goldLevel: LevelDefinition = {
      ...level,
      goldTileExpectations: [{ rowIndex: 1, columnIndex: 0, letter: "A" }],
      goldWord: "A",
    };
    const reduce = gameReducer(goldLevel, words);
    let state = createGame(goldLevel);
    state = reduce(state, { type: "PLACE", tileID: "0:0", slotID: "0:2" });

    state = reduce(state, { type: "ARRANGE_GOLD" });

    expect(state.targetSlots[0][2]).toBeNull();
    expect(state.targetSlots[1][0]).toBe("0:0");
  });

  it("does not partially arrange gold slots when a locked row makes the move impossible", () => {
    const goldLevel: LevelDefinition = {
      ...level,
      goldTileExpectations: [
        { rowIndex: 1, columnIndex: 0, letter: "A" },
        { rowIndex: 0, columnIndex: 0, letter: "C" },
      ],
      goldWord: "AC",
    };
    const reduce = gameReducer(goldLevel, words);
    const state = createGame(goldLevel);
    state.targetSlots[0][0] = "0:0";
    state.sourceSlots[0][0] = null;
    state.hintedRows = [0];
    const before = structuredClone(state);

    const next = reduce(state, { type: "ARRANGE_GOLD" });

    expect(next).toBe(state);
    expect(next).toEqual(before);
  });
});
