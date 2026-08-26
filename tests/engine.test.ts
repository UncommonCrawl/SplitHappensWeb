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
});
