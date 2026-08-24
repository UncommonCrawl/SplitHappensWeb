import { localDateKey, parseLocalDate } from "./content";
import type { DailyResult, UserStats } from "./types";

export function calculateStats(results: Record<string, DailyResult>, today = new Date()): UserStats {
  const values = Object.values(results).filter((result) => result.splitElapsedMs >= 0);
  const averageTimeMs = values.length ? values.reduce((sum, item) => sum + item.splitElapsedMs, 0) / values.length : 0;
  const onTimeDates = values.filter((item) => item.solvedOnReleaseDate).map((item) => item.date).sort();
  const unique = [...new Set(onTimeDates)];
  let bestStreak = 0;
  let running = 0;
  let previous: Date | null = null;
  for (const key of unique) {
    const date = parseLocalDate(key);
    const gap = previous ? Math.round((date.getTime() - previous.getTime()) / 86_400_000) : 1;
    running = gap === 1 ? running + 1 : 1;
    bestStreak = Math.max(bestStreak, running);
    previous = date;
  }
  let currentStreak = 0;
  const solved = new Set(unique);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!solved.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (solved.has(localDateKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    puzzlesSolved: values.length,
    perfectSplits: values.filter((item) => item.perfectSplit).length,
    averageTimeMs,
    currentStreak,
    bestStreak,
  };
}

export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
