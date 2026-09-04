import { describe, expect, it } from "vitest";
import { calculateStats, formatDuration } from "../src/stats";

describe("daily stats", () => {
  it("calculates streaks and average active time", () => {
    const stats = calculateStats({
      a: { date: "2026-08-22", levelID: "a", solvedOnReleaseDate: true, splitElapsedMs: 60_000, perfectSplit: true },
      b: { date: "2026-08-23", levelID: "b", solvedOnReleaseDate: true, splitElapsedMs: 120_000, perfectSplit: false },
      c: { date: "2026-08-24", levelID: "c", solvedOnReleaseDate: true, splitElapsedMs: 180_000, perfectSplit: true },
    }, new Date(2026, 7, 24, 12));
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
    expect(stats.tiers.normal).toEqual({ currentStreak: 3, bestStreak: 3, completed: 3 });
    expect(stats.tiers.perfect.completed).toBe(2);
    expect(formatDuration(stats.averageTimeMs)).toBe("2:00");
  });

  it("calculates independent tier streaks and progress", () => {
    const stats = calculateStats({
      a: { date: "2026-08-22", levelID: "a", solvedOnReleaseDate: true, splitElapsedMs: 60_000, perfectSplit: true, hardOrHigher: true, hardOnReleaseDate: true, achievedPerfectSplit: true, perfectOnReleaseDate: true },
      b: { date: "2026-08-23", levelID: "b", solvedOnReleaseDate: true, splitElapsedMs: 90_000, perfectSplit: false, hardOrHigher: true, hardOnReleaseDate: true },
      c: { date: "2026-08-24", levelID: "c", solvedOnReleaseDate: true, splitElapsedMs: 120_000, perfectSplit: false },
    }, new Date(2026, 7, 24, 12), 10);

    expect(stats.tiers.perfect).toEqual({ currentStreak: 0, bestStreak: 1, completed: 1 });
    expect(stats.tiers.hard).toEqual({ currentStreak: 2, bestStreak: 2, completed: 2 });
    expect(stats.tiers.normal).toEqual({ currentStreak: 3, bestStreak: 3, completed: 3 });
    expect(stats.totalPuzzles).toBe(10);
  });
});
