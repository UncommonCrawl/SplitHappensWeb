import type { GameState, LevelProgress, PersistedAppState, WebSettings } from "./types";
import { localDateKey } from "./content";

export const STORAGE_KEY = "split-happens.web.v2";

export const defaultSettings: WebSettings = {
  soundEnabled: true,
  shuffleAllLetters: false,
  shuffleGoldTiles: false,
  suppressHintPrompt: false,
};

export function emptyPersistedState(): PersistedAppState {
  return { version: 2, levels: {}, dailyResults: {}, hintPromptedLevels: {}, settings: defaultSettings };
}

export function loadPersistedState(storage: Pick<Storage, "getItem"> = localStorage): PersistedAppState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyPersistedState();
    const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
    if (parsed.version !== 2 || !parsed.levels || !parsed.dailyResults) return emptyPersistedState();
    return {
      version: 2,
      levels: parsed.levels,
      dailyResults: parsed.dailyResults,
      hintPromptedLevels: parsed.hintPromptedLevels ?? {},
      settings: { ...defaultSettings, ...parsed.settings },
    };
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
    usedHint: state.usedHint,
    history: state.history,
    elapsedMs: state.elapsedMs,
    splitElapsedMs: state.splitElapsedMs,
    goldElapsedMs: state.goldElapsedMs,
    firstSplitAt: previous?.firstSplitAt ?? null,
    firstSilverAt: previous?.firstSilverAt ?? null,
    firstGoldAt: previous?.firstGoldAt ?? null,
    perfectSplit: previous?.perfectSplit ?? false,
    licketySplit: previous?.licketySplit ?? false,
  };
}

export function awardVictoryBadges(
  progress: LevelProgress,
  scheduleDate: string,
  achievedAt: Date,
  newlyAchievedPerfectSplit: boolean,
): LevelProgress {
  if (!newlyAchievedPerfectSplit) return progress;
  return {
    ...progress,
    perfectSplit: progress.perfectSplit || !progress.usedHint,
    licketySplit: progress.licketySplit || scheduleDate === localDateKey(achievedAt),
  };
}
