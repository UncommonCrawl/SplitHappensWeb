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
});
