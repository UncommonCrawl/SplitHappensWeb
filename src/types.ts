export type TileID = `${number}:${number}`;
export type SlotID = `${number}:${number}`;

export interface GoldTileExpectation {
  rowIndex: number;
  columnIndex: number;
  letter: string;
}

export interface LevelDefinition {
  id: string;
  isActive: boolean;
  startingWords: string[];
  targetRowLengths: number[];
  answerRows: string[];
  criterion: string | null;
  goldTileExpectations: GoldTileExpectation[];
  goldWord: string;
  note: string;
}

export interface ScheduleEntry {
  date: string;
  levelID: string;
}

export interface ContentSnapshot {
  levelsVersion: number;
  scheduleVersion: number;
  levels: LevelDefinition[];
  schedule: ScheduleEntry[];
}

export interface Tile {
  id: TileID;
  character: string;
  sourceWordIndex: number;
  positionInWord: number;
}

export interface BoardSnapshot {
  sourceSlots: Array<Array<TileID | null>>;
  targetSlots: Array<Array<TileID | null>>;
}

export interface GameState extends BoardSnapshot {
  levelID: string;
  tiles: Record<TileID, Tile>;
  hintedRows: number[];
  history: BoardSnapshot[];
  elapsedMs: number;
  splitElapsedMs: number | null;
  goldElapsedMs: number | null;
}

export interface LevelProgress {
  sourceSlots: Array<Array<TileID | null>>;
  targetSlots: Array<Array<TileID | null>>;
  hintedRows: number[];
  history: BoardSnapshot[];
  elapsedMs: number;
  splitElapsedMs: number | null;
  goldElapsedMs: number | null;
  firstSplitAt: string | null;
  firstGoldAt: string | null;
  perfectSplit: boolean;
  licketySplit: boolean;
}

export interface DailyResult {
  date: string;
  levelID: string;
  solvedOnReleaseDate: boolean;
  splitElapsedMs: number;
  perfectSplit: boolean;
}

export interface WebSettings {
  soundEnabled: boolean;
  shuffleAllLetters: boolean;
  shuffleGoldTiles: boolean;
}

export interface PersistedAppState {
  version: 2;
  levels: Record<string, LevelProgress>;
  dailyResults: Record<string, DailyResult>;
  settings: WebSettings;
}

export interface UserStats {
  puzzlesSolved: number;
  perfectSplits: number;
  averageTimeMs: number;
  currentStreak: number;
  bestStreak: number;
}
