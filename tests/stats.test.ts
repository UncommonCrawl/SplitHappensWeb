import { describe, expect, it } from "vitest";
import { calculateStats, formatDuration } from "../src/stats";

describe("daily stats", () => {
  it("calculates streaks, perfect splits, and average active time", () => {
    const stats = calculateStats({
      a: { date: "2026-08-22", levelID: "a", solvedOnReleaseDate: true, splitElapsedMs: 60_000, perfectSplit: true },
      b: { date: "2026-08-23", levelID: "b", solvedOnReleaseDate: true, splitElapsedMs: 120_000, perfectSplit: false },
      c: { date: "2026-08-24", levelID: "c", solvedOnReleaseDate: true, splitElapsedMs: 180_000, perfectSplit: true },
    }, new Date(2026, 7, 24, 12));
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
    expect(stats.perfectSplits).toBe(2);
    expect(formatDuration(stats.averageTimeMs)).toBe("2:00");
  });
});
