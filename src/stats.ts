import { localDateKey, parseLocalDate } from "./content";
import type { DailyResult, TierStats, UserStats } from "./types";

function calculateTier(
  values: DailyResult[],
  today: Date,
  completed: (result: DailyResult) => boolean,
  completedOnReleaseDate: (result: DailyResult) => boolean,
): TierStats {
  const dates = values.filter(completedOnReleaseDate).map((item) => item.date).sort();
  const unique = [...new Set(dates)];
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
  const achievedDates = new Set(unique);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!achievedDates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (achievedDates.has(localDateKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { currentStreak, bestStreak, completed: values.filter(completed).length };
}

export function calculateStats(results: Record<string, DailyResult>, today = new Date(), totalPuzzles?: number): UserStats {
  const values = Object.values(results).filter((result) => result.splitElapsedMs >= 0);
  const averageTimeMs = values.length ? values.reduce((sum, item) => sum + item.splitElapsedMs, 0) / values.length : 0;
  const normal = calculateTier(values, today, () => true, (item) => item.solvedOnReleaseDate);
  const hard = calculateTier(
    values,
    today,
    (item) => Boolean(item.hardOrHigher),
    (item) => Boolean(item.hardOnReleaseDate),
  );
  const perfect = calculateTier(
    values,
    today,
    (item) => Boolean(item.achievedPerfectSplit ?? item.perfectSplit),
    (item) => Boolean(item.perfectOnReleaseDate),
  );
  return {
    puzzlesSolved: values.length,
    averageTimeMs,
    currentStreak: normal.currentStreak,
    bestStreak: normal.bestStreak,
    totalPuzzles: totalPuzzles ?? values.length,
    tiers: { perfect, hard, normal },
  };
}

export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
