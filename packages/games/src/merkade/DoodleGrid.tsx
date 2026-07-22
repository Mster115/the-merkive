"use client";

import * as React from "react";
import { cn } from "@merky/ui";

export const GRID_ROWS = 10;
export const GRID_COLS = 14;

export const COLOR_PALETTE = [
  { id: 0, cssVar: "var(--mb-surface-3)", labelKey: "games.merkade.color.eraser", bgClass: "bg-[var(--mb-surface-3)]" },
  { id: 1, cssVar: "var(--mb-accent)", labelKey: "games.merkade.color.cyan", bgClass: "bg-[var(--mb-accent)]" },
  { id: 2, cssVar: "var(--mb-gold)", labelKey: "games.merkade.color.gold", bgClass: "bg-[var(--mb-gold)]" },
  { id: 3, cssVar: "var(--mb-pink)", labelKey: "games.merkade.color.pink", bgClass: "bg-[var(--mb-pink)]" },
] as const;

export function createEmptyGrid(): number[][] {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0));
}

export function isValidGrid(grid: unknown): grid is number[][] {
  if (!Array.isArray(grid) || grid.length !== GRID_ROWS) return false;
  return grid.every(
    (row) =>
      Array.isArray(row) &&
      row.length === GRID_COLS &&
      row.every((cell) => typeof cell === "number" && cell >= 0 && cell <= 3 && Number.isInteger(cell))
  );
}

interface DoodleGridProps {
  grid?: number[][];
  readOnly?: boolean;
  activeColor?: number;
  onChange?: (newGrid: number[][]) => void;
  className?: string;
}

export function DoodleGrid({
  grid,
  readOnly = true,
  activeColor = 1,
  onChange,
  className,
}: DoodleGridProps) {
  const [isDrawing, setIsDrawing] = React.useState(false);
  const currentGrid = grid && grid.length > 0 ? grid : createEmptyGrid();

  const handleCellPaint = (r: number, c: number) => {
    if (readOnly || !onChange) return;
    const newGrid = currentGrid.map((rowArr, rowIndex) =>
      rowIndex === r
        ? rowArr.map((cellVal, colIndex) => (colIndex === c ? activeColor : cellVal))
        : [...rowArr]
    );
    onChange(newGrid);
  };

  const handlePointerDown = (r: number, c: number, e: React.PointerEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setIsDrawing(true);
    handleCellPaint(r, c);
  };

  const handlePointerEnter = (r: number, c: number, e: React.PointerEvent) => {
    if (readOnly || !isDrawing) return;
    e.preventDefault();
    handleCellPaint(r, c);
  };

  const handlePointerUp = () => {
    if (!readOnly) {
      setIsDrawing(false);
    }
  };

  React.useEffect(() => {
    if (readOnly) return;
    const onUp = () => setIsDrawing(false);
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [readOnly]);

  const numRows = currentGrid.length;
  const numCols = currentGrid[0]?.length ?? 14;

  return (
    <div
      className={cn(
        "relative w-full aspect-[14/10] bg-[var(--mb-surface-2)] p-2 rounded-xl border-[3px] border-black shadow-[var(--mb-shadow)] select-none touch-none",
        className
      )}
      onPointerLeave={handlePointerUp}
    >
      <div
        className="w-full h-full grid gap-0.5 rounded-lg overflow-hidden border border-black/40 bg-[var(--mb-surface-3)]"
        style={{
          gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))`,
          gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
        }}
      >
        {currentGrid.map((rowArr, r) =>
          rowArr.map((colorIdx, c) => {
            const colorObj = COLOR_PALETTE[colorIdx] ?? COLOR_PALETTE[0];
            return (
              <div
                key={`${r}-${c}`}
                onPointerDown={(e) => handlePointerDown(r, c, e)}
                onPointerEnter={(e) => handlePointerEnter(r, c, e)}
                className={cn(
                  "w-full h-full transition-colors duration-75",
                  colorObj.bgClass,
                  !readOnly && "cursor-pointer hover:opacity-80"
                )}
                style={{ backgroundColor: colorObj.cssVar }}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
