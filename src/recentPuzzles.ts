import { createGame, deriveGame } from "./engine";
import { localDateKey } from "./content";
import type { LevelDefinition, LevelProgress, ScheduleEntry } from "./types";

export type PuzzleTier = "none" | "bronze" | "silver" | "gold";

export function recentScheduleEntries(schedule: ScheduleEntry[], now: Date, count = 9, page = 0): ScheduleEntry[] {
  const released = schedule.filter((entry) => entry.date <= localDateKey(now));
  const end = Math.max(0, released.length - page * count);
  return released.slice(Math.max(0, end - count), end);
}

export function highestPuzzleTier(level: LevelDefinition, progress: LevelProgress | undefined, words: Set<string>): PuzzleTier {
  if (!progress) return "none";
  if (progress.firstGoldAt) return "gold";
  if (progress.firstSilverAt) return "silver";
  if (deriveGame(createGame(level, progress), level, words).silverSatisfied) return "silver";
  return progress.firstSplitAt ? "bronze" : "none";
}
