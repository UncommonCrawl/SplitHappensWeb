import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, ChartNoAxesColumn, Flame, HelpCircle, Lightbulb, Lock,
  Menu, RotateCcw, Share2, Trophy, Undo2, Volume2, VolumeX, X,
} from "lucide-react";
import { loadContent, localDateKey, parseLocalDate, staticAssetPath } from "./content";
import { createGame, deriveGame, gameReducer, slotID, type GameAction } from "./engine";
import { loadPersistedState, progressFromGame, savePersistedState } from "./persistence";
import { highestPuzzleTier, recentScheduleEntries } from "./recentPuzzles";
import { calculateStats, formatDuration } from "./stats";
import type { ContentSnapshot, GameState, LevelDefinition, PersistedAppState, SlotID, TileID } from "./types";

type ModalName = "how" | "stats" | "victory" | null;

type DragState = {
  tileID: TileID;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: string;
  fromTarget: boolean;
  grabOffsetX: number;
  grabOffsetY: number;
  tileClassName: string;
  moved: boolean;
};

type DragHover =
  | { kind: "target"; slotID: SlotID }
  | { kind: "source"; row: number; column: number };

function Seal({ tone, achieved = false, satisfied = false }: { tone: "bronze" | "silver" | "gold"; achieved?: boolean; satisfied?: boolean }) {
  return (
    <span className={`seal ${tone} ${achieved ? "achieved" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" role="img">
        <path className="seal-fill" d="M50 4C57 4 60 12 66 14C72 16 79 11 84 16C89 21 84 28 86 34C88 40 96 43 96 50C96 57 88 60 86 66C84 72 89 79 84 84C79 89 72 84 66 86C60 88 57 96 50 96C43 96 40 88 34 86C28 84 21 89 16 84C11 79 16 72 14 66C12 60 4 57 4 50C4 43 12 40 14 34C16 28 11 21 16 16C21 11 28 16 34 14C40 12 43 4 50 4Z" />
        {satisfied &&
          <path className="seal-outline" d="M50 4C57 4 60 12 66 14C72 16 79 11 84 16C89 21 84 28 86 34C88 40 96 43 96 50C96 57 88 60 86 66C84 72 89 79 84 84C79 89 72 84 66 86C60 88 57 96 50 96C43 96 40 88 34 86C28 84 21 89 16 84C11 79 16 72 14 66C12 60 4 57 4 50C4 43 12 40 14 34C16 28 11 21 16 16C21 11 28 16 34 14C40 12 43 4 50 4Z" />
        }
        {achieved && <path className="seal-check" d="M29 51L43 65L72 35" />}
      </svg>
    </span>
  );
}

function ordinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  return `${day}${day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th"}`;
}

function longDate(date: Date): string {
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const month = date.toLocaleDateString(undefined, { month: "long" });
  return `${weekday}, ${month} ${ordinal(date.getDate())}`;
}

const MONTH_ABBREVIATIONS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X /></button>
        <h2 id="modal-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}

function LoadingScreen({ error, retry }: { error?: string; retry?: () => void }) {
  return (
    <main className="loading-screen">
      <img src={staticAssetPath("/images/title.png")} alt="Split Happens" />
      {error ? <><p>{error}</p><button className="primary-button" onClick={retry}>Try again</button></> : <><div className="loader" /><p>Preparing today’s split…</p></>}
    </main>
  );
}

export default function App() {
  const [content, setContent] = useState<ContentSnapshot | null>(null);
  const [words, setWords] = useState<Set<string> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<PersistedAppState>(() => loadPersistedState());
  const [activeLevelID, setActiveLevelID] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedTile, setSelectedTile] = useState<TileID | null>(null);
  const [selectedTargetSlot, setSelectedTargetSlot] = useState<SlotID | null>(null);
  const [modal, setModal] = useState<ModalName>(null);
  const [now, setNow] = useState(new Date());
  const [toast, setToast] = useState<string | null>(null);
  const [archivePage, setArchivePage] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isConstrained, setIsConstrained] = useState(() => window.matchMedia("(max-width: 1050px)").matches);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragHover, setDragHover] = useState<DragHover | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const previousGold = useRef(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const refreshContent = useCallback(() => {
    setLoadError(null);
    loadContent().then(({ snapshot, words: loadedWords }) => {
      setContent(snapshot);
      setWords(loadedWords);
      const today = localDateKey();
      const released = snapshot.schedule.filter((entry) => entry.date <= today);
      const selected = snapshot.schedule.find((entry) => entry.date === today) ?? released.at(-1);
      setActiveLevelID(selected?.levelID ?? null);
    }).catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "The puzzles could not be loaded."));
  }, []);

  useEffect(refreshContent, [refreshContent]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1050px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsConstrained(event.matches);
      if (!event.matches) setDrawerOpen(false);
    };
    setIsConstrained(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const closeDrawer = useCallback((restoreFocus = true) => {
    setDrawerOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => hamburgerRef.current?.focus());
  }, []);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (drawer) drawer.inert = isConstrained && !drawerOpen;
    if (!drawerOpen || !isConstrained) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>("button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])") ?? []);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => focusable()[0]?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDrawer, drawerOpen, isConstrained]);

  const activeLevel = useMemo(() => content?.levels.find((level) => level.id === activeLevelID) ?? null, [content, activeLevelID]);
  const scheduleEntry = useMemo(() => content?.schedule.find((entry) => entry.levelID === activeLevelID) ?? null, [content, activeLevelID]);
  const releasedEntries = useMemo(() => content?.schedule.filter((entry) => entry.date <= localDateKey(now)) ?? [], [content, now]);
  const recentEntries = useMemo(() => recentScheduleEntries(content?.schedule ?? [], now, 9, archivePage), [content, now, archivePage]);
  const hasPreviousPage = releasedEntries.length > (archivePage + 1) * 9;
  const hasNextPage = archivePage > 0;

  useEffect(() => {
    if (!activeLevel || !words) return;
    setGame(createGame(activeLevel, persisted.levels[activeLevel.id]));
    setSelectedTile(null);
    setSelectedTargetSlot(null);
    previousGold.current = Boolean(persisted.levels[activeLevel.id]?.firstGoldAt);
  // Persisted state is intentionally read only when a level is opened.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLevel?.id, words]);

  useEffect(() => {
    if (!content || !words) return;
    setPersisted((current) => {
      let changed = false;
      const levels = { ...current.levels };
      const timestamp = new Date().toISOString();
      Object.entries(current.levels).forEach(([levelID, progress]) => {
        if (progress.firstSilverAt || progress.firstGoldAt) return;
        const level = content.levels.find((item) => item.id === levelID);
        if (!level || highestPuzzleTier(level, progress, words) !== "silver") return;
        levels[levelID] = { ...progress, firstSilverAt: timestamp };
        changed = true;
      });
      if (!changed) return current;
      const next = { ...current, levels };
      savePersistedState(next);
      return next;
    });
  }, [content, words]);

  const derived = useMemo(() => game && activeLevel && words ? deriveGame(game, activeLevel, words) : null, [game, activeLevel, words]);

  const send = useCallback((action: GameAction) => {
    if (!activeLevel || !words) return;
    setGame((current) => current ? gameReducer(activeLevel, words)(current, action) : current);
  }, [activeLevel, words]);

  useEffect(() => {
    if (!game || !activeLevel || !derived || !scheduleEntry) return;
    setPersisted((current) => {
      const previous = current.levels[activeLevel.id];
      const progress = progressFromGame(game, previous);
      const timestamp = new Date().toISOString();
      if (derived.allWordsValid && !progress.firstSplitAt) progress.firstSplitAt = timestamp;
      if (derived.silverSatisfied && !progress.firstSilverAt) progress.firstSilverAt = timestamp;
      if (derived.victorySatisfied && !progress.firstGoldAt) progress.firstGoldAt = timestamp;
      progress.perfectSplit = Boolean(derived.victorySatisfied && game.hintedRows.length === 0);
      progress.licketySplit = Boolean(derived.victorySatisfied && scheduleEntry.date === localDateKey());
      const dailyResults = { ...current.dailyResults };
      if (derived.allWordsValid && game.splitElapsedMs !== null) {
        dailyResults[scheduleEntry.date] = {
          date: scheduleEntry.date,
          levelID: activeLevel.id,
          solvedOnReleaseDate: scheduleEntry.date === localDateKey(new Date(progress.firstSplitAt!)),
          splitElapsedMs: game.splitElapsedMs,
          perfectSplit: progress.perfectSplit,
        };
      }
      const next = { ...current, levels: { ...current.levels, [activeLevel.id]: progress }, dailyResults };
      savePersistedState(next);
      return next;
    });
    if (derived.victorySatisfied && !previousGold.current) {
      previousGold.current = true;
      setModal("victory");
      if (persisted.settings.soundEnabled) new Audio(staticAssetPath("/sounds/victory.mp3")).play().catch(() => undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, activeLevel?.id, scheduleEntry?.date, derived?.allWordsValid, derived?.victorySatisfied]);

  useEffect(() => {
    if (!game || derived?.victorySatisfied) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") send({ type: "TICK", milliseconds: 1000 });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [game?.levelID, derived?.victorySatisfied, send]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(() => calculateStats(persisted.dailyResults, now), [persisted.dailyResults, now]);
  const playPlacementSound = () => {
    if (persisted.settings.soundEnabled) new Audio(staticAssetPath("/sounds/tile-place.wav")).play().catch(() => undefined);
  };

  const placeSelected = (target: `${number}:${number}`) => {
    if (!selectedTile) return;
    send({ type: "PLACE", tileID: selectedTile, slotID: target });
    playPlacementSound();
    setSelectedTile(null);
    setSelectedTargetSlot(null);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!game || event.altKey || event.ctrlKey || event.metaKey) return;

      if (event.key === "Backspace") {
        event.preventDefault();
        if (selectedTile) {
          clearSelection();
          return;
        }

        const selectedTargetTile = selectedTargetSlot && (() => {
          const [row, column] = selectedTargetSlot.split(":").map(Number);
          return game.hintedRows.includes(row) ? null : game.targetSlots[row]?.[column] ?? null;
        })();
        const lastTargetTile = game.targetSlots.flatMap((row, rowIndex) => row.map((id, columnIndex) => ({ id, rowIndex, columnIndex })))
          .reverse()
          .find(({ id, rowIndex }) => id && !game.hintedRows.includes(rowIndex))?.id;
        const tileID = selectedTargetTile || lastTargetTile;
        if (tileID) {
          send({ type: "RETURN", tileID });
          playPlacementSound();
        }
        clearSelection();
        return;
      }

      if (event.key.length !== 1) return;
      const letter = event.key.toUpperCase();
      if (!/^[A-Z]$/.test(letter)) return;

      if (!selectedTargetSlot && !selectedTile) {
        const sourceTile = game.sourceSlots.flat().find((id) => id && game.tiles[id].character === letter);
        const target = game.targetSlots.flatMap((row, rowIndex) => row.map((id, columnIndex) => ({ id, slotID: slotID(rowIndex, columnIndex), rowIndex }))).find(({ id, rowIndex }) =>
          !id && !game.hintedRows.includes(rowIndex),
        );
        if (sourceTile && target) {
          send({ type: "PLACE", tileID: sourceTile, slotID: target.slotID });
          playPlacementSound();
        }
        return;
      }

      if (!selectedTargetSlot) return;
      const [selectedRow] = selectedTargetSlot.split(":").map(Number);
      if (game.hintedRows.includes(selectedRow)) {
        clearSelection();
        return;
      }

      const sourceTile = game.sourceSlots.flat().find((id) => id && game.tiles[id].character === letter);
      const hasSourceTiles = game.sourceSlots.some((row) => row.some(Boolean));
      const targetTile = !hasSourceTiles
        ? game.targetSlots.flatMap((row, rowIndex) => row.map((id) => ({ id, rowIndex }))).find(({ id, rowIndex }) =>
          id && game.tiles[id].character === letter && !game.hintedRows.includes(rowIndex),
        )?.id
        : undefined;
      const tileID = sourceTile ?? targetTile;
      if (tileID) {
        send({ type: "PLACE_RETURNING_DISPLACED", tileID, slotID: selectedTargetSlot });
        playPlacementSound();
      }
      clearSelection();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game, selectedTile, selectedTargetSlot, send]);

  const handleTileClick = (id: TileID) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (selectedTargetSlot) {
      send({ type: "PLACE", tileID: id, slotID: selectedTargetSlot });
      playPlacementSound();
      setSelectedTargetSlot(null);
      return;
    }
    setSelectedTile((current) => current === id ? null : id);
  };

  const handleSourceTileClick = (id: TileID, row: number, column: number) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (selectedTargetSlot) {
      send({ type: "PLACE", tileID: id, slotID: selectedTargetSlot });
      playPlacementSound();
      clearSelection();
      return;
    }
    if (selectedTile && selectedTile !== id) {
      send({ type: "MOVE_SOURCE", tileID: selectedTile, row, column });
      playPlacementSound();
      clearSelection();
      return;
    }
    setSelectedTile((current) => current === id ? null : id);
  };

  const handleSourceTileDoubleClick = (id: TileID) => {
    if (!game) return;
    const target = game.targetSlots
      .flatMap((row, rowIndex) => row.map((occupant, columnIndex) => ({ occupant, rowIndex, columnIndex })))
      .find(({ occupant, rowIndex }) => !occupant && !game.hintedRows.includes(rowIndex));
    if (!target) return;

    send({ type: "PLACE", tileID: id, slotID: slotID(target.rowIndex, target.columnIndex) });
    playPlacementSound();
    clearSelection();
  };

  const handleEmptyTargetClick = (target: SlotID) => {
    if (selectedTile) {
      placeSelected(target);
      return;
    }
    // A second empty target is a cancellation, not a new destination.
    setSelectedTargetSlot((current) => current ? null : target);
  };

  const handleOccupiedTargetClick = (id: TileID, target: SlotID) => {
    if (selectedTile) {
      placeSelected(target);
      return;
    }
    if (selectedTargetSlot) {
      if (selectedTargetSlot === target) setSelectedTargetSlot(null);
      else handleTileClick(id);
      return;
    }
    setSelectedTargetSlot(target);
  };

  const handleEmptySourceClick = (row: number, column: number) => {
    if (!game) return;
    let tileID = selectedTile;
    if (!tileID && selectedTargetSlot) {
      const [targetRow, targetColumn] = selectedTargetSlot.split(":").map(Number);
      tileID = game.hintedRows.includes(targetRow) ? null : game.targetSlots[targetRow]?.[targetColumn] ?? null;
    }
    if (!tileID) return;

    send({ type: "MOVE_SOURCE", tileID, row, column });
    playPlacementSound();
    clearSelection();
  };

  const clearSelection = () => {
    setSelectedTile(null);
    setSelectedTargetSlot(null);
  };

  const handlePointerDown = (event: ReactPointerEvent, id: TileID) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const tile = event.currentTarget as HTMLElement;
    const bounds = tile.getBoundingClientRect();
    const targetTile = document.querySelector<HTMLElement>(".target-slot");
    const targetBounds = targetTile?.getBoundingClientRect() ?? bounds;
    const grabRatioX = (event.clientX - bounds.left) / bounds.width;
    const grabRatioY = (event.clientY - bounds.top) / bounds.height;
    const tileClassName = [...tile.classList]
      .filter((className) => !["letter-tile", "selected", "drag-origin", "drop-hover"].includes(className))
      .concat(tile.classList.contains("letter-tile") ? ["target-slot", "occupied"] : [])
      .join(" ");
    dragStart.current = { x: event.clientX, y: event.clientY };
    setDrag({
      tileID: id,
      left: event.clientX - targetBounds.width * grabRatioX,
      top: event.clientY - targetBounds.height * grabRatioY,
      width: targetBounds.width,
      height: targetBounds.height,
      fontSize: getComputedStyle(targetTile ?? tile).fontSize,
      fromTarget: tile.classList.contains("target-slot"),
      grabOffsetX: targetBounds.width * grabRatioX,
      grabOffsetY: targetBounds.height * grabRatioY,
      tileClassName,
      moved: false,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent) => {
    if (!drag || !dragStart.current) return;
    const moved = drag.moved || Math.hypot(event.clientX - dragStart.current.x, event.clientY - dragStart.current.y) > 6;
    if (moved && !drag.moved && (selectedTile || selectedTargetSlot)) clearSelection();
    setDrag({
      ...drag,
      left: event.clientX - drag.grabOffsetX,
      top: event.clientY - drag.grabOffsetY,
      moved,
    });
    if (moved) {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const target = hit?.closest<HTMLElement>("[data-slot-id]");
      const sourceSlot = hit?.closest<HTMLElement>("[data-source-row][data-source-column]");
      if (target?.dataset.slotId) {
        setDragHover({ kind: "target", slotID: target.dataset.slotId as SlotID });
      } else if (sourceSlot?.dataset.sourceRow !== undefined && sourceSlot.dataset.sourceColumn !== undefined) {
        setDragHover({
          kind: "source",
          row: Number(sourceSlot.dataset.sourceRow),
          column: Number(sourceSlot.dataset.sourceColumn),
        });
      } else {
        setDragHover(null);
      }
    }
  };

  const handlePointerUp = (event: ReactPointerEvent) => {
    if (!drag) return;
    if (drag.moved) {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const target = hit?.closest<HTMLElement>("[data-slot-id]");
      const sourceSlot = hit?.closest<HTMLElement>("[data-source-row][data-source-column]");
      const source = hit?.closest<HTMLElement>("[data-source-board]");
      if (target?.dataset.slotId) {
        send({ type: "PLACE", tileID: drag.tileID, slotID: target.dataset.slotId as `${number}:${number}` });
        playPlacementSound();
      } else if (sourceSlot?.dataset.sourceRow !== undefined && sourceSlot.dataset.sourceColumn !== undefined) {
        send({
          type: "MOVE_SOURCE",
          tileID: drag.tileID,
          row: Number(sourceSlot.dataset.sourceRow),
          column: Number(sourceSlot.dataset.sourceColumn),
        });
        playPlacementSound();
      } else if (source && drag.fromTarget) {
        send({ type: "RETURN_FIRST_FREE", tileID: drag.tileID });
        playPlacementSound();
      } else if (source) send({ type: "RETURN", tileID: drag.tileID });
      suppressClick.current = true;
    }
    setDrag(null);
    setDragHover(null);
    dragStart.current = null;
  };

  const updateSettings = (changes: Partial<PersistedAppState["settings"]>) => {
    setPersisted((current) => {
      const next = { ...current, settings: { ...current.settings, ...changes } };
      savePersistedState(next);
      return next;
    });
  };

  const shareResult = async () => {
    if (!activeLevel || !derived) return;
    const seals = [derived.allWordsValid, derived.silverSatisfied, derived.victorySatisfied].map((done) => done ? "🟨" : "⬜").join("");
    const text = `Split Happens — ${scheduleEntry?.date ?? "Puzzle"}\n${seals}\n${formatDuration(game?.elapsedMs ?? 0)}`;
    try {
      if (navigator.share) await navigator.share({ title: "Split Happens", text });
      else { await navigator.clipboard.writeText(text); setToast("Result copied to clipboard"); }
    } catch { /* User cancelled sharing. */ }
  };

  if (loadError) return <LoadingScreen error={loadError} retry={refreshContent} />;
  if (!content || !words || !activeLevel || !game || !derived || !scheduleEntry) return <LoadingScreen />;

  const selectedDate = parseLocalDate(scheduleEntry.date);
  const savedProgress = persisted.levels[activeLevel.id];
  const normalAchieved = derived.allWordsValid || Boolean(
    savedProgress?.firstSplitAt || savedProgress?.firstSilverAt || savedProgress?.firstGoldAt,
  );
  const hardAchieved = derived.silverSatisfied || Boolean(savedProgress?.firstSilverAt || savedProgress?.firstGoldAt);
  const goldAchieved = derived.victorySatisfied || Boolean(savedProgress?.firstGoldAt);
  const hardUnlocked = normalAchieved;
  const goldUnlocked = hardAchieved;
  const goldLevelReached = goldUnlocked;
  const goldSlots = new Set(activeLevel.goldTileExpectations.map((item) => slotID(item.rowIndex, item.columnIndex)));
  const goldExpectations = new Map(activeLevel.goldTileExpectations.map((item) => [slotID(item.rowIndex, item.columnIndex), item.letter]));
  const achievementTiers = [
    { name: "Normal", tone: "bronze" as const, unlocked: true, achieved: normalAchieved, satisfied: derived.allWordsValid },
    { name: "Hard", tone: "silver" as const, unlocked: hardUnlocked, achieved: hardAchieved, satisfied: hardUnlocked && derived.bonus.satisfied },
    { name: "Perfect Split", tone: "gold" as const, unlocked: goldUnlocked, achieved: goldAchieved, satisfied: goldUnlocked && derived.goldSatisfied },
  ];
  const activeTierIndex = goldUnlocked ? 2 : hardUnlocked ? 1 : 0;
  const criterionLines = [
    {
      name: "Normal",
      unlocked: true,
      met: derived.allWordsValid,
      content: <>REARRANGE ALL LETTERS INTO VALID ENGLISH WORDS</>,
    },
    {
      name: "Hard",
      unlocked: hardUnlocked,
      met: derived.bonus.satisfied,
      content: <>{derived.bonus.label}</>,
    },
    {
      name: "Perfect Split",
      unlocked: goldUnlocked,
      met: derived.goldSatisfied,
      content: <>HIGHLIGHTED TILES SPELL <span className="gold-word">{[...activeLevel.goldWord].map((letter, index) => <em className={derived.goldMatches[index] ? "correct" : ""} key={`${letter}-${index}`}>{letter}</em>)}</span> IN ORDER.</>,
    },
  ];
  const canRecall = game.hintedRows.length > 0
    || game.targetSlots.some((row) => row.some(Boolean))
    || game.sourceSlots.some((row, rowIndex) => row.some((id, columnIndex) => {
      if (!id) return true;
      const tile = game.tiles[id];
      return tile.sourceWordIndex !== rowIndex || tile.positionInWord !== columnIndex;
    }));
  const targetSizingRows = Math.max(5, game.targetSlots.length);
  const gameLayoutStyle = {
    "--target-columns": Math.max(...game.targetSlots.map((row) => row.length)),
    "--source-columns": Math.max(...game.sourceSlots.map((row) => row.length)),
    "--target-height-limit": `calc(${45 / targetSizingRows}cqh - 0.5px)`,
    "--target-compact-height-limit": `calc(${36 / targetSizingRows}cqh - 0.5px)`,
    "--source-height-limit": `${18.75 / game.sourceSlots.length}cqh`,
  } as CSSProperties;
  const handleSidebarAction = (action: () => void) => {
    action();
    if (isConstrained) closeDrawer();
  };
  const handlePuzzleSelection = (levelID: string) => {
    setActiveLevelID(levelID);
    if (isConstrained) closeDrawer();
  };
  return (
    <div className="app-shell">
      <header className="mobile-header">
        <button
          ref={hamburgerRef}
          className="mobile-menu-button"
          aria-label="Open sidebar menu"
          aria-controls="sidebar-menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        ><Menu /></button>
        <div className="mobile-brand">
          <img src={staticAssetPath("/images/title.png")} alt="Split Happens" className="mobile-wordmark" />
          <h1>{longDate(selectedDate)}</h1>
        </div>
        <span className="mobile-header-spacer" aria-hidden="true" />
      </header>

      {isConstrained && drawerOpen && <button className="drawer-backdrop" aria-label="Close sidebar menu" onClick={() => closeDrawer()} />}

      <aside
        ref={drawerRef}
        id="sidebar-menu"
        className={`app-sidebar progress-rail ${drawerOpen ? "drawer-open" : ""}`}
        role={isConstrained ? "dialog" : undefined}
        aria-modal={isConstrained && drawerOpen ? "true" : undefined}
        aria-label={isConstrained ? "Sidebar menu" : "Game sidebar"}
        aria-hidden={isConstrained && !drawerOpen ? "true" : undefined}
      >
        <button className="drawer-close" aria-label="Close sidebar menu" onClick={() => closeDrawer()}><X /></button>
        <header className="sidebar-brand">
          <img src={staticAssetPath("/images/title.png")} alt="Split Happens" className="wordmark" />
          <h1>{longDate(selectedDate)}</h1>
        </header>

        <nav className="sidebar-actions" aria-label="Game actions">
          <button aria-label="How to Play" onClick={() => handleSidebarAction(() => setModal("how"))}><HelpCircle /><span>How to Play</span></button>
          <button aria-label="Stats" onClick={() => handleSidebarAction(() => setModal("stats"))}><ChartNoAxesColumn /><span>Stats</span></button>
          <button
            onClick={() => handleSidebarAction(() => updateSettings({ soundEnabled: !persisted.settings.soundEnabled }))}
            aria-label={persisted.settings.soundEnabled ? "Turn sound off" : "Turn sound on"}
            aria-pressed={persisted.settings.soundEnabled}
          >
            {persisted.settings.soundEnabled ? <Volume2 /> : <VolumeX />}
            <span>Sound</span>
          </button>
        </nav>

        <section className="sidebar-stats">
          <h2>Recent puzzles</h2>
          <div className="puzzle-date-grid" aria-label="Recent puzzles">
            {Array.from({ length: 9 - recentEntries.length }, (_, index) => <span className="puzzle-date-placeholder" aria-hidden="true" key={`placeholder-${index}`} />)}
            {recentEntries.map((entry) => {
              const date = parseLocalDate(entry.date);
              const level = content.levels.find((item) => item.id === entry.levelID);
              const today = entry.date === localDateKey(now);
              const tier = level ? highestPuzzleTier(level, persisted.levels[entry.levelID], words) : "none";
              const tierLabel = tier === "none" ? "not completed" : `${tier} tier`;
              return <button
                key={entry.date}
                className={`puzzle-date-button tier-${tier}`}
                data-date={entry.date}
                aria-label={`${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}, ${today ? "today's puzzle" : tierLabel}`}
                aria-pressed={entry.levelID === activeLevel.id}
                onClick={() => handlePuzzleSelection(entry.levelID)}
              >
                <span className="puzzle-date-month">{MONTH_ABBREVIATIONS[date.getMonth()]}</span>
                <strong className="puzzle-date-day">{date.getDate()}</strong>
              </button>;
            })}
          </div>
          <div className="puzzle-pagination" aria-label="Archive navigation">
            <button className="archive-button" disabled={!hasPreviousPage} onClick={() => setArchivePage((page) => page + 1)}><ArrowLeft /><span>Prev.</span></button>
            <button className="archive-button" disabled={!hasNextPage} onClick={() => setArchivePage((page) => Math.max(0, page - 1))}><span>Next</span><ArrowRight /></button>
          </div>
        </section>
      </aside>

      <div className="workspace">
        <main
          className="game-area"
          style={gameLayoutStyle}
          onClick={(event) => {
            const target = event.target;
            if (target instanceof Element && !target.closest("button.tile")) clearSelection();
          }}
        >
          <section className="criteria" aria-label="Puzzle goals">
            <div className="achievement-track" role="list" aria-label="Normal, Hard, Perfect Split progression">
              {achievementTiers.map((tier, index) => <Fragment key={tier.name}>
                {index > 0 && <span className={`tier-connector ${tier.unlocked ? "complete" : ""}`} aria-hidden="true" />}
                <div
                  className={`tier-step tier-${tier.tone} ${tier.unlocked ? "unlocked" : "future"} ${tier.achieved ? "complete" : ""} ${tier.satisfied ? "satisfied" : ""} ${index === activeTierIndex ? "active" : ""}`}
                  role="listitem"
                  aria-current={index === activeTierIndex ? "step" : undefined}
                  aria-label={`${tier.name}: ${tier.achieved ? `achieved, ${tier.satisfied ? "currently satisfied" : "not currently satisfied"}` : tier.unlocked ? "unlocked, not currently satisfied" : "not yet available"}`}
                >
                  <span className="tier-seal">
                    <Seal tone={tier.tone} achieved={tier.achieved} satisfied={tier.satisfied} />
                    {!tier.unlocked && <Lock className="tier-lock" aria-hidden="true" />}
                  </span>
                  <strong>{tier.name}</strong>
                </div>
              </Fragment>)}
            </div>
            <div className="tier-objective" aria-live="polite" aria-label="Puzzle criteria">
              {criterionLines.map((criterion) => <div
                className={`criterion-line ${criterion.unlocked ? criterion.met ? "met" : "active-goal" : "locked"}`}
                aria-hidden={!criterion.unlocked}
                key={criterion.name}
              >{criterion.content}</div>)}
            </div>
          </section>

          <section className="target-board" aria-label="Target words">
            {game.targetSlots.map((row, rowIndex) => {
              const nextRow = game.targetSlots[rowIndex + 1];
              const dividerSlots = nextRow ? Math.min(row.length, nextRow.length) : undefined;
              const dividerStyle = dividerSlots === undefined ? undefined : {
                "--divider-slots": dividerSlots,
              } as CSSProperties;

              return (
                <div
                  className="target-row"
                  key={rowIndex}
                  data-divider-slots={dividerSlots}
                  style={dividerStyle}
                >
                  {row.map((id, columnIndex) => {
                    const target = slotID(rowIndex, columnIndex);
                    const locked = game.hintedRows.includes(rowIndex);
                    const rowComplete = row.every(Boolean);
                    const rowValid = derived.validRows.has(rowIndex);
                    const isGoldSlot = goldLevelReached && goldSlots.has(target);
                    const correctGold = Boolean(id && isGoldSlot && game.tiles[id].character === goldExpectations.get(target));
                    return (
                      <button
                        className={`target-slot tile ${id ? "occupied" : "empty"} ${rowComplete ? rowValid ? "row-valid" : "row-invalid" : ""} ${isGoldSlot ? "gold-slot" : ""} ${correctGold ? "correct-gold" : ""} ${selectedTargetSlot === target ? "selected" : ""} ${locked ? "hint-locked" : ""} ${drag?.moved && drag.tileID === id ? "drag-origin" : ""} ${dragHover?.kind === "target" && dragHover.slotID === target ? "drop-hover" : ""}`}
                        key={target}
                        data-slot-id={target}
                        disabled={locked}
                        aria-label={`Row ${rowIndex + 1}, position ${columnIndex + 1}${id ? `, letter ${game.tiles[id].character}` : ", empty"}`}
                        onClick={() => {
                          if (suppressClick.current) {
                            suppressClick.current = false;
                            return;
                          }
                          if (!id) handleEmptyTargetClick(target);
                          else handleOccupiedTargetClick(id, target);
                        }}
                        onDoubleClick={() => id && send({ type: "RETURN", tileID: id })}
                        onPointerDown={(event) => id && !locked && handlePointerDown(event, id)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                      >{id ? <span className="tile-letter">{game.tiles[id].character}</span> : ""}</button>
                    );
                  })}
                </div>
              );
            })}
            {Array.from({ length: targetSizingRows - game.targetSlots.length }, (_, index) => (
              <div className="target-row-placeholder" aria-hidden="true" key={`placeholder-${index}`} />
            ))}
          </section>

          <section className="source-board" data-source-board aria-label="Available letters">
            {game.sourceSlots.map((row, rowIndex) => (
              <div className="source-row" key={rowIndex}>
                {row.map((id, columnIndex) => id ? (
                  <button
                    className={`letter-tile tile ${selectedTile === id ? "selected" : ""} ${drag?.moved && drag.tileID === id ? "drag-origin" : ""} ${dragHover?.kind === "source" && dragHover.row === rowIndex && dragHover.column === columnIndex ? "drop-hover" : ""}`}
                    key={id}
                    data-source-row={rowIndex}
                    data-source-column={columnIndex}
                    aria-label={`Letter ${game.tiles[id].character}`}
                    onClick={() => handleSourceTileClick(id, rowIndex, columnIndex)}
                    onDoubleClick={() => handleSourceTileDoubleClick(id)}
                    onPointerDown={(event) => handlePointerDown(event, id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  ><span className="tile-letter">{game.tiles[id].character}</span></button>
                ) : <button
                  className={`source-hole tile ${dragHover?.kind === "source" && dragHover.row === rowIndex && dragHover.column === columnIndex ? "drop-hover" : ""}`}
                  key={`hole-${rowIndex}-${columnIndex}`}
                  data-source-row={rowIndex}
                  data-source-column={columnIndex}
                  aria-label={`Source row ${rowIndex + 1}, position ${columnIndex + 1}, empty`}
                  onClick={() => handleEmptySourceClick(rowIndex, columnIndex)}
                />)}
              </div>
            ))}
          </section>

          <div className="game-toolbar">
            <button className="undo-action" aria-label="Undo" onClick={() => send({ type: "UNDO" })} disabled={!game.history.length}><Undo2 /><span>Undo</span></button>
            <button className="hint-action" aria-label="Hint" onClick={() => send({ type: "HINT" })} disabled={game.hintedRows.length >= activeLevel.answerRows.length}><Lightbulb /><span>Hint</span></button>
            <button className="recall-action" aria-label="Recall" onClick={() => send({ type: "RECALL" })} disabled={!canRecall}><RotateCcw /><span>Recall</span></button>
          </div>
        </main>
      </div>

      {drag?.moved && <div
        aria-hidden="true"
        className={`drag-tile ${drag.tileClassName}`}
        style={{ left: drag.left, top: drag.top, width: drag.width, height: drag.height, fontSize: drag.fontSize }}
      ><span className="tile-letter">{game.tiles[drag.tileID].character}</span></div>}
      {toast && <div className="toast" role="status">{toast}</div>}

      {modal === "how" && <Modal title="How to Play" onClose={() => setModal(null)}>
        <div className="instructions">
          <p>Rearrange every letter to form a valid English word in each row.</p>
          <p>Complete the Normal, Hard, and Perfect Split goals in order. For a Perfect Split, the highlighted target tiles must spell the featured word from top to bottom.</p>
          <p>Drag letters, or select a letter and then choose a target square. Double-click a placed tile to return it.</p>
          <p>Hints fill one official answer row at a time. A Holy Split is a Perfect Split earned without a hint.</p>
        </div>
      </Modal>}

      {modal === "stats" && <Modal title="Daily Stats" onClose={() => setModal(null)}>
        <div className="modal-stats">
          <div className="modal-streak">
            <Flame />
            <div>
              <span>Current Streak</span>
              <strong>{stats.currentStreak} {stats.currentStreak === 1 ? "day" : "days"}</strong>
              <small>Best: {stats.bestStreak} {stats.bestStreak === 1 ? "day" : "days"}</small>
            </div>
          </div>
          <div className="stat-row"><span>Puzzles Solved</span><strong>{stats.puzzlesSolved}</strong></div>
          <div className="stat-row"><span>Holy Splits</span><strong>{stats.perfectSplits}</strong></div>
          <div className="stat-row"><span>Avg. Time</span><strong>{formatDuration(stats.averageTimeMs)}</strong></div>
        </div>
      </Modal>}

      {modal === "victory" && <Modal title={game.hintedRows.length === 0 ? "Holy Split!" : "Perfect Split!"} onClose={() => setModal(null)}>
        <div className="victory-content"><span className="victory-seal"><Trophy /></span><p>You completed all three goals in {formatDuration(game.elapsedMs)}.</p><button className="primary-button" onClick={shareResult}><Share2 />Share result</button></div>
      </Modal>}
    </div>
  );
}
