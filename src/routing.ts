import type { ScheduleEntry } from "./types";

export const MAIN_TITLE = "Split Happens";

export type PuzzleRoute = {
  entry: ScheduleEntry | null;
  puzzleNumber: number | null;
  canonicalPath: string;
};

function dailyEntry(schedule: ScheduleEntry[], today: string): ScheduleEntry | null {
  return schedule.find((entry) => entry.date === today)
    ?? schedule.filter((entry) => entry.date <= today).at(-1)
    ?? null;
}

export function resolvePuzzleRoute(pathname: string, schedule: ScheduleEntry[], today: string): PuzzleRoute {
  if (pathname === "/") {
    return { entry: dailyEntry(schedule, today), puzzleNumber: null, canonicalPath: "/" };
  }

  const match = pathname.match(/^\/([1-9]\d*)\/?$/);
  const puzzleNumber = match ? Number(match[1]) : 0;
  const entry = schedule[puzzleNumber - 1];
  if (entry && entry.date <= today) {
    return { entry, puzzleNumber, canonicalPath: `/${puzzleNumber}` };
  }

  return { entry: dailyEntry(schedule, today), puzzleNumber: null, canonicalPath: "/" };
}

export function puzzleNumberForLevel(schedule: ScheduleEntry[], levelID: string): number | null {
  const index = schedule.findIndex((entry) => entry.levelID === levelID);
  return index < 0 ? null : index + 1;
}

export function puzzleDocumentTitle(entry: ScheduleEntry, goldWord: string): string {
  const [, month, day] = entry.date.split("-").map(Number);
  const monthName = new Date(2000, month - 1, 1).toLocaleDateString("en-US", { month: "long" });
  return `${monthName} ${day} - '${goldWord}' | ${MAIN_TITLE}`;
}
