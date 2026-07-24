import * as React from "react";
import type { DailyPlayProps } from "../types";
import type { NutshellPublicState, NutshellCell } from "./types";
import { Button, Card, ConfettiBurst } from "@merky/ui";

export const Play: React.FC<DailyPlayProps> = ({
  publicState,
  phase,
  act,
  t,
}) => {
  const state = publicState as NutshellPublicState | null;

  const [selectedRow, setSelectedRow] = React.useState<number>(0);
  const [selectedCol, setSelectedCol] = React.useState<number>(0);
  const [direction, setDirection] = React.useState<"across" | "down">("across");
  const [statusMessage, setStatusMessage] = React.useState<string>("");

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

  const { grid, across, down, checksUsed, revealsUsed } = state;

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

  const advanceCursor = () => {
    if (direction === "across") {
      if (
        activeSlot &&
        selectedCol + 1 < activeSlot.col + activeSlot.length
      ) {
        setSelectedCol(selectedCol + 1);
      }
    } else {
      if (
        activeSlot &&
        selectedRow + 1 < activeSlot.row + activeSlot.length
      ) {
        setSelectedRow(selectedRow + 1);
      }
    }
  };

  const retreatCursor = () => {
    if (direction === "across") {
      if (activeSlot && selectedCol - 1 >= activeSlot.col) {
        setSelectedCol(selectedCol - 1);
      }
    } else {
      if (activeSlot && selectedRow - 1 >= activeSlot.row) {
        setSelectedRow(selectedRow - 1);
      }
    }
  };

  const handleInputLetter = async (letter: string) => {
    if (phase !== "in_progress") return;
    const upper = letter.toUpperCase();
    const res = await act("set_cell", {
      row: selectedRow,
      col: selectedCol,
      letter: upper,
    });
    if (res.ok) {
      advanceCursor();
    } else {
      setStatusMessage(res.error);
    }
  };

  const handleBackspace = async () => {
    if (phase !== "in_progress") return;
    const currentCell = grid[selectedRow]?.[selectedCol];
    if (currentCell?.letter) {
      await act("set_cell", {
        row: selectedRow,
        col: selectedCol,
        letter: null,
      });
    } else {
      retreatCursor();
      await act("set_cell", {
        row: selectedRow,
        col: selectedCol,
        letter: null,
      });
    }
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
        void handleInputLetter(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        void handleBackspace();
      } else if (e.key === " ") {
        e.preventDefault();
        setDirection((d) => (d === "across" ? "down" : "across"));
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
  }, [phase, selectedRow, selectedCol, direction, grid]);

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
    <div className="flex flex-col items-center justify-between w-full max-w-md mx-auto p-2 min-h-[500px] select-none text-slate-900 dark:text-slate-100">
      {/* Screen Reader Announcements */}
      <div aria-live="polite" className="sr-only">
        {statusMessage}
      </div>

      {phase === "solved" && <ConfettiBurst />}

      {/* Header & Status */}
      <div className="w-full flex items-center justify-between px-2 py-1 mb-2 border-b-2 border-slate-900 dark:border-slate-100">
        <h2 className="text-xl font-black uppercase tracking-wider">
          {t("daily.nutshell.name")}
        </h2>
        <div className="text-xs font-bold flex gap-3">
          <span>🔍 {t("daily.nutshell.checks_used", { count: checksUsed }) ?? `Checks: ${checksUsed}`}</span>
          <span>💡 {t("daily.nutshell.reveals_used", { count: revealsUsed }) ?? `Reveals: ${revealsUsed}`}</span>
        </div>
      </div>

      {/* End state notifications */}
      {phase === "solved" && (
        <Card className="w-full mb-3 p-3 bg-emerald-100 dark:bg-emerald-950 border-emerald-500 text-center">
          <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
            🎉 {t("daily.nutshell.solved")}
          </h3>
        </Card>
      )}

      {phase === "failed" && (
        <Card className="w-full mb-3 p-3 bg-rose-100 dark:bg-rose-950 border-rose-500 text-center">
          <h3 className="text-lg font-bold text-rose-800 dark:text-rose-200">
            {t("daily.nutshell.failed")}
          </h3>
        </Card>
      )}

      {/* Active Clue Header */}
      <button
        type="button"
        onClick={() => setDirection((d) => (d === "across" ? "down" : "across"))}
        className="w-full min-h-[44px] p-2 mb-2 bg-amber-100 dark:bg-amber-950 border-2 border-slate-900 dark:border-slate-100 rounded-md font-bold text-sm text-left flex items-center justify-between hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
        aria-label="Active clue, tap to toggle direction"
      >
        <span>
          <strong className="uppercase mr-2">
            {activeSlot ? `${activeSlot.number} ${direction}:` : `${direction}:`}
          </strong>
          {activeSlot?.clue ?? (t("daily.nutshell.no_clue") ?? "Select a word")}
        </span>
        <span className="text-xs px-2 py-0.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded font-black">
          {direction.toUpperCase()} ⟲
        </span>
      </button>

      {/* 5x5 Grid */}
      <div
        className="grid grid-cols-5 gap-1.5 p-2 bg-slate-900 dark:bg-slate-800 rounded-lg shadow-md border-4 border-slate-900 dark:border-slate-100"
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
                  className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-950 rounded-sm border border-slate-950"
                  role="gridcell"
                />
              );
            }

            let cellBg = "bg-white dark:bg-slate-900";
            if (isSelected) {
              cellBg = "bg-amber-300 dark:bg-amber-600 font-black";
            } else if (isWordActive) {
              cellBg = "bg-amber-100 dark:bg-amber-900";
            }

            return (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => handleCellClick(r, c)}
                className={`relative w-12 h-12 sm:w-14 sm:h-14 border-2 border-slate-900 dark:border-slate-100 rounded-sm flex items-center justify-center font-extrabold text-xl sm:text-2xl transition-all ${cellBg}`}
                aria-label={`Row ${r + 1}, Column ${c + 1}, ${cell.letter ?? "empty"}`}
                role="gridcell"
              >
                {num !== null && (
                  <span className="absolute top-0.5 left-1 text-[10px] leading-none font-bold text-slate-700 dark:text-slate-300">
                    {num}
                  </span>
                )}
                <span
                  className={
                    cell.checked
                      ? cell.correct
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400 line-through"
                      : cell.revealed
                      ? "text-blue-600 dark:text-blue-400 font-bold"
                      : "text-slate-900 dark:text-slate-100"
                  }
                >
                  {cell.letter ?? ""}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Action Controls */}
      <div className="w-full flex flex-wrap gap-2 justify-center my-3">
        <Button
          onClick={handleCheckCell}
          disabled={phase !== "in_progress"}
          variant="secondary"
          className="min-h-[44px] text-xs font-bold px-3"
        >
          {t("daily.nutshell.check_cell")}
        </Button>
        <Button
          onClick={handleCheckAll}
          disabled={phase !== "in_progress"}
          variant="secondary"
          className="min-h-[44px] text-xs font-bold px-3"
        >
          {t("daily.nutshell.check_all")}
        </Button>
        <Button
          onClick={handleRevealCell}
          disabled={phase !== "in_progress"}
          variant="secondary"
          className="min-h-[44px] text-xs font-bold px-3"
        >
          {t("daily.nutshell.reveal_cell")}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={phase !== "in_progress"}
          variant="primary"
          className="min-h-[44px] text-xs font-bold px-4"
        >
          {t("daily.nutshell.submit")}
        </Button>
        {phase === "in_progress" && (
          <Button
            onClick={handleGiveUp}
            variant="danger"
            className="min-h-[44px] text-xs font-bold px-3"
          >
            {t("daily.nutshell.give_up")}
          </Button>
        )}
      </div>

      {/* On-screen Virtual Keyboard */}
      {phase === "in_progress" && (
        <div className="w-full flex flex-col gap-1.5 items-center">
          {keyboardRows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1 justify-center w-full">
              {row.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleInputLetter(key)}
                  className="min-w-[30px] sm:min-w-[36px] min-h-[44px] px-1 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold border-2 border-slate-900 dark:border-slate-100 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  {key}
                </button>
              ))}
              {rowIdx === 2 && (
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="min-w-[44px] min-h-[44px] px-2 bg-rose-200 dark:bg-rose-900 text-slate-900 dark:text-slate-100 font-bold border-2 border-slate-900 dark:border-slate-100 rounded hover:bg-rose-300 dark:hover:bg-rose-800 transition-colors"
                  aria-label="Backspace"
                >
                  ⌫
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
