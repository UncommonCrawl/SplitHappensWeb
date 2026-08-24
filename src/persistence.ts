import type { GameState, LevelProgress, PersistedAppState, WebSettings } from "./types";

export const STORAGE_KEY = "split-happens.web.v2";

export const defaultSettings: WebSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  shuffleAllLetters: false,
  shuffleGoldTiles: false,
};

export function emptyPersistedState(): PersistedAppState {
  return { version: 2, levels: {}, dailyResults: {}, settings: defaultSettings };
}

export function loadPersistedState(storage: Pick<Storage, "getItem"> = localStorage): PersistedAppState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyPersistedState();
    const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
    if (parsed.version !== 2 || !parsed.levels || !parsed.dailyResults) return emptyPersistedState();
    return { version: 2, levels: parsed.levels, dailyResults: parsed.dailyResults, settings: { ...defaultSettings, ...parsed.settings } };
  } catch {
    return emptyPersistedState();
  }
}

export function savePersistedState(value: PersistedAppState, storage: Pick<Storage, "setItem"> = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function progressFromGame(state: GameState, previous?: LevelProgress): LevelProgress {
  return {
    sourceSlots: state.sourceSlots,
    targetSlots: state.targetSlots,
    hintedRows: state.hintedRows,
    history: state.history,
    elapsedMs: state.elapsedMs,
    splitElapsedMs: state.splitElapsedMs,
    goldElapsedMs: state.goldElapsedMs,
    firstSplitAt: previous?.firstSplitAt ?? null,
    firstGoldAt: previous?.firstGoldAt ?? null,
    perfectSplit: previous?.perfectSplit ?? false,
    licketySplit: previous?.licketySplit ?? false,
  };
}
