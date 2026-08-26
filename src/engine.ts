import { evaluateCriterion } from "./criteria";
import type { BoardSnapshot, GameState, LevelDefinition, LevelProgress, SlotID, Tile, TileID } from "./types";

export type GameAction =
  | { type: "PLACE"; tileID: TileID; slotID: SlotID }
  | { type: "PLACE_RETURNING_DISPLACED"; tileID: TileID; slotID: SlotID }
  | { type: "MOVE_SOURCE"; tileID: TileID; row: number; column: number }
  | { type: "RETURN"; tileID: TileID }
  | { type: "RETURN_FIRST_FREE"; tileID: TileID }
  | { type: "RECALL" }
  | { type: "UNDO" }
  | { type: "HINT" }
  | { type: "SHUFFLE"; allLetters: boolean; includeGold: boolean }
  | { type: "TICK"; milliseconds: number };

function tileID(wordIndex: number, position: number): TileID {
  return `${wordIndex}:${position}`;
}

export function slotID(rowIndex: number, columnIndex: number): SlotID {
  return `${rowIndex}:${columnIndex}`;
}

export function createGame(level: LevelDefinition, progress?: LevelProgress): GameState {
  const tiles = {} as Record<TileID, Tile>;
  const initialSource = level.startingWords.map((word, wordIndex) =>
    [...word].map((character, positionInWord) => {
      const id = tileID(wordIndex, positionInWord);
      tiles[id] = { id, character, sourceWordIndex: wordIndex, positionInWord };
      return id;
    }),
  );
  const initialTarget = level.targetRowLengths.map((length) => Array<TileID | null>(length).fill(null));
  const validProgress = progress
    && progress.sourceSlots.flat().filter(Boolean).length + progress.targetSlots.flat().filter(Boolean).length === Object.keys(tiles).length
    && progress.targetSlots.length === initialTarget.length;
  return {
    levelID: level.id,
    tiles,
    sourceSlots: validProgress ? structuredClone(progress.sourceSlots) : initialSource,
    targetSlots: validProgress ? structuredClone(progress.targetSlots) : initialTarget,
    hintedRows: validProgress ? [...progress.hintedRows] : [],
    history: validProgress ? structuredClone(progress.history).slice(-20) : [],
    elapsedMs: validProgress ? progress.elapsedMs : 0,
    splitElapsedMs: validProgress ? progress.splitElapsedMs : null,
    goldElapsedMs: validProgress ? progress.goldElapsedMs : null,
  };
}

function snapshot(state: GameState): BoardSnapshot {
  return { sourceSlots: structuredClone(state.sourceSlots), targetSlots: structuredClone(state.targetSlots) };
}

function locate(state: GameState, id: TileID): { kind: "source" | "target"; row: number; column: number } | null {
  for (let row = 0; row < state.sourceSlots.length; row += 1) {
    const column = state.sourceSlots[row].indexOf(id);
    if (column >= 0) return { kind: "source", row, column };
  }
  for (let row = 0; row < state.targetSlots.length; row += 1) {
    const column = state.targetSlots[row].indexOf(id);
    if (column >= 0) return { kind: "target", row, column };
  }
  return null;
}

function isLocked(state: GameState, location: ReturnType<typeof locate>): boolean {
  return location?.kind === "target" && state.hintedRows.includes(location.row);
}

function pushHistory(state: GameState): GameState {
  return { ...state, history: [...state.history, snapshot(state)].slice(-20) };
}

function setLocation(state: GameState, location: NonNullable<ReturnType<typeof locate>>, value: TileID | null): void {
  if (location.kind === "source") state.sourceSlots[location.row][location.column] = value;
  else state.targetSlots[location.row][location.column] = value;
}

function firstEmptySource(state: GameState, preferred?: NonNullable<ReturnType<typeof locate>>): NonNullable<ReturnType<typeof locate>> | null {
  if (preferred?.kind === "source" && state.sourceSlots[preferred.row][preferred.column] === null) return preferred;
  for (let row = 0; row < state.sourceSlots.length; row += 1) {
    const column = state.sourceSlots[row].indexOf(null);
    if (column >= 0) return { kind: "source", row, column };
  }
  return null;
}

function place(state: GameState, id: TileID, targetID: SlotID): GameState {
  const [row, column] = targetID.split(":").map(Number);
  if (!state.targetSlots[row]?.hasOwnProperty(column) || state.hintedRows.includes(row)) return state;
  const origin = locate(state, id);
  if (!origin || isLocked(state, origin)) return state;
  if (origin.kind === "target" && origin.row === row && origin.column === column) return state;
  const next = pushHistory(structuredClone(state));
  const occupant = next.targetSlots[row][column];
  setLocation(next, origin, occupant);
  next.targetSlots[row][column] = id;
  return next;
}

function placeReturningDisplaced(state: GameState, id: TileID, targetID: SlotID): GameState {
  const [row, column] = targetID.split(":").map(Number);
  if (!state.targetSlots[row]?.hasOwnProperty(column) || state.hintedRows.includes(row)) return state;
  const origin = locate(state, id);
  if (!origin || isLocked(state, origin)) return state;

  const next = pushHistory(structuredClone(state));
  const occupant = next.targetSlots[row][column];
  setLocation(next, origin, null);

  // Typing the letter already in the selected slot returns it to the source board.
  if (origin.kind === "target" && origin.row === row && origin.column === column) {
    const destination = firstEmptySource(next);
    if (!destination) return state;
    setLocation(next, destination, id);
    return next;
  }

  next.targetSlots[row][column] = id;
  if (!occupant) return next;
  const destination = firstEmptySource(next);
  if (!destination) return state;
  setLocation(next, destination, occupant);
  return next;
}

function moveToSource(state: GameState, id: TileID, row: number, column: number): GameState {
  if (!state.sourceSlots[row]?.hasOwnProperty(column)) return state;
  const origin = locate(state, id);
  if (!origin || isLocked(state, origin)) return state;
  if (origin.kind === "source" && origin.row === row && origin.column === column) return state;
  const next = pushHistory(structuredClone(state));
  const occupant = next.sourceSlots[row][column];
  setLocation(next, origin, occupant);
  next.sourceSlots[row][column] = id;
  return next;
}

function returnToSource(state: GameState, id: TileID, preferOriginal = true): GameState {
  const origin = locate(state, id);
  if (!origin || origin.kind === "source" || isLocked(state, origin)) return state;
  const next = pushHistory(structuredClone(state));
  setLocation(next, origin, null);
  const original = { kind: "source" as const, row: next.tiles[id].sourceWordIndex, column: next.tiles[id].positionInWord };
  const destination = firstEmptySource(next, preferOriginal ? original : undefined);
  if (!destination) return state;
  setLocation(next, destination, id);
  return next;
}

function recall(state: GameState): GameState {
  const sourceSlots = state.sourceSlots.map((row) => Array<TileID | null>(row.length).fill(null));
  Object.values(state.tiles).forEach((tile) => {
    sourceSlots[tile.sourceWordIndex][tile.positionInWord] = tile.id;
  });
  const targetSlots = state.targetSlots.map((row) => Array<TileID | null>(row.length).fill(null));
  const changed = state.hintedRows.length > 0
    || JSON.stringify(state.sourceSlots) !== JSON.stringify(sourceSlots)
    || JSON.stringify(state.targetSlots) !== JSON.stringify(targetSlots);
  return changed ? { ...state, sourceSlots, targetSlots, hintedRows: [], history: [] } : state;
}

function hint(state: GameState, level: LevelDefinition): GameState {
  const row = state.hintedRows.length;
  if (!level.answerRows[row] || state.hintedRows.includes(row)) return state;
  const next = pushHistory(structuredClone(state));
  const lockedTiles = new Set<TileID>();
  next.hintedRows.forEach((lockedRow) => next.targetSlots[lockedRow].forEach((id) => id && lockedTiles.add(id)));
  const selected: TileID[] = [];
  for (const [column, character] of [...level.answerRows[row]].entries()) {
    const current = next.targetSlots[row][column];
    if (current && next.tiles[current].character === character && !selected.includes(current)) {
      selected.push(current);
      continue;
    }
    const candidate = Object.values(next.tiles).find((tile) =>
      tile.character === character && !lockedTiles.has(tile.id) && !selected.includes(tile.id));
    if (!candidate) return state;
    selected.push(candidate.id);
  }
  const displaced = new Set<TileID>();
  selected.forEach((id) => {
    const location = locate(next, id);
    if (location) setLocation(next, location, null);
  });
  next.targetSlots[row].forEach((id) => { if (id && !selected.includes(id)) displaced.add(id); });
  next.targetSlots[row] = selected;
  displaced.forEach((id) => {
    const destination = firstEmptySource(next, { kind: "source", row: next.tiles[id].sourceWordIndex, column: next.tiles[id].positionInWord });
    if (destination) setLocation(next, destination, id);
  });
  next.hintedRows.push(row);
  next.history = [];
  return next;
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function shuffle(state: GameState, level: LevelDefinition, words: Set<string>, allLetters: boolean, includeGold: boolean): GameState {
  let next = structuredClone(state);
  const derived = deriveGame(next, level, words);
  const protectedGold = new Set<TileID>();
  if (!includeGold) level.goldTileExpectations.forEach((expectation) => {
    const id = next.targetSlots[expectation.rowIndex]?.[expectation.columnIndex];
    if (id && next.tiles[id].character === expectation.letter) protectedGold.add(id);
  });
  const rowsToRecall = allLetters
    ? next.targetSlots.map((_, index) => index)
    : next.targetSlots.map((_, index) => index).filter((index) => !derived.validRows.has(index));
  const before = snapshot(next);
  rowsToRecall.forEach((row) => {
    if (next.hintedRows.includes(row)) return;
    next.targetSlots[row].forEach((id, column) => {
      if (!id || protectedGold.has(id)) return;
      next.targetSlots[row][column] = null;
      const destination = firstEmptySource(next);
      if (destination) setLocation(next, destination, id);
    });
  });
  const positions: Array<{ row: number; column: number }> = [];
  const ids: TileID[] = [];
  next.sourceSlots.forEach((row, rowIndex) => row.forEach((id, columnIndex) => {
    if (id) { positions.push({ row: rowIndex, column: columnIndex }); ids.push(id); }
  }));
  shuffled(ids).forEach((id, index) => { next.sourceSlots[positions[index].row][positions[index].column] = id; });
  if (JSON.stringify(before) === JSON.stringify(snapshot(next))) return state;
  next = { ...next, history: [...state.history, before].slice(-20) };
  return next;
}

export function gameReducer(level: LevelDefinition, words: Set<string>) {
  return (state: GameState, action: GameAction): GameState => {
    let next = state;
    switch (action.type) {
      case "PLACE": next = place(state, action.tileID, action.slotID); break;
      case "PLACE_RETURNING_DISPLACED": next = placeReturningDisplaced(state, action.tileID, action.slotID); break;
      case "MOVE_SOURCE": next = moveToSource(state, action.tileID, action.row, action.column); break;
      case "RETURN": next = returnToSource(state, action.tileID); break;
      case "RETURN_FIRST_FREE": next = returnToSource(state, action.tileID, false); break;
      case "RECALL": next = recall(state); break;
      case "HINT": next = hint(state, level); break;
      case "SHUFFLE": next = shuffle(state, level, words, action.allLetters, action.includeGold); break;
      case "UNDO": {
        const previous = state.history.at(-1);
        if (previous) next = { ...state, ...structuredClone(previous), history: state.history.slice(0, -1) };
        break;
      }
      case "TICK": next = { ...state, elapsedMs: state.elapsedMs + action.milliseconds }; break;
    }
    const derived = deriveGame(next, level, words);
    if (next.splitElapsedMs === null && derived.allWordsValid) next = { ...next, splitElapsedMs: next.elapsedMs };
    if (next.goldElapsedMs === null && derived.victorySatisfied) next = { ...next, goldElapsedMs: next.elapsedMs };
    return next;
  };
}

export function rowWords(state: GameState): Array<string | null> {
  return state.targetSlots.map((row) => {
    if (row.some((id) => id === null)) return null;
    return row.map((id) => state.tiles[id!].character).join("");
  });
}

export function deriveGame(state: GameState, level: LevelDefinition, words: Set<string>) {
  const rows = rowWords(state);
  const validRows = new Set(rows.flatMap((word, index) => word && words.has(word) ? [index] : []));
  const allWordsValid = validRows.size === rows.length;
  const bonus = evaluateCriterion(level.criterion, rows);
  const goldMatches = level.goldTileExpectations.map((expectation) => {
    const id = state.targetSlots[expectation.rowIndex]?.[expectation.columnIndex];
    return Boolean(id && state.tiles[id].character === expectation.letter);
  });
  const goldSatisfied = goldMatches.length > 0 && goldMatches.every(Boolean);
  const silverSatisfied = allWordsValid && bonus.satisfied;
  const victorySatisfied = silverSatisfied && goldSatisfied;
  return { rowWords: rows, validRows, allWordsValid, bonus, silverSatisfied, goldMatches, goldSatisfied, victorySatisfied };
}
