import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, CalendarDays, ChartNoAxesColumn, Flame, HelpCircle, Info, Lock,
  Menu, RotateCcw, Share2, Undo2, Volume2, VolumeX, X,
} from "lucide-react";
import hintIcon from "../hint.svg";
import clockIcon from "../clock.svg";
import noHintIcon from "../no-hint.svg";
import { loadPuzzleContent, loadWords, localDateKey, parseLocalDate, staticAssetPath } from "./content";
import { createGame, deriveGame, gameReducer, slotID, type GameAction } from "./engine";
import { awardVictoryBadges, loadPersistedState, progressFromGame, savePersistedState } from "./persistence";
import { highestPuzzleTier, recentScheduleEntries } from "./recentPuzzles";
import { calculateStats, formatDuration } from "./stats";
import type { ContentSnapshot, GameState, LevelDefinition, PersistedAppState, SlotID, TileID } from "./types";
import { wikipediaArticleURL } from "./wikipedia";

type ModalName = "about" | "how" | "recent" | "stats" | "victory" | null;

const SHOW_STREAKS_IN_STATS = false;

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

type AchievementTone = "bronze" | "silver" | "gold";

type AchievementPulse = {
  id: number;
  tones: AchievementTone[];
  preview: boolean;
};

type BadgeDefinition = {
  key: "perfectSplit" | "licketySplit";
  name: string;
  description: string;
  icon: string;
};

const BADGES: BadgeDefinition[] = [
  {
    key: "perfectSplit",
    name: "Holy Split",
    description: "Achieve a Perfect Split without any hints.",
    icon: noHintIcon,
  },
  {
    key: "licketySplit",
    name: "Lickety Split",
    description: "Achieve a Perfect Split within 24 hours of release.",
    icon: clockIcon,
  },
];

const TILE_DOUBLE_CLICK_MS = 500;
const EMPTY_WORDS = new Set<string>();
const TARGET_BOARD_HEIGHT_PERCENT = 45;
const SOURCE_BOARD_HEIGHT_PERCENT = 18.75;
const TILE_HEIGHT_SCALE = 0.9;
const ACHIEVEMENT_PULSE_MS = 800;

function Seal({ tone, achieved = false, satisfied = false, pulsing = false }: { tone: AchievementTone; achieved?: boolean; satisfied?: boolean; pulsing?: boolean }) {
  return (
    <span className={`seal ${tone} ${achieved ? "achieved" : ""} ${pulsing ? "pulsing" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" role="img">
        <path className="seal-fill" d="M50 4C57 4 60 12 66 14C72 16 79 11 84 16C89 21 84 28 86 34C88 40 96 43 96 50C96 57 88 60 86 66C84 72 89 79 84 84C79 89 72 84 66 86C60 88 57 96 50 96C43 96 40 88 34 86C28 84 21 89 16 84C11 79 16 72 14 66C12 60 4 57 4 50C4 43 12 40 14 34C16 28 11 21 16 16C21 11 28 16 34 14C40 12 43 4 50 4Z" />
        {satisfied &&
          <path className="seal-outline" d="M50 4C57 4 60 12 66 14C72 16 79 11 84 16C89 21 84 28 86 34C88 40 96 43 96 50C96 57 88 60 86 66C84 72 89 79 84 84C79 89 72 84 66 86C60 88 57 96 50 96C43 96 40 88 34 86C28 84 21 89 16 84C11 79 16 72 14 66C12 60 4 57 4 50C4 43 12 40 14 34C16 28 11 21 16 16C21 11 28 16 34 14C40 12 43 4 50 4Z" />
        }
        {achieved && <svg className="seal-trophy" x="27" y="32" width="46" height="41" viewBox="0 0 91.5 81.9">
          <path d="M82.2,5.1c-2.9-.6-6.3-.2-9.4,1,0-1.7,0-3.4,0-5H18.7c0,1.6,0,3.3,0,5-3.2-1.2-6.5-1.6-9.4-1-4.3.9-7.2,3.9-8.2,8.3-1.3,5.8,1.6,12.3,8.1,18.6,5.1,4.9,12,9,19.3,11.5,3,4.3,6.9,7.7,11.8,9.8-.7,2.6-3.2,10.2-9.3,14.8h29.6c-6.1-4.6-8.6-12.2-9.3-14.8,4.9-2.1,8.8-5.5,11.8-9.8,7.3-2.5,14.2-6.6,19.3-11.5,6.5-6.2,9.4-12.8,8.1-18.6-1-4.4-3.9-7.4-8.2-8.3ZM13.5,27.4c-4.7-4.5-7.1-9.2-6.3-12.6.5-2,1.5-3.1,3.4-3.6,2.5-.5,5.7.3,8.4,1.9.6,7.2,2,14.7,4.7,21.4-3.8-2-7.4-4.4-10.2-7.2ZM78,27.4c-2.9,2.7-6.4,5.2-10.2,7.2,2.7-6.7,4.1-14.2,4.7-21.4,2.7-1.7,5.9-2.5,8.4-1.9,1.9.4,3,1.5,3.4,3.6.8,3.4-1.6,8.1-6.3,12.6Z" />
          <rect x="26.7" y="72" width="38" height="8.2" />
        </svg>}
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
  const modalRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = modalRef.current;
    const focusable = () => Array.from(modal?.querySelectorAll<HTMLElement>("button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])") ?? []);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
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
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused && previouslyFocused !== document.body) {
        window.requestAnimationFrame(() => previouslyFocused.focus());
      }
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={modalRef} className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X /></button>
        <h2 id="modal-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}

type HelpTileTone = "blank" | "empty" | "source" | "valid" | "invalid" | "gold" | "correctGold";

function HelpTile({ letter, tone }: { letter?: string; tone: HelpTileTone }) {
  return <span className={`help-tile help-tile-${tone}`} aria-hidden="true">{letter}</span>;
}

function HelpBoard({ rows, tones }: { rows: string[]; tones: HelpTileTone[][] }) {
  return <div className="help-board" aria-hidden="true">
    {rows.map((row, rowIndex) => <div className="help-board-row" key={`${row}-${rowIndex}`}>
      {[...row].map((letter, columnIndex) => <HelpTile
        key={`${rowIndex}-${columnIndex}`}
        letter={letter === " " ? undefined : letter}
        tone={tones[rowIndex]?.[columnIndex] ?? "blank"}
      />)}
    </div>)}
  </div>;
}

const EMPTY_TARGET_TONES: HelpTileTone[][] = Array.from({ length: 3 }, () => Array(3).fill("empty"));
const VALID_TARGET_TONES: HelpTileTone[][] = Array.from({ length: 3 }, () => Array(3).fill("valid"));
const SOURCE_TONES: HelpTileTone[][] = Array.from({ length: 2 }, (_, row) => Array(row + 4).fill("source"));
const BLANK_SOURCE_TONES: HelpTileTone[][] = Array.from({ length: 2 }, (_, row) => Array(row + 4).fill("blank"));

const HELP_PAGES = [
  {
    description: <>Rearrange every letter to form a valid English word in each row.</>,
    before: <div className="help-example-stack">
      <HelpBoard rows={["   ", "   ", "   "]} tones={EMPTY_TARGET_TONES} />
      <HelpBoard rows={["LEAF", "STEEP"]} tones={SOURCE_TONES} />
    </div>,
    after: <div className="help-example-stack">
      <HelpBoard rows={["SET", "   ", "FPL"]} tones={[
        ["valid", "valid", "valid"],
        ["empty", "empty", "empty"],
        ["invalid", "invalid", "invalid"],
      ]} />
      <HelpBoard rows={[" EA ", "   E "]} tones={[
        ["blank", "source", "source", "blank"],
        ["blank", "blank", "blank", "source", "blank"],
      ]} />
    </div>,
  },
  {
    description: <>
      <span>Complete a goal to unlock the next tier.</span>
      <span>To complete Hard and Perfect Split tiers, all previous criteria must be met.</span>
      <div className="help-criteria" aria-label="Hard tier criteria">
        <span className="help-criterion-complete">REARRANGE ALL LETTERS INTO VALID ENGLISH WORDS</span>
        <span>ROW TWO MUST BEGIN WITH F</span>
      </div>
    </>,
    before: <div className="help-example-stack">
      <HelpBoard rows={["LET", "SAP", "FEE"]} tones={VALID_TARGET_TONES} />
      <HelpBoard rows={["    ", "     "]} tones={BLANK_SOURCE_TONES} />
    </div>,
    after: <div className="help-example-stack">
      <HelpBoard rows={["LET", "FEE", "SAP"]} tones={VALID_TARGET_TONES} />
      <HelpBoard rows={["    ", "     "]} tones={BLANK_SOURCE_TONES} />
    </div>,
  },
  {
    description: <>
      <span>For a Perfect Split, the highlighted target tiles must spell the featured word from top to bottom.</span>
      <div className="help-criteria" aria-label="Perfect Split criteria">
        <span className="help-criterion-complete">REARRANGE ALL LETTERS INTO VALID ENGLISH WORDS</span>
        <span className="help-criterion-complete">ROW TWO MUST BEGIN WITH F</span>
        <span>GOLD LETTERS MUST SPELL <em>TEA</em></span>
      </div>
    </>,
    before: <div className="help-example-stack">
      <HelpBoard rows={["LAP", "FEE", "SET"]} tones={[
        ["valid", "valid", "gold"],
        ["valid", "gold", "valid"],
        ["valid", "gold", "valid"],
      ]} />
      <HelpBoard rows={["    ", "     "]} tones={BLANK_SOURCE_TONES} />
    </div>,
    after: <div className="help-example-stack">
      <HelpBoard rows={["LET", "FEE", "SAP"]} tones={[
        ["valid", "valid", "correctGold"],
        ["valid", "correctGold", "valid"],
        ["valid", "correctGold", "valid"],
      ]} />
      <HelpBoard rows={["    ", "     "]} tones={BLANK_SOURCE_TONES} />
    </div>,
  },
] as const;

function HowToPlay() {
  const [page, setPage] = useState(0);
  const current = HELP_PAGES[page];

  return <div className="how-to-play">
    <div className="help-description">{current.description}</div>
    <div className="help-transformation" aria-label={`Example for instruction ${page + 1} of ${HELP_PAGES.length}`}>
      {current.before}
      <ArrowRight className="help-example-arrow" aria-hidden="true" />
      {current.after}
    </div>
    <div className="help-pagination">
      <button type="button" aria-label="Previous instruction" disabled={page === 0} onClick={() => setPage((currentPage) => currentPage - 1)}><ArrowLeft /></button>
      <span className="visually-hidden" aria-live="polite">Instruction {page + 1} of {HELP_PAGES.length}</span>
      <button type="button" aria-label="Next instruction" disabled={page === HELP_PAGES.length - 1} onClick={() => setPage((currentPage) => currentPage + 1)}><ArrowRight /></button>
    </div>
  </div>;
}

function LoadingScreen({ error, retry }: { error?: string; retry?: () => void }) {
  if (!error) {
    return (
      <div className="app-shell app-shell-loading-content" aria-busy="true">
        <header className="mobile-header" />
        <aside className="app-sidebar" aria-label="Game sidebar" />
        <div className="workspace">
          <div className="game-loading-overlay" role="status" aria-label="Loading puzzle">
            <div className="loader" aria-hidden="true" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <main className="loading-screen">
      <img src={staticAssetPath("/images/title.png")} alt="Split Happens" />
      <p>{error}</p><button className="primary-button" onClick={retry}>Try again</button>
    </main>
  );
}

function LevelTitle({ level }: { level: LevelDefinition }) {
  return (
    <span className="level-title">
      '{level.wikipediaArticle
        ? <a className="level-title-link" href={wikipediaArticleURL(level.wikipediaArticle)} target="_blank" rel="noopener noreferrer">{level.goldWord}</a>
        : level.goldWord}'
    </span>
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
  const [selectedSourceSlot, setSelectedSourceSlot] = useState<SlotID | null>(null);
  const [modal, setModal] = useState<ModalName>(null);
  const [now, setNow] = useState(new Date());
  const [toast, setToast] = useState<string | null>(null);
  const [archivePage, setArchivePage] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isConstrained, setIsConstrained] = useState(() => window.matchMedia("(max-width: 1050px)").matches);
  const [recentPuzzlesCollapsed, setRecentPuzzlesCollapsed] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragHover, setDragHover] = useState<DragHover | null>(null);
  const [achievementPulse, setAchievementPulse] = useState<AchievementPulse | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const lastTargetSelectionClick = useRef<{ target: SlotID; at: number } | null>(null);
  const lastSourceSelectionClick = useRef<{ tileID: TileID; at: number } | null>(null);
  const previousGold = useRef(false);
  const previousAchievements = useRef<Record<AchievementTone, boolean>>({ bronze: false, silver: false, gold: false });
  const achievementPulseID = useRef(0);
  const achievementPulseTimer = useRef<number | null>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const helpButtonRef = useRef<HTMLButtonElement>(null);

  const pulseAchievements = useCallback((tones: AchievementTone[], preview = false) => {
    if (achievementPulseTimer.current !== null) window.clearTimeout(achievementPulseTimer.current);
    achievementPulseID.current += 1;
    setAchievementPulse({ id: achievementPulseID.current, tones, preview });
    achievementPulseTimer.current = window.setTimeout(() => {
      setAchievementPulse(null);
      achievementPulseTimer.current = null;
    }, ACHIEVEMENT_PULSE_MS);
  }, []);

  useEffect(() => () => {
    if (achievementPulseTimer.current !== null) window.clearTimeout(achievementPulseTimer.current);
  }, []);

  useEffect(() => {
    if (!["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) return;
    const handleLocalDevShortcut = (event: KeyboardEvent) => {
      if (!event.altKey || event.repeat) return;
      if (event.code !== "KeyV" && event.code !== "KeyT") return;
      event.preventDefault();
      if (event.code === "KeyV") setModal("victory");
      else pulseAchievements(["bronze", "silver", "gold"], true);
    };
    window.addEventListener("keydown", handleLocalDevShortcut);
    return () => window.removeEventListener("keydown", handleLocalDevShortcut);
  }, [pulseAchievements]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest("button.tile")) return;
      setSelectedTile(null);
      setSelectedTargetSlot(null);
      setSelectedSourceSlot(null);
      lastTargetSelectionClick.current = null;
      lastSourceSelectionClick.current = null;
    };
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const refreshContent = useCallback(() => {
    setLoadError(null);
    setWords(null);
    loadPuzzleContent().then((snapshot) => {
      setContent(snapshot);
      const today = localDateKey();
      const released = snapshot.schedule.filter((entry) => entry.date <= today);
      const selected = snapshot.schedule.find((entry) => entry.date === today) ?? released.at(-1);
      setActiveLevelID(selected?.levelID ?? null);
    }).catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "The puzzles could not be loaded."));
    loadWords()
      .then(setWords)
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "The dictionary could not be loaded."));
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

  useLayoutEffect(() => {
    if (isConstrained) {
      setRecentPuzzlesCollapsed(false);
      return;
    }
    const checkFit = () => {
      const sidebar = drawerRef.current;
      if (!recentPuzzlesCollapsed && sidebar && sidebar.scrollHeight > sidebar.clientHeight) {
        setRecentPuzzlesCollapsed(true);
      }
    };
    checkFit();
    const frame = window.requestAnimationFrame(checkFit);
    return () => window.cancelAnimationFrame(frame);
  }, [archivePage, isConstrained, recentEntries, recentPuzzlesCollapsed]);

  useEffect(() => {
    const recheckExpandedSidebar = () => {
      setRecentPuzzlesCollapsed(false);
      window.requestAnimationFrame(() => {
        const sidebar = drawerRef.current;
        if (!window.matchMedia("(max-width: 1050px)").matches && sidebar && sidebar.scrollHeight > sidebar.clientHeight) {
          setRecentPuzzlesCollapsed(true);
        }
      });
    };
    window.addEventListener("resize", recheckExpandedSidebar);
    document.fonts?.ready.then(recheckExpandedSidebar);
    return () => window.removeEventListener("resize", recheckExpandedSidebar);
  }, []);

  useEffect(() => {
    if (!activeLevel) return;
    setGame(createGame(activeLevel, persisted.levels[activeLevel.id]));
    setSelectedTile(null);
    setSelectedTargetSlot(null);
    setSelectedSourceSlot(null);
    previousGold.current = Boolean(persisted.levels[activeLevel.id]?.firstGoldAt);
    previousAchievements.current = {
      bronze: Boolean(persisted.levels[activeLevel.id]?.firstSplitAt || persisted.levels[activeLevel.id]?.firstSilverAt || persisted.levels[activeLevel.id]?.firstGoldAt),
      silver: Boolean(persisted.levels[activeLevel.id]?.firstSilverAt || persisted.levels[activeLevel.id]?.firstGoldAt),
      gold: Boolean(persisted.levels[activeLevel.id]?.firstGoldAt),
    };
  // Persisted state is intentionally read only when a level is opened.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLevel?.id]);

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

  const derived = useMemo(() => game && activeLevel ? deriveGame(game, activeLevel, words ?? EMPTY_WORDS) : null, [game, activeLevel, words]);

  useEffect(() => {
    if (!game || !activeLevel || game.levelID !== activeLevel.id || !derived) return;
    const savedProgress = persisted.levels[activeLevel.id];
    const currentAchievements: Record<AchievementTone, boolean> = {
      bronze: derived.allWordsValid || Boolean(savedProgress?.firstSplitAt || savedProgress?.firstSilverAt || savedProgress?.firstGoldAt),
      silver: derived.silverSatisfied || Boolean(savedProgress?.firstSilverAt || savedProgress?.firstGoldAt),
      gold: derived.victorySatisfied || Boolean(savedProgress?.firstGoldAt),
    };
    const newlyAchieved = (Object.keys(currentAchievements) as AchievementTone[])
      .filter((tone) => currentAchievements[tone] && !previousAchievements.current[tone]);
    previousAchievements.current = currentAchievements;
    if (newlyAchieved.length) pulseAchievements(newlyAchieved);
  }, [activeLevel, derived, game, persisted.levels, pulseAchievements]);

  const send = useCallback((action: GameAction) => {
    if (!activeLevel || !words) return;
    setGame((current) => current ? gameReducer(activeLevel, words)(current, action) : current);
  }, [activeLevel, words]);

  useEffect(() => {
    if (!game || !activeLevel || game.levelID !== activeLevel.id || !derived || !scheduleEntry) return;
    setPersisted((current) => {
      const previous = current.levels[activeLevel.id];
      const progress = progressFromGame(game, previous);
      const timestamp = new Date().toISOString();
      if (derived.allWordsValid && !progress.firstSplitAt) progress.firstSplitAt = timestamp;
      if (derived.silverSatisfied && !progress.firstSilverAt) progress.firstSilverAt = timestamp;
      const newlyAchievedPerfectSplit = derived.victorySatisfied && !progress.firstGoldAt;
      if (newlyAchievedPerfectSplit) progress.firstGoldAt = timestamp;
      const badgeProgress = awardVictoryBadges(progress, scheduleEntry.date, new Date(timestamp), newlyAchievedPerfectSplit);
      const dailyResults = { ...current.dailyResults };
      if (derived.allWordsValid && game.splitElapsedMs !== null) {
        dailyResults[scheduleEntry.date] = {
          date: scheduleEntry.date,
          levelID: activeLevel.id,
          solvedOnReleaseDate: scheduleEntry.date === localDateKey(new Date(progress.firstSplitAt!)),
          splitElapsedMs: game.splitElapsedMs,
          perfectSplit: badgeProgress.perfectSplit,
          hardOrHigher: Boolean(progress.firstSilverAt || progress.firstGoldAt),
          hardOnReleaseDate: Boolean(progress.firstSilverAt && scheduleEntry.date === localDateKey(new Date(progress.firstSilverAt))),
          achievedPerfectSplit: Boolean(progress.firstGoldAt),
          perfectOnReleaseDate: Boolean(progress.firstGoldAt && scheduleEntry.date === localDateKey(new Date(progress.firstGoldAt))),
        };
      }
      const next = { ...current, levels: { ...current.levels, [activeLevel.id]: badgeProgress }, dailyResults };
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

  const stats = useMemo(() => {
    const results = Object.fromEntries(Object.entries(persisted.dailyResults).map(([date, result]) => {
      const progress = persisted.levels[result.levelID];
      const firstSilverAt = progress?.firstSilverAt || progress?.firstGoldAt;
      return [date, {
        ...result,
        hardOrHigher: result.hardOrHigher ?? Boolean(firstSilverAt),
        hardOnReleaseDate: result.hardOnReleaseDate ?? Boolean(firstSilverAt && date === localDateKey(new Date(firstSilverAt))),
        achievedPerfectSplit: result.achievedPerfectSplit ?? Boolean(progress?.firstGoldAt || result.perfectSplit),
        perfectOnReleaseDate: result.perfectOnReleaseDate ?? Boolean(progress?.firstGoldAt && date === localDateKey(new Date(progress.firstGoldAt))),
      }];
    }));
    return calculateStats(results, now, releasedEntries.length);
  }, [persisted.dailyResults, persisted.levels, now, releasedEntries.length]);
  const progressSegments = {
    perfect: Math.min(stats.tiers.perfect.completed, stats.totalPuzzles),
    hard: Math.max(0, Math.min(stats.tiers.hard.completed, stats.totalPuzzles) - stats.tiers.perfect.completed),
    normal: Math.max(0, Math.min(stats.tiers.normal.completed, stats.totalPuzzles) - stats.tiers.hard.completed),
    incomplete: Math.max(0, stats.totalPuzzles - stats.tiers.normal.completed) || (stats.totalPuzzles === 0 ? 1 : 0),
  };
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

      if (event.key === "Escape" && (selectedTile || selectedTargetSlot || selectedSourceSlot)) {
        event.preventDefault();
        clearSelection();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        if (selectedTile || selectedSourceSlot) {
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
  }, [game, selectedTile, selectedTargetSlot, selectedSourceSlot, send]);

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
    if (selectedSourceSlot) {
      lastSourceSelectionClick.current = null;
      const [selectedRow, selectedColumn] = selectedSourceSlot.split(":").map(Number);
      send({ type: "MOVE_SOURCE", tileID: id, row: selectedRow, column: selectedColumn });
      playPlacementSound();
      clearSelection();
      return;
    }
    if (selectedTargetSlot) {
      lastSourceSelectionClick.current = null;
      send({ type: "PLACE", tileID: id, slotID: selectedTargetSlot });
      playPlacementSound();
      clearSelection();
      return;
    }
    if (selectedTile && selectedTile !== id) {
      lastSourceSelectionClick.current = null;
      send({ type: "MOVE_SOURCE", tileID: selectedTile, row, column });
      playPlacementSound();
      clearSelection();
      return;
    }
    if (selectedTile === id) {
      const previous = lastSourceSelectionClick.current;
      const isQuickSecondClick = previous?.tileID === id
        && performance.now() - previous.at <= TILE_DOUBLE_CLICK_MS;
      lastSourceSelectionClick.current = null;
      if (isQuickSecondClick && game) {
        const target = game.targetSlots
          .flatMap((targetRow, rowIndex) => targetRow.map((occupant, columnIndex) => ({ occupant, rowIndex, columnIndex })))
          .find(({ occupant, rowIndex }) => !occupant && !game.hintedRows.includes(rowIndex));
        if (target) {
          send({ type: "PLACE", tileID: id, slotID: slotID(target.rowIndex, target.columnIndex) });
          playPlacementSound();
        }
      }
      clearSelection();
      return;
    }
    lastSourceSelectionClick.current = { tileID: id, at: performance.now() };
    setSelectedTile(id);
  };

  const handleEmptyTargetClick = (target: SlotID) => {
    if (selectedTile) {
      placeSelected(target);
      return;
    }
    if (selectedSourceSlot) {
      setSelectedSourceSlot(null);
      setSelectedTargetSlot(target);
      return;
    }
    if (selectedTargetSlot && game) {
      const [row, column] = selectedTargetSlot.split(":").map(Number);
      const selectedTargetTile = game.targetSlots[row]?.[column] ?? null;
      if (selectedTargetTile) {
        send({ type: "PLACE", tileID: selectedTargetTile, slotID: target });
        playPlacementSound();
        clearSelection();
        return;
      }
    }
    setSelectedTargetSlot((current) => current === target ? null : target);
  };

  const handleOccupiedTargetClick = (id: TileID, target: SlotID) => {
    if (selectedTile) {
      lastTargetSelectionClick.current = null;
      placeSelected(target);
      return;
    }
    if (selectedSourceSlot) {
      lastTargetSelectionClick.current = null;
      const [row, column] = selectedSourceSlot.split(":").map(Number);
      send({ type: "MOVE_SOURCE", tileID: id, row, column });
      playPlacementSound();
      clearSelection();
      return;
    }
    if (selectedTargetSlot) {
      if (selectedTargetSlot === target) {
        const previous = lastTargetSelectionClick.current;
        const isQuickSecondClick = previous?.target === target
          && performance.now() - previous.at <= TILE_DOUBLE_CLICK_MS;
        lastTargetSelectionClick.current = null;
        if (isQuickSecondClick) {
          send({ type: "RETURN", tileID: id });
          playPlacementSound();
          clearSelection();
        } else {
          setSelectedTargetSlot(null);
        }
      } else {
        lastTargetSelectionClick.current = null;
        handleTileClick(id);
      }
      return;
    }
    lastTargetSelectionClick.current = { target, at: performance.now() };
    setSelectedTargetSlot(target);
  };

  const handleEmptySourceClick = (row: number, column: number) => {
    if (!game) return;
    let tileID = selectedTile;
    if (!tileID && selectedTargetSlot) {
      const [targetRow, targetColumn] = selectedTargetSlot.split(":").map(Number);
      tileID = game.hintedRows.includes(targetRow) ? null : game.targetSlots[targetRow]?.[targetColumn] ?? null;
    }
    if (!tileID) {
      const source = slotID(row, column);
      setSelectedTargetSlot(null);
      setSelectedSourceSlot((current) => current === source ? null : source);
      return;
    }

    send({ type: "MOVE_SOURCE", tileID, row, column });
    playPlacementSound();
    clearSelection();
  };

  const clearSelection = () => {
    setSelectedTile(null);
    setSelectedTargetSlot(null);
    setSelectedSourceSlot(null);
    lastTargetSelectionClick.current = null;
    lastSourceSelectionClick.current = null;
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
    if (moved && !drag.moved && (selectedTile || selectedTargetSlot || selectedSourceSlot)) clearSelection();
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
      window.setTimeout(() => { suppressClick.current = false; }, 0);
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
  if (!content || !activeLevel || !game || !derived || !scheduleEntry) return <LoadingScreen />;

  const selectedDate = parseLocalDate(scheduleEntry.date);
  const savedProgress = persisted.levels[activeLevel.id];
  const earnedBadges = BADGES.filter((badge) => Boolean(savedProgress?.[badge.key]));
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
  const handleGoldWordClick = () => {
    if (!words) return;
    const action = { type: "ARRANGE_GOLD" } as const;
    const preview = gameReducer(activeLevel, words)(game, action);
    const boardChanged = preview.sourceSlots !== game.sourceSlots || preview.targetSlots !== game.targetSlots;
    if (boardChanged) {
      send(action);
      playPlacementSound();
    }
    clearSelection();
  };
  const goldWord = <>{[...activeLevel.goldWord].map((letter, index) =>
    <em className={derived.goldMatches[index] ? "correct" : ""} key={`${letter}-${index}`}>{letter}</em>,
  )}</>;
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
      content: <>HIGHLIGHTED TILES MUST SPELL {goldUnlocked
        ? <button className="gold-word" type="button" onClick={handleGoldWordClick} aria-label={`Arrange highlighted tiles to spell ${activeLevel.goldWord}`}>{goldWord}</button>
        : <span className="gold-word">{goldWord}</span>} IN ORDER</>,
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
    "--target-height-limit": `calc(${TARGET_BOARD_HEIGHT_PERCENT * TILE_HEIGHT_SCALE / targetSizingRows}cqh - 0.5px)`,
    "--source-height-limit": `${SOURCE_BOARD_HEIGHT_PERCENT * TILE_HEIGHT_SCALE / game.sourceSlots.length}cqh`,
  } as CSSProperties;
  const handleSidebarAction = (action: () => void) => {
    action();
    if (isConstrained) closeDrawer();
  };
  const handlePuzzleSelection = (levelID: string) => {
    setActiveLevelID(levelID);
    setModal(null);
    if (isConstrained) closeDrawer();
  };
  const recentPuzzleGrid = <>
    <div className="puzzle-date-grid" aria-label="Recent puzzles">
      {Array.from({ length: 9 - recentEntries.length }, (_, index) => <span className="puzzle-date-placeholder" aria-hidden="true" key={`placeholder-${index}`} />)}
      {recentEntries.map((entry) => {
        const date = parseLocalDate(entry.date);
        const level = content.levels.find((item) => item.id === entry.levelID);
        const today = entry.date === localDateKey(now);
        const tier = level ? highestPuzzleTier(level, persisted.levels[entry.levelID], words ?? EMPTY_WORDS) : "none";
        const puzzleProgress = persisted.levels[entry.levelID];
        const puzzleBadges = BADGES.filter((badge) => Boolean(puzzleProgress?.[badge.key]));
        const tierLabel = tier === "none" ? "not completed" : `${tier} tier`;
        const badgeLabel = puzzleBadges.length ? `, ${puzzleBadges.map((badge) => badge.name).join(" and ")}` : "";
        return <button
          key={entry.date}
          className={`puzzle-date-button tier-${tier}`}
          data-date={entry.date}
          aria-label={`${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}, ${today ? "today's puzzle" : tierLabel}${badgeLabel}`}
          aria-pressed={entry.levelID === activeLevel.id}
          onClick={() => handlePuzzleSelection(entry.levelID)}
        >
          <span className="puzzle-date-month">{MONTH_ABBREVIATIONS[date.getMonth()]}</span>
          <strong className="puzzle-date-day">{date.getDate()}</strong>
          {puzzleBadges.length > 0 && <span className="puzzle-tile-badges" aria-hidden="true">
            {puzzleBadges.map((badge) => <img src={badge.icon} alt="" key={badge.key} />)}
          </span>}
        </button>;
      })}
    </div>
    <div className="puzzle-pagination" aria-label="Archive navigation">
      <button className="archive-button" disabled={!hasPreviousPage} onClick={() => setArchivePage((page) => page + 1)}><ArrowLeft /><span>Prev.</span></button>
      <button className="archive-button" disabled={!hasNextPage} onClick={() => setArchivePage((page) => Math.max(0, page - 1))}><span>Next</span><ArrowRight /></button>
    </div>
  </>;
  return (
    <div className={`app-shell ${words ? "" : "app-shell-loading-content"}`}>
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
          <h1>
            <span className="level-date">{longDate(selectedDate)}</span>
            <LevelTitle level={activeLevel} />
          </h1>
        </div>
        <button
          ref={helpButtonRef}
          className="mobile-help-button"
          aria-label="How to Play"
          aria-haspopup="dialog"
          onClick={() => setModal("how")}
        ><HelpCircle /></button>
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
        <header className="drawer-header">
          <button className="drawer-close" aria-label="Close sidebar menu" onClick={() => closeDrawer()}><X /></button>
          <h2 className="drawer-title">Menu</h2>
        </header>
        <header className="sidebar-brand">
          <img src={staticAssetPath("/images/title.png")} alt="Split Happens" className="wordmark" />
          <h1>
            <span className="level-date">{longDate(selectedDate)}</span>
            <LevelTitle level={activeLevel} />
          </h1>
        </header>

        <nav className="sidebar-actions" aria-label="Game actions">
          <button className="sidebar-help-action" aria-label="How to Play" onClick={() => handleSidebarAction(() => setModal("how"))}><HelpCircle /><span>How to Play</span></button>
          <button aria-label="Stats" onClick={() => handleSidebarAction(() => setModal("stats"))}><ChartNoAxesColumn /><span>Stats</span></button>
          <button
            onClick={() => handleSidebarAction(() => updateSettings({ soundEnabled: !persisted.settings.soundEnabled }))}
            aria-label={persisted.settings.soundEnabled ? "Turn sound off" : "Turn sound on"}
            aria-pressed={persisted.settings.soundEnabled}
          >
            {persisted.settings.soundEnabled ? <Volume2 /> : <VolumeX />}
            <span>Sound</span>
          </button>
          <button aria-label="About" onClick={() => handleSidebarAction(() => setModal("about"))}><Info /><span>About</span></button>
          {recentPuzzlesCollapsed && <button aria-label="Recent Puzzles" onClick={() => setModal("recent")}><CalendarDays /><span>Recent Puzzles</span></button>}
        </nav>

        {!recentPuzzlesCollapsed && <section className="sidebar-stats">
          <h2>Recent puzzles</h2>
          {recentPuzzleGrid}
        </section>}

        <footer className="sidebar-controls" aria-label="Game controls">
          <p>Click to select</p>
          <p>Drag to place</p>
          <p>Click any two tiles to swap positions</p>
          <p>Double-click to move tile to/from source</p>
        </footer>
      </aside>

      <div className="workspace" aria-busy={!words}>
        <main className="game-area" style={gameLayoutStyle}>
          <section className="criteria" aria-label="Puzzle goals">
            <div className="achievement-track" role="list" aria-label="Normal, Hard, Perfect Split progression">
              {achievementTiers.map((tier, index) => {
                const isPulsing = achievementPulse?.tones.includes(tier.tone) ?? false;
                const previewAchieved = isPulsing && Boolean(achievementPulse?.preview);
                return <Fragment key={tier.name}>
                  {index > 0 && <span className={`tier-connector ${tier.unlocked ? "complete" : ""}`} aria-hidden="true" />}
                  <div
                    className={`tier-step tier-${tier.tone} ${tier.unlocked ? "unlocked" : "future"} ${tier.achieved ? "complete" : ""} ${tier.satisfied ? "satisfied" : ""} ${index === activeTierIndex ? "active" : ""} ${previewAchieved ? "previewing" : ""}`}
                    role="listitem"
                    aria-current={index === activeTierIndex ? "step" : undefined}
                    aria-label={`${tier.name}: ${tier.achieved ? `achieved, ${tier.satisfied ? "currently satisfied" : "not currently satisfied"}` : tier.unlocked ? "unlocked, not currently satisfied" : "not yet available"}`}
                  >
                    <span className="tier-seal">
                      <Seal
                        key={isPulsing ? achievementPulse?.id : 0}
                        tone={tier.tone}
                        achieved={tier.achieved || previewAchieved}
                        satisfied={tier.satisfied}
                        pulsing={isPulsing}
                      />
                      {!tier.unlocked && !previewAchieved && <Lock className="tier-lock" aria-hidden="true" />}
                    </span>
                    <strong>{tier.name}</strong>
                  </div>
                </Fragment>;
              })}
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
                    onPointerDown={(event) => handlePointerDown(event, id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  ><span className="tile-letter">{game.tiles[id].character}</span></button>
                ) : <button
                  className={`source-hole tile ${selectedSourceSlot === slotID(rowIndex, columnIndex) ? "selected" : ""} ${dragHover?.kind === "source" && dragHover.row === rowIndex && dragHover.column === columnIndex ? "drop-hover" : ""}`}
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
            <button className="hint-action" aria-label="Hint" onClick={() => send({ type: "HINT" })} disabled={game.hintedRows.length >= activeLevel.answerRows.length}><img src={hintIcon} alt="" aria-hidden="true" /><span>Hint</span></button>
            <button className="recall-action" aria-label="Recall" onClick={() => send({ type: "RECALL" })} disabled={!canRecall}><RotateCcw /><span>Recall</span></button>
          </div>
        </main>
        {!words && <div className="game-loading-overlay" role="status" aria-label="Loading puzzle">
          <div className="loader" aria-hidden="true" />
        </div>}
      </div>

      {modal === "recent" && <Modal title="Recent Puzzles" onClose={() => setModal(null)}>
        <div className="recent-puzzles-popup">{recentPuzzleGrid}</div>
      </Modal>}

      {drag?.moved && <div
        aria-hidden="true"
        className={`drag-tile ${drag.tileClassName}`}
        style={{ left: drag.left, top: drag.top, width: drag.width, height: drag.height, fontSize: drag.fontSize }}
      ><span className="tile-letter">{game.tiles[drag.tileID].character}</span></div>}
      {toast && <div className="toast" role="status">{toast}</div>}

      {modal === "how" && <Modal title="How to Play" onClose={() => {
        setModal(null);
        if (isConstrained) window.requestAnimationFrame(() => helpButtonRef.current?.focus());
      }}>
        <HowToPlay />
      </Modal>}

      {modal === "stats" && <Modal title="Daily Stats" onClose={() => setModal(null)} wide>
        <div className="modal-stats">
          {SHOW_STREAKS_IN_STATS && <section className="stats-streak-card" aria-labelledby="streaks-heading">
            <h3 id="streaks-heading">Streaks</h3>
            {([
              ["Perfect Split", "gold", stats.tiers.perfect],
              ["Hard or Higher", "silver", stats.tiers.hard],
              ["Normal or Higher", "bronze", stats.tiers.normal],
            ] as const).map(([label, tone, tier]) => <div className="stats-streak-row" key={label}>
              <Flame className={`stats-flame ${tone}`} />
              <div>
                <span>{label}</span>
                <strong>{tier.currentStreak} {tier.currentStreak === 1 ? "day" : "days"}</strong>
                <small>Best: {tier.bestStreak} {tier.bestStreak === 1 ? "day" : "days"}</small>
              </div>
            </div>)}
          </section>}
          <section className="stats-progress" aria-labelledby="progress-heading">
            <h3 id="progress-heading">Progress</h3>
            <div
              className="stats-progress-bar"
              role="img"
              aria-label={`${stats.tiers.perfect.completed} perfect, ${stats.tiers.hard.completed} hard or higher, and ${stats.tiers.normal.completed} normal or higher out of ${stats.totalPuzzles} puzzles`}
            >
              <span className="perfect" style={{ flexGrow: progressSegments.perfect }} aria-hidden="true" />
              <span className="hard" style={{ flexGrow: progressSegments.hard }} aria-hidden="true" />
              <span className="normal" style={{ flexGrow: progressSegments.normal }} aria-hidden="true" />
              <span className="incomplete" style={{ flexGrow: progressSegments.incomplete }} aria-hidden="true" />
            </div>
            <div className="stat-row"><span>Perfect Split</span><strong>{stats.tiers.perfect.completed}/{stats.totalPuzzles}</strong></div>
            <div className="stat-row"><span>Hard or Higher</span><strong>{stats.tiers.hard.completed}/{stats.totalPuzzles}</strong></div>
            <div className="stat-row"><span>Normal or Higher</span><strong>{stats.tiers.normal.completed}/{stats.totalPuzzles}</strong></div>
          </section>
        </div>
      </Modal>}

      {modal === "about" && <Modal title="About" onClose={() => setModal(null)}>
        <div className="about-content">
          <p>© 2026 Keith Herrmann</p>
          <a href="https://linktr.ee/keithherrmann" target="_blank" rel="noreferrer">Check out my other stuff</a>
        </div>
      </Modal>}

      {modal === "victory" && <Modal title="Perfect Split!" onClose={() => setModal(null)}>
        <div className="victory-content">
          <span className="victory-seal" aria-hidden="true"><span className="victory-banana" /></span>
          <p>You completed all three goals in {formatDuration(game.elapsedMs)}.</p>
          {earnedBadges.length > 0 && <div className="victory-badges" aria-label="Badges earned">
            {earnedBadges.map((badge) => <div className="victory-badge" key={badge.key}>
              <img src={badge.icon} alt="" aria-hidden="true" />
              <strong>{badge.name}</strong>
              <span>{badge.description}</span>
            </div>)}
          </div>}
          <button className="primary-button" onClick={shareResult}><Share2 />Share result</button>
        </div>
      </Modal>}
    </div>
  );
}
