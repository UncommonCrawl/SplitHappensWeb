import { describe, expect, it } from "vitest";
import { MAIN_TITLE, puzzleDocumentTitle, puzzleNumberForLevel, resolvePuzzleRoute } from "../src/routing";
import type { ScheduleEntry } from "../src/types";

const schedule: ScheduleEntry[] = [
  { date: "2026-09-01", levelID: "coffee" },
  { date: "2026-09-02", levelID: "cats" },
  { date: "2026-09-07", levelID: "part" },
  { date: "2026-09-08", levelID: "salmon" },
];

describe("puzzle routes", () => {
  it("uses the homepage as an alias for the daily puzzle", () => {
    expect(resolvePuzzleRoute("/", schedule, "2026-09-07")).toEqual({
      entry: schedule[2],
      puzzleNumber: null,
      canonicalPath: "/",
    });
  });

  it("maps numbered URLs to permanent schedule positions", () => {
    expect(resolvePuzzleRoute("/2", schedule, "2026-09-07")).toEqual({
      entry: schedule[1],
      puzzleNumber: 2,
      canonicalPath: "/2",
    });
    expect(puzzleNumberForLevel(schedule, "part")).toBe(3);
  });

  it("falls back to the homepage for invalid and unreleased routes", () => {
    expect(resolvePuzzleRoute("/4", schedule, "2026-09-07").canonicalPath).toBe("/");
    expect(resolvePuzzleRoute("/not-a-puzzle", schedule, "2026-09-07").canonicalPath).toBe("/");
  });

  it("formats main and puzzle document titles", () => {
    expect(MAIN_TITLE).toBe("Split Happens");
    expect(puzzleDocumentTitle(schedule[2], "PART")).toBe("September 7 - 'PART' | Split Happens");
  });
});
