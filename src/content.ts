import { z } from "zod";
import type { ContentSnapshot, GoldTileExpectation, LevelDefinition, ScheduleEntry } from "./types";

const rawLevelSchema = z.object({
  ID: z.string().min(1),
  ACTIVE: z.boolean().optional(),
  SCHEDULED: z.boolean().optional(),
  SOURCE_WORD_COUNT: z.number().int().positive().optional(),
  SOURCE_WORD_LENGTHS: z.array(z.number().int().positive()).optional(),
  TARGET_ROW_COUNT: z.number().int().positive().optional(),
  TARGET_ROW_LENGTHS: z.array(z.number().int().positive()).optional(),
  source: z.array(z.string().min(1)),
  answers: z.array(z.string().min(1)),
  CRITERIA_2: z.string().optional(),
  GOLD_WORD: z.string().optional(),
  NOTE: z.string().optional(),
}).passthrough();

const levelsDocumentSchema = z.object({
  version: z.number().int().nonnegative(),
  levels: z.array(rawLevelSchema).min(1),
});

const scheduleDocumentSchema = z.object({
  version: z.number().int().nonnegative(),
  schedule: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ID: z.string() })),
});

function goldTiles(answer: string, rowIndex: number): GoldTileExpectation[] {
  const result: GoldTileExpectation[] = [];
  let visibleIndex = 0;
  let previous: { columnIndex: number; letter: string } | null = null;
  for (const character of answer.toUpperCase()) {
    if (character === "*") {
      if (previous) result.push({ rowIndex, ...previous });
    } else {
      previous = { columnIndex: visibleIndex, letter: character };
      visibleIndex += 1;
    }
  }
  return result;
}

export function normalizeLevel(raw: z.infer<typeof rawLevelSchema>): LevelDefinition {
  const startingWords = raw.source.map((word) => word.trim().toUpperCase());
  const answerRows = raw.answers.map((answer) => answer.replaceAll("*", "").trim().toUpperCase());
  const expectations = raw.answers.flatMap((answer, rowIndex) => goldTiles(answer, rowIndex));
  const sourceCount = startingWords.reduce((sum, word) => sum + word.length, 0);
  const targetCount = answerRows.reduce((sum, word) => sum + word.length, 0);
  if (sourceCount !== targetCount) throw new Error(`Level ${raw.ID} does not conserve letters.`);
  if (raw.TARGET_ROW_LENGTHS && raw.TARGET_ROW_LENGTHS.some((length, index) => answerRows[index]?.length !== length)) {
    throw new Error(`Level ${raw.ID} has inconsistent target row lengths.`);
  }
  const goldWord = raw.GOLD_WORD?.trim().toUpperCase() || expectations.map((item) => item.letter).join("");
  return {
    id: raw.ID,
    isActive: raw.ACTIVE ?? raw.SCHEDULED ?? true,
    startingWords,
    targetRowLengths: answerRows.map((word) => word.length),
    answerRows,
    criterion: raw.CRITERIA_2?.trim() || null,
    goldTileExpectations: expectations,
    goldWord,
    note: raw.NOTE?.trim() || "",
  };
}

async function fetchJSON(path: string): Promise<unknown> {
  const response = await fetch(staticAssetPath(path), { cache: "no-cache" });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
  return response.json();
}

export function staticAssetPath(path: string): string {
  return path;
}

export async function loadContent(): Promise<{ snapshot: ContentSnapshot; words: Set<string> }> {
  const [levelsJSON, scheduleJSON, wordsJSON] = await Promise.all([
    fetchJSON("/levels.json"),
    fetchJSON("/daily_schedule.json"),
    fetchJSON("/words.json"),
  ]);
  const levelsDocument = levelsDocumentSchema.parse(levelsJSON);
  const scheduleDocument = scheduleDocumentSchema.parse(scheduleJSON);
  const words = z.array(z.string()).parse(wordsJSON);
  const levels = levelsDocument.levels.map(normalizeLevel).filter((level) => level.isActive);
  const ids = new Set(levels.map((level) => level.id));
  const schedule: ScheduleEntry[] = scheduleDocument.schedule
    .filter((entry) => ids.has(entry.ID))
    .map((entry) => ({ date: entry.date, levelID: entry.ID }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    snapshot: {
      levelsVersion: levelsDocument.version,
      scheduleVersion: scheduleDocument.version,
      levels,
      schedule,
    },
    words: new Set(words.map((word) => word.toUpperCase())),
  };
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}
