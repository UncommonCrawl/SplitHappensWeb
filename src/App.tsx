import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  Archive, CalendarDays, Flame, HelpCircle, Lightbulb, RotateCcw, Settings,
  Share2, Shuffle, Sparkles, Trophy, Undo2, Volume2, VolumeX, X,
} from "lucide-react";
import { loadContent, localDateKey, parseLocalDate, staticAssetPath } from "./content";
import { createGame, deriveGame, gameReducer, slotID, type GameAction } from "./engine";
import { loadPersistedState, progressFromGame, savePersistedState } from "./persistence";
import { calculateStats, formatDuration } from "./stats";
import type { ContentSnapshot, GameState, LevelDefinition, PersistedAppState, SlotID, TileID } from "./types";

type ModalName = "how" | "settings" | "archive" | "victory" | "note" | null;

function Seal({ tone, achieved = false, compact = false }: { tone: "bronze" | "silver" | "gold"; achieved?: boolean; compact?: boolean }) {
  return (
    <span className={`seal ${tone} ${achieved ? "achieved" : ""} ${compact ? "compact" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" role="img">
        <path className="seal-fill" d="M50 4C57 4 60 12 66 14C72 16 79 11 84 16C89 21 84 28 86 34C88 40 96 43 96 50C96 57 88 60 86 66C84 72 89 79 84 84C79 89 72 84 66 86C60 88 57 96 50 96C43 96 40 88 34 86C28 84 21 89 16 84C11 79 16 72 14 66C12 60 4 57 4 50C4 43 12 40 14 34C16 28 11 21 16 16C21 11 28 16 34 14C40 12 43 4 50 4Z" />
        {achieved && <>
          <path className="seal-outline" d="M50 4C57 4 60 12 66 14C72 16 79 11 84 16C89 21 84 28 86 34C88 40 96 43 96 50C96 57 88 60 86 66C84 72 89 79 84 84C79 89 72 84 66 86C60 88 57 96 50 96C43 96 40 88 34 86C28 84 21 89 16 84C11 79 16 72 14 66C12 60 4 57 4 50C4 43 12 40 14 34C16 28 11 21 16 16C21 11 28 16 34 14C40 12 43 4 50 4Z" />
          <path className="seal-check" d="M29 51L43 65L72 35" />
        </>}
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

function shortDate(date: Date): string {
  return `${date.toLocaleDateString(undefined, { month: "long" })} ${ordinal(date.getDate())}`;
}

function resetCountdown(now: Date): string {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const minutes = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 60_000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

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
  const [modal, setModal] = useState<ModalName>(null);
  const [now, setNow] = useState(new Date());
  const [toast, setToast] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ tileID: TileID; x: number; y: number; moved: boolean } | null>(null);
  const [dragHover, setDragHover] = useState<SlotID | "source" | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const previousGold = useRef(false);

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

  const activeLevel = useMemo(() => content?.levels.find((level) => level.id === activeLevelID) ?? null, [content, activeLevelID]);
  const scheduleEntry = useMemo(() => content?.schedule.find((entry) => entry.levelID === activeLevelID) ?? null, [content, activeLevelID]);
  const releasedEntries = useMemo(() => content?.schedule.filter((entry) => entry.date <= localDateKey(now)).slice().reverse() ?? [], [content, now]);

  useEffect(() => {
    if (!activeLevel || !words) return;
    setGame(createGame(activeLevel, persisted.levels[activeLevel.id]));
    setSelectedTile(null);
    previousGold.current = Boolean(persisted.levels[activeLevel.id]?.firstGoldAt);
  // Persisted state is intentionally read only when a level is opened.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLevel?.id, words]);

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
    if (persisted.settings.vibrationEnabled && navigator.vibrate) navigator.vibrate(12);
  };

  const placeSelected = (target: `${number}:${number}`) => {
    if (!selectedTile) return;
    send({ type: "PLACE", tileID: selectedTile, slotID: target });
    playPlacementSound();
    setSelectedTile(null);
  };

  const handleTileClick = (id: TileID) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    setSelectedTile((current) => current === id ? null : id);
  };

  const handlePointerDown = (event: ReactPointerEvent, id: TileID) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragStart.current = { x: event.clientX, y: event.clientY };
    setDrag({ tileID: id, x: event.clientX, y: event.clientY, moved: false });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent) => {
    if (!drag || !dragStart.current) return;
    const moved = drag.moved || Math.hypot(event.clientX - dragStart.current.x, event.clientY - dragStart.current.y) > 6;
    setDrag({ ...drag, x: event.clientX, y: event.clientY, moved });
    if (moved) {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const target = hit?.closest<HTMLElement>("[data-slot-id]");
      setDragHover((target?.dataset.slotId as SlotID | undefined) ?? (hit?.closest("[data-source-board]") ? "source" : null));
    }
  };

  const handlePointerUp = (event: ReactPointerEvent) => {
    if (!drag) return;
    if (drag.moved) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-slot-id]");
      const source = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-source-board]");
      if (target?.dataset.slotId) {
        send({ type: "PLACE", tileID: drag.tileID, slotID: target.dataset.slotId as `${number}:${number}` });
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
  const progress = persisted.levels[activeLevel.id];
  const isToday = scheduleEntry.date === localDateKey(now);
  const goldSlots = new Set(activeLevel.goldTileExpectations.map((item) => slotID(item.rowIndex, item.columnIndex)));
  const goldExpectations = new Map(activeLevel.goldTileExpectations.map((item) => [slotID(item.rowIndex, item.columnIndex), item.letter]));

  return (
    <div className="app-shell">
      <header className="app-header">
        <img src={staticAssetPath("/images/title.png")} alt="Split Happens" className="wordmark" />
        <h1>{longDate(selectedDate)}</h1>
        <nav aria-label="Game actions">
          <button className="header-button" aria-label="How to Play" onClick={() => setModal("how")}><HelpCircle /><span>How to Play</span></button>
          <button className="header-button" aria-label="Hint" onClick={() => send({ type: "HINT" })} disabled={game.hintedRows.length >= activeLevel.answerRows.length}><Lightbulb /><span>Hint</span></button>
          <button className="header-button icon-only" onClick={() => setModal("settings")} aria-label="Settings"><Settings /></button>
        </nav>
      </header>

      <div className="workspace">
        <aside className="progress-rail">
          <section>
            <h2>Daily progress</h2>
            <div className="rail-feature"><CalendarDays /><div><strong>{shortDate(selectedDate)}</strong><small>{isToday ? `Resets in ${resetCountdown(now)}` : "Archive puzzle"}</small></div></div>
          </section>
          <section>
            <h2>Your progress</h2>
            <div className="rail-row"><span>Split</span><Seal tone="bronze" achieved={derived.allWordsValid} compact /></div>
            <div className="rail-row"><span>Perfect Split</span><Seal tone="gold" achieved={Boolean(progress?.perfectSplit)} compact /></div>
          </section>
          <section>
            <h2>Streak</h2>
            <div className="rail-feature"><Flame /><div><strong>{stats.currentStreak} {stats.currentStreak === 1 ? "day" : "days"}</strong><small>Best: {stats.bestStreak} days</small></div></div>
          </section>
          <section>
            <h2>Daily stats</h2>
            <div className="stat-row"><span>Puzzles Solved</span><strong>{stats.puzzlesSolved}</strong></div>
            <div className="stat-row"><span>Perfect Splits</span><strong>{stats.perfectSplits}</strong></div>
            <div className="stat-row"><span>Avg. Time</span><strong>{formatDuration(stats.averageTimeMs)}</strong></div>
            <button className="archive-button" onClick={() => setModal("archive")}><Archive />View Archive</button>
          </section>
        </aside>

        <main className="game-area">
          <section className="criteria" aria-label="Puzzle goals">
            <div className={`criterion ${derived.allWordsValid ? "complete" : ""}`}><Seal tone="bronze" achieved={derived.allWordsValid} /><strong>{derived.validRows.size}/{game.targetSlots.length} VALID<br />WORDS</strong></div>
            <div className={`criterion ${derived.silverSatisfied ? "complete" : ""}`}><Seal tone="silver" achieved={derived.silverSatisfied} /><strong>{derived.bonus.label}</strong></div>
            <div className={`criterion ${derived.victorySatisfied ? "complete" : ""}`}><Seal tone="gold" achieved={derived.victorySatisfied} /><strong>GOLD TILES<br />SPELL <span className="gold-word">{[...activeLevel.goldWord].map((letter, index) => <em className={derived.goldMatches[index] ? "correct" : ""} key={`${letter}-${index}`}>{letter}</em>)}</span> IN ORDER</strong></div>
          </section>

          <section className="target-board" aria-label="Target words">
            {game.targetSlots.map((row, rowIndex) => (
              <div className="target-row" key={rowIndex}>
                {row.map((id, columnIndex) => {
                  const target = slotID(rowIndex, columnIndex);
                  const locked = game.hintedRows.includes(rowIndex);
                  const rowComplete = row.every(Boolean);
                  const rowValid = derived.validRows.has(rowIndex);
                  const isGoldSlot = goldSlots.has(target);
                  const correctGold = Boolean(id && isGoldSlot && game.tiles[id].character === goldExpectations.get(target));
                  return (
                    <button
                      className={`target-slot tile ${id ? "occupied" : "empty"} ${rowComplete ? rowValid ? "row-valid" : "row-invalid" : ""} ${isGoldSlot ? "gold-slot" : ""} ${correctGold ? "correct-gold" : ""} ${id && selectedTile === id ? "selected" : ""} ${locked ? "hint-locked" : ""} ${drag?.moved && drag.tileID === id ? "drag-origin" : ""} ${dragHover === target ? "drop-hover" : ""}`}
                      key={target}
                      data-slot-id={target}
                      disabled={locked}
                      aria-label={`Row ${rowIndex + 1}, position ${columnIndex + 1}${id ? `, letter ${game.tiles[id].character}` : ", empty"}`}
                      onClick={() => id && !selectedTile ? handleTileClick(id) : placeSelected(target)}
                      onDoubleClick={() => id && send({ type: "RETURN", tileID: id })}
                      onPointerDown={(event) => id && !locked && handlePointerDown(event, id)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                    >{id ? <span className="tile-letter">{game.tiles[id].character}</span> : ""}</button>
                  );
                })}
              </div>
            ))}
          </section>

          <section className="source-board" data-source-board aria-label="Available letters">
            {game.sourceSlots.map((row, rowIndex) => (
              <div className="source-row" key={rowIndex}>
                {row.map((id, columnIndex) => id ? (
                  <button
                    className={`letter-tile tile ${selectedTile === id ? "selected" : ""} ${drag?.moved && drag.tileID === id ? "drag-origin" : ""}`}
                    key={id}
                    aria-label={`Letter ${game.tiles[id].character}`}
                    onClick={() => handleTileClick(id)}
                    onPointerDown={(event) => handlePointerDown(event, id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  ><span className="tile-letter">{game.tiles[id].character}</span></button>
                ) : <span className="source-hole tile" key={`hole-${rowIndex}-${columnIndex}`} />)}
              </div>
            ))}
          </section>

          <div className="game-toolbar">
            <button onClick={() => send({ type: "UNDO" })} disabled={!game.history.length}><Undo2 />Undo</button>
            <button onClick={() => send({ type: "RECALL" })}><RotateCcw />Recall</button>
            <button onClick={() => send({ type: "SHUFFLE", allLetters: persisted.settings.shuffleAllLetters, includeGold: persisted.settings.shuffleGoldTiles })}><Shuffle />Shuffle</button>
            {activeLevel.note && <button onClick={() => setModal("note")}><Sparkles />Level note</button>}
          </div>
        </main>
      </div>

      {drag?.moved && <>
        <div className={`drag-underlay ${dragHover && dragHover !== "source" ? "over-target" : ""}`} style={{ left: drag.x, top: drag.y }}>{game.tiles[drag.tileID].character}</div>
        <div className={`drag-ghost ${dragHover && dragHover !== "source" ? "over-target" : ""}`} style={{ left: drag.x, top: drag.y }}>{game.tiles[drag.tileID].character}</div>
      </>}
      {toast && <div className="toast" role="status">{toast}</div>}

      {modal === "how" && <Modal title="How to Play" onClose={() => setModal(null)}>
        <div className="instructions">
          <p>Rearrange every letter to form a valid English word in each row.</p>
          <p>Complete the bronze, silver, and gold goals in order. Gold letters must spell the featured word from top to bottom.</p>
          <p>Drag letters, or select a letter and then choose a target square. Double-click a placed tile to return it.</p>
          <p>Hints fill one official answer row at a time. A Perfect Split is Gold earned without a hint.</p>
        </div>
      </Modal>}

      {modal === "settings" && <Modal title="Settings" onClose={() => setModal(null)}>
        <div className="settings-list">
          <label><span>{persisted.settings.soundEnabled ? <Volume2 /> : <VolumeX />} Sound</span><input type="checkbox" checked={persisted.settings.soundEnabled} onChange={(event) => updateSettings({ soundEnabled: event.target.checked })} /></label>
          <label><span>Touch vibration</span><input type="checkbox" checked={persisted.settings.vibrationEnabled} onChange={(event) => updateSettings({ vibrationEnabled: event.target.checked })} /></label>
          <label><span>Shuffle all letters</span><input type="checkbox" checked={persisted.settings.shuffleAllLetters} onChange={(event) => updateSettings({ shuffleAllLetters: event.target.checked })} /></label>
          <label><span>Include correct gold tiles</span><input type="checkbox" checked={persisted.settings.shuffleGoldTiles} onChange={(event) => updateSettings({ shuffleGoldTiles: event.target.checked })} /></label>
        </div>
      </Modal>}

      {modal === "archive" && <Modal title="Puzzle Archive" onClose={() => setModal(null)} wide>
        <div className="archive-grid">
          {releasedEntries.map((entry) => {
            const level = content.levels.find((item) => item.id === entry.levelID);
            const saved = persisted.levels[entry.levelID];
            if (!level) return null;
            return <button key={entry.levelID} className={entry.levelID === activeLevel.id ? "active" : ""} onClick={() => { setActiveLevelID(entry.levelID); setModal(null); }}>
              <span>{shortDate(parseLocalDate(entry.date))}</span><strong>{level.goldWord}</strong><small>{saved?.perfectSplit ? "Perfect Split" : saved?.firstSplitAt ? "Split" : "Not played"}</small>
            </button>;
          })}
        </div>
      </Modal>}

      {modal === "note" && <Modal title={activeLevel.goldWord} onClose={() => setModal(null)}><p className="level-note">{activeLevel.note}</p></Modal>}

      {modal === "victory" && <Modal title={game.hintedRows.length === 0 ? "Perfect Split!" : "Gold Split!"} onClose={() => setModal(null)}>
        <div className="victory-content"><span className="victory-seal"><Trophy /></span><p>You completed all three goals in {formatDuration(game.elapsedMs)}.</p><button className="primary-button" onClick={shareResult}><Share2 />Share result</button></div>
      </Modal>}
    </div>
  );
}
