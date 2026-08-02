import * as React from "react";
import type { DailyPlayProps } from "../types";
import type { NutshellPublicState, NutshellCell } from "./types";
import {
  cellsOf,
  entryPoint,
  indexInSlot,
  isSlotComplete,
  nextOpenIndex,
  orderedSlots,
  stepSlot,
  type Coord,
  type Direction,
} from "./cursor";
import {
  Button,
  Card,
  ConfettiBurst,
  TrophyIcon,
  SearchIcon,
  LightbulbIcon,
  SwapIcon,
  BackspaceIcon,
} from "@merky/ui";

export const Play: React.FC<DailyPlayProps> = ({
  publicState,
  phase,
  act,
  t,
}) => {
  const state = publicState as NutshellPublicState | null;

  const [selectedRow, setSelectedRow] = React.useState<number>(0);
  const [selectedCol, setSelectedCol] = React.useState<number>(0);
  const [direction, setDirection] = React.useState<Direction>("across");
  const [statusMessage, setStatusMessage] = React.useState<string>("");

  /**
   * Letters typed but not yet acknowledged by the server.
   *
   * Every keystroke is a POST, and the cursor used to wait for it before
   * moving — which is why typing felt laggy on anything but a fast
   * connection. The letter now lands locally and the request goes out
   * unawaited; the entry clears when the server's grid catches up.
   *
   * `seq` is what makes fast typing safe. Responses can arrive out of order,
   * so an entry is only retired by the response it belongs to: an older
   * response finding a newer `seq` leaves the newer letter alone.
   */
  const [pending, setPending] = React.useState<Map<string, { letter: string | null; seq: number }>>(
    () => new Map()
  );
  const seqRef = React.useRef(0);

  // Announce phase changes
  React.useEffect(() => {
    if (phase === "solved") {
      setStatusMessage(t("daily.nutshell.solved"));
    } else if (phase === "failed") {
      setStatusMessage(t("daily.nutshell.failed"));
    }
  }, [phase, t]);

  if (!state || !state.grid) {
    return (
      <div className="p-4 text-center font-bold">
        {t("daily.nutshell.loading") ?? "Loading..."}
      </div>
    );
  }

  const { grid: serverGrid, across, down, checksUsed, revealsUsed } = state;

  // The board the player sees: the server's grid with un-acknowledged
  // keystrokes painted on top.
  const grid: NutshellCell[][] = React.useMemo(() => {
    if (pending.size === 0) return serverGrid;
    return serverGrid.map((row, r) =>
      row.map((cell, c) => {
        const p = pending.get(`${r}-${c}`);
        return p ? { ...cell, letter: p.letter, checked: false, correct: undefined } : cell;
      })
    );
  }, [serverGrid, pending]);

  /** A cell still wants a letter. Revealed cells are never "open" — they are
   *  correct by construction and the server refuses to overwrite them. */
  const isOpen = React.useCallback(
    (c: Coord): boolean => {
      const cell = grid[c.row]?.[c.col];
      if (!cell || cell.blocked || cell.revealed) return false;
      return !cell.letter;
    },
    [grid]
  );

  // Find clue numbers for cells
  const getCellNumber = (r: number, c: number): number | null => {
    const aSlot = across.find((s) => s.row === r && s.col === c);
    const dSlot = down.find((s) => s.row === r && s.col === c);
    return aSlot?.number ?? dSlot?.number ?? null;
  };

  // Find active slot for selection
  const activeSlot = React.useMemo(() => {
    if (direction === "across") {
      return across.find(
        (s) =>
          s.row === selectedRow &&
          selectedCol >= s.col &&
          selectedCol < s.col + s.length
      );
    } else {
      return down.find(
        (s) =>
          s.col === selectedCol &&
          selectedRow >= s.row &&
          selectedRow < s.row + s.length
      );
    }
  }, [across, down, direction, selectedRow, selectedCol]);

  // Check if cell is in active word
  const isInActiveWord = (r: number, c: number): boolean => {
    if (!activeSlot) return false;
    if (direction === "across") {
      return (
        r === activeSlot.row &&
        c >= activeSlot.col &&
        c < activeSlot.col + activeSlot.length
      );
    } else {
      return (
        c === activeSlot.col &&
        r >= activeSlot.row &&
        r < activeSlot.row + activeSlot.length
      );
    }
  };

  // Ensure selection is valid (not on a blocked cell)
  React.useEffect(() => {
    if (grid[selectedRow]?.[selectedCol]?.blocked) {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (!grid[r]?.[c]?.blocked) {
            setSelectedRow(r);
            setSelectedCol(c);
            return;
          }
        }
      }
    }
  }, [grid, selectedRow, selectedCol]);

  const handleCellClick = (r: number, c: number) => {
    if (grid[r]?.[c]?.blocked) return;
    if (r === selectedRow && c === selectedCol) {
      setDirection((d) => (d === "across" ? "down" : "across"));
    } else {
      setSelectedRow(r);
      setSelectedCol(c);
      // Check if current direction works at (r, c), else toggle
      const hasAcross = across.some(
        (s) => s.row === r && c >= s.col && c < s.col + s.length
      );
      const hasDown = down.some(
        (s) => s.col === c && r >= s.row && r < s.row + s.length
      );
      if (direction === "across" && !hasAcross && hasDown) {
        setDirection("down");
      } else if (direction === "down" && !hasDown && hasAcross) {
        setDirection("across");
      }
    }
  };

  const ordered = React.useMemo(() => orderedSlots(across, down), [across, down]);

  /** Move to the clue `step` places along, landing on its first open cell. */
  const goToSlot = React.useCallback(
    (step: number) => {
      const target = stepSlot(
        ordered,
        activeSlot ? { direction, number: activeSlot.number } : null,
        step
      );
      if (!target) return;
      const at = entryPoint(target.slot, target.direction, isOpen);
      setDirection(target.direction);
      setSelectedRow(at.row);
      setSelectedCol(at.col);
    },
    [ordered, activeSlot, direction, isOpen]
  );

  /**
   * Where the cursor goes after a letter is typed.
   *
   * `writtenAt` is passed in rather than read from state because this runs in
   * the same tick as the write — `grid` has already been updated through the
   * pending overlay, but the cell just typed into is no longer "open", so it
   * would otherwise be skipped as if a crossing had filled it.
   */
  const advanceAfterInput = React.useCallback(
    (writtenAt: Coord) => {
      if (!activeSlot) return;
      const from = indexInSlot(activeSlot, direction, writtenAt);
      if (from === -1) return;

      // `grid` is this render's grid, which does not yet include the letter we
      // just wrote — setPending has not re-rendered. Treat the square being
      // typed into as filled, or the word never looks finished and the
      // auto-advance below never fires.
      const isOpenAfterWrite = (c: Coord) =>
        c.row === writtenAt.row && c.col === writtenAt.col ? false : isOpen(c);

      const next = nextOpenIndex(activeSlot, direction, from, isOpenAfterWrite);
      if (next !== null) {
        const cell = cellsOf(activeSlot, direction)[next]!;
        setSelectedRow(cell.row);
        setSelectedCol(cell.col);
        return;
      }

      // Nothing left open in this word. If the word is now complete, move on
      // to the next clue the way a solver expects; otherwise sit on the last
      // cell rather than jumping somewhere surprising.
      if (isSlotComplete(activeSlot, direction, isOpenAfterWrite)) {
        goToSlot(1);
      } else {
        const cells = cellsOf(activeSlot, direction);
        const last = cells[cells.length - 1]!;
        setSelectedRow(last.row);
        setSelectedCol(last.col);
      }
    },
    [activeSlot, direction, isOpen, goToSlot]
  );

  /**
   * Writes a letter locally, moves the cursor, and syncs in the background.
   * Nothing here awaits the network — that wait was the typing lag.
   */
  const writeCell = React.useCallback(
    (at: Coord, letter: string | null) => {
      const key = `${at.row}-${at.col}`;
      const seq = ++seqRef.current;

      setPending((prev) => new Map(prev).set(key, { letter, seq }));

      void act("set_cell", { row: at.row, col: at.col, letter }).then((res) => {
        setPending((prev) => {
          const current = prev.get(key);
          // A newer keystroke for this cell has already superseded us; leave it.
          if (!current || current.seq !== seq) return prev;
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        if (!res.ok) setStatusMessage(res.error);
      });
    },
    [act]
  );

  const handleInputLetter = (letter: string) => {
    if (phase !== "in_progress") return;
    const at = { row: selectedRow, col: selectedCol };
    if (grid[at.row]?.[at.col]?.revealed) return;
    writeCell(at, letter.toUpperCase());
    advanceAfterInput(at);
  };

  const handleBackspace = () => {
    if (phase !== "in_progress") return;
    const currentCell = grid[selectedRow]?.[selectedCol];
    if (currentCell?.revealed) return;

    if (currentCell?.letter) {
      writeCell({ row: selectedRow, col: selectedCol }, null);
      return;
    }

    // Empty square: step back and clear whatever is behind us. The previous
    // cell is computed here rather than read from state after retreatCursor,
    // since that setState has not landed yet.
    if (!activeSlot) return;
    const at = { row: selectedRow, col: selectedCol };
    const i = indexInSlot(activeSlot, direction, at);
    if (i <= 0) return;
    const prev = cellsOf(activeSlot, direction)[i - 1]!;
    if (grid[prev.row]?.[prev.col]?.revealed) return;

    setSelectedRow(prev.row);
    setSelectedCol(prev.col);
    writeCell(prev, null);
  };

  // Native keyboard events
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase !== "in_progress") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        handleInputLetter(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === " ") {
        e.preventDefault();
        setDirection((d) => (d === "across" ? "down" : "across"));
      } else if (e.key === "Enter" || e.key === "Tab") {
        // The NYT convention, and the one a playtester expected: Enter moves
        // to the next clue rather than flipping direction. Shift walks back.
        e.preventDefault();
        goToSlot(e.shiftKey ? -1 : 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (selectedCol < 4 && !grid[selectedRow]?.[selectedCol + 1]?.blocked) {
          setSelectedCol(selectedCol + 1);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (selectedCol > 0 && !grid[selectedRow]?.[selectedCol - 1]?.blocked) {
          setSelectedCol(selectedCol - 1);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (selectedRow < 4 && !grid[selectedRow + 1]?.[selectedCol]?.blocked) {
          setSelectedRow(selectedRow + 1);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (selectedRow > 0 && !grid[selectedRow - 1]?.[selectedCol]?.blocked) {
          setSelectedRow(selectedRow - 1);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, selectedRow, selectedCol, direction, grid, activeSlot, goToSlot, writeCell]);

  const handleCheckCell = async () => {
    const res = await act("check_cell", {
      row: selectedRow,
      col: selectedCol,
    });
    if (!res.ok) setStatusMessage(res.error);
  };

  const handleCheckAll = async () => {
    const res = await act("check_all");
    if (!res.ok) setStatusMessage(res.error);
  };

  const handleRevealCell = async () => {
    const res = await act("reveal_cell", {
      row: selectedRow,
      col: selectedCol,
    });
    if (!res.ok) setStatusMessage(res.error);
  };

  const handleSubmit = async () => {
    const res = await act("submit");
    if (!res.ok) {
      setStatusMessage(
        t("daily.nutshell.incomplete_error") ?? "Grid is incomplete or incorrect"
      );
    }
  };

  const handleGiveUp = async () => {
    await act("give_up");
  };

  const keyboardRows = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"],
  ];

  return (
    // A crossword is square, so unlike Nexus and Relay this one keeps a cap —
    // but it is a cap on the *board*, not on the page, and it rises with the
    // viewport rather than freezing at phone width. See DESIGN.md §7a.
    <div className="flex flex-col items-center justify-between w-full p-2 min-h-[500px] select-none text-[var(--mb-text)]">
      {/* Screen Reader Announcements */}
      <div aria-live="polite" className="sr-only">
        {statusMessage}
      </div>

      {phase === "solved" && <ConfettiBurst />}

      {/* Header & Status */}
      <Card className="w-full mb-2 p-3 bg-[var(--mb-surface)] border-2 border-black shadow-[var(--mb-shadow)]">
        {/* Wraps at the 320px floor instead of letting the counters collide
            with the title — DESIGN.md §7b. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {/* The shell's header owns the game name; this row is just counters. */}
          <h2 className="text-sm font-black uppercase tracking-wider text-[var(--mb-violet)]">
            {t("daily.nutshell.progressLabel")}
          </h2>
          <div className="text-xs font-bold flex gap-3 text-[var(--mb-text-dim)]">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <SearchIcon className="w-3.5 h-3.5 shrink-0" />
              {t("daily.nutshell.checks_used", { count: checksUsed }) ?? `Checks: ${checksUsed}`}
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <LightbulbIcon className="w-3.5 h-3.5 shrink-0" />
              {t("daily.nutshell.reveals_used", { count: revealsUsed }) ?? `Reveals: ${revealsUsed}`}
            </span>
          </div>
        </div>
      </Card>

      {/* End state notifications */}
      {phase === "solved" && (
        <Card className="w-full mb-3 p-3 !bg-[var(--mb-accent-2)] border-2 border-black text-center">
          <h3 className="flex items-center justify-center gap-2 text-lg font-bold text-[var(--mb-on-accent-2)]">
            <TrophyIcon className="w-5 h-5" />
            {t("daily.nutshell.solved")}
          </h3>
        </Card>
      )}

      {phase === "failed" && (
        <Card className="w-full mb-3 p-3 !bg-[var(--mb-danger)] border-2 border-black text-center">
          <h3 className="text-lg font-bold text-[var(--mb-on-danger)]">
            {t("daily.nutshell.failed")}
          </h3>
        </Card>
      )}

      {/* Active Clue Header */}
      <button
        type="button"
        onClick={() => setDirection((d) => (d === "across" ? "down" : "across"))}
        className="w-full min-h-[44px] p-2 mb-2 bg-[var(--mb-surface-2)] border-2 border-black rounded-md font-bold text-sm text-left flex items-center justify-between hover:bg-[var(--mb-surface-3)] transition-colors gap-2"
        aria-label="Active clue, tap to toggle direction"
      >
        <span className="min-w-0 flex-1">
          <strong className="uppercase mr-2 text-[var(--mb-violet)]">
            {activeSlot ? `${activeSlot.number} ${direction}:` : `${direction}:`}
          </strong>
          {activeSlot?.clue ?? (t("daily.nutshell.no_clue") ?? "Select a word")}
        </span>
        <span className="shrink-0 flex items-center gap-1 text-xs px-2 py-0.5 bg-[var(--mb-accent)] text-[var(--mb-on-accent)] rounded font-black">
          {direction.toUpperCase()}
          <SwapIcon className="w-3.5 h-3.5" />
        </span>
      </button>

      {/* 5x5 Grid */}
      <div
        className="grid grid-cols-5 gap-1.5 p-2 bg-[var(--mb-surface-3)] rounded-lg shadow-md border-4 border-black"
        role="grid"
        aria-label="Crossword Grid"
      >
        {grid.map((row, r) =>
          row.map((cell: NutshellCell, c: number) => {
            const isSelected = r === selectedRow && c === selectedCol;
            const isWordActive = isInActiveWord(r, c);
            const num = getCellNumber(r, c);

            if (cell.blocked) {
              return (
                <div
                  key={`${r}-${c}`}
                  className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-[var(--mb-ink)] rounded-sm border border-black"
                  role="gridcell"
                />
              );
            }

            let cellBg = "bg-[var(--mb-paper)] text-[var(--mb-ink)]";
            if (isSelected) {
              cellBg = "bg-[var(--mb-gold)] text-[var(--mb-on-gold)] font-black";
            } else if (isWordActive) {
              cellBg = "bg-[var(--mb-gold)]/30 text-[var(--mb-ink)]";
            }

            return (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => handleCellClick(r, c)}
                className={`relative w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 border-2 border-black rounded-sm flex items-center justify-center font-extrabold text-xl sm:text-2xl lg:text-3xl transition-all ${cellBg}`}
                aria-label={`Row ${r + 1}, Column ${c + 1}, ${cell.letter ?? "empty"}`}
                role="gridcell"
              >
                {num !== null && (
                  <span className="absolute top-0.5 left-1 text-[10px] leading-none font-black text-[var(--mb-accent-down)]">
                    {num}
                  </span>
                )}
                <span
                  className={
                    cell.checked
                      ? cell.correct
                        ? "text-[var(--mb-accent-2-down)]"
                        : "text-[var(--mb-danger)] line-through"
                      : cell.revealed
                      ? "text-[var(--mb-on-accent)] font-bold"
                      : ""
                  }
                >
                  {cell.letter ?? ""}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Action Controls — an even four-across row on a phone rather than a
          wrapping pile. Wrapped, these ran to three ragged rows between the
          grid and the keyboard, which is the space that pushed the keyboard
          off-screen entirely. */}
      <div className="w-full grid grid-cols-4 gap-1.5 my-2 sm:my-3 sm:flex sm:flex-wrap sm:gap-2 sm:justify-center">
        <Button
          onClick={handleCheckCell}
          disabled={phase !== "in_progress"}
          variant="secondary"
          className="min-h-[44px] text-[11px] leading-tight sm:text-xs font-bold px-1 sm:px-3"
        >
          {t("daily.nutshell.check_cell")}
        </Button>
        <Button
          onClick={handleCheckAll}
          disabled={phase !== "in_progress"}
          variant="secondary"
          className="min-h-[44px] text-[11px] leading-tight sm:text-xs font-bold px-1 sm:px-3"
        >
          {t("daily.nutshell.check_all")}
        </Button>
        <Button
          onClick={handleRevealCell}
          disabled={phase !== "in_progress"}
          variant="secondary"
          className="min-h-[44px] text-[11px] leading-tight sm:text-xs font-bold px-1 sm:px-3"
        >
          {t("daily.nutshell.reveal_cell")}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={phase !== "in_progress"}
          variant="primary"
          className="min-h-[44px] text-[11px] leading-tight sm:text-xs font-bold px-1 sm:px-4"
        >
          {t("daily.nutshell.submit")}
        </Button>
      </div>

      {/* Give up steps down from a full-width red bar to a quiet ghost
          control, matching Nexus and Relay: it is the one action here you
          cannot take back, so it should not be the loudest thing on screen. */}
      {phase === "in_progress" && (
        <div className="w-full flex justify-center mb-2">
          <Button
            onClick={handleGiveUp}
            variant="ghost"
            className="min-h-[44px] text-xs font-bold px-3 text-[var(--mb-text-dim)] hover:text-[var(--mb-danger)]"
          >
            {t("daily.nutshell.give_up")}
          </Button>
        </div>
      )}

      {/* On-screen Virtual Keyboard — pinned to the bottom of the viewport on
          a phone. Unpinned it sat below the fold under the grid and the
          action row, so typing a letter meant scrolling down to the keyboard,
          which pushed the grid you are filling out of sight. Static from sm
          up, where the whole board already fits. */}
      {phase === "in_progress" && (
        <div className="sticky bottom-0 z-10 -mx-4 w-[calc(100%+2rem)] flex flex-col gap-1.5 items-center border-t-2 border-black bg-[var(--mb-bg)] px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:w-full sm:border-0 sm:bg-transparent sm:p-0">
          {keyboardRows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1 justify-center w-full">
              {row.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleInputLetter(key)}
                  className="min-w-[28px] sm:min-w-[36px] lg:min-w-[44px] min-h-[44px] lg:min-h-[52px] px-1 bg-[var(--mb-surface-2)] text-[var(--mb-text)] font-bold border-2 border-black rounded hover:bg-[var(--mb-surface-3)] transition-colors"
                >
                  {key}
                </button>
              ))}
              {rowIdx === 2 && (
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="min-w-[44px] min-h-[44px] px-2 flex items-center justify-center bg-[var(--mb-danger)]/25 text-[var(--mb-text)] font-bold border-2 border-black rounded hover:bg-[var(--mb-danger)]/40 transition-colors"
                  aria-label="Backspace"
                >
                  <BackspaceIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
