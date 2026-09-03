import { createGame, deriveGame } from "./engine";
import { localDateKey } from "./content";
import type { LevelDefinition, LevelProgress, ScheduleEntry } from "./types";

export type PuzzleTier = "none" | "bronze" | "silver" | "gold";

export function recentScheduleEntries(schedule: ScheduleEntry[], now: Date, count = 9): ScheduleEntry[] {
  const entriesByDate = new Map(schedule.map((entry) => [entry.date, entry]));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (count - 1 - index));
    return entriesByDate.get(localDateKey(date));
  }).filter((entry): entry is ScheduleEntry => Boolean(entry));
}

export function highestPuzzleTier(level: LevelDefinition, progress: LevelProgress | undefined, words: Set<string>): PuzzleTier {
  if (!progress) return "none";
  if (progress.firstGoldAt) return "gold";
  if (progress.firstSilverAt) return "silver";
  if (deriveGame(createGame(level, progress), level, words).silverSatisfied) return "silver";
  return progress.firstSplitAt ? "bronze" : "none";
}
