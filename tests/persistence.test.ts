import { describe, expect, it } from "vitest";
import { emptyPersistedState, loadPersistedState, savePersistedState, STORAGE_KEY } from "../src/persistence";

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
});
