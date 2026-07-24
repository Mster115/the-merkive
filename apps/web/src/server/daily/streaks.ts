export interface StreakRow {
  puzzleDate: string;
  status: "in_progress" | "solved" | "failed" | string;
  /**
   * True only when this attempt was completed on puzzle_date itself (strict
   * same-day rule). An archived puzzle solved later still counts toward
   * totalSolved but must never patch a gap in current/longest — see the
   * "Streaks" rollover decision in the Daily Games plan.
   */
  onTime: boolean;
}

export interface StreakSummary {
  current: number;
  longest: number;
  totalSolved: number;
}

function getPrevDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function computeStreaks(rows: StreakRow[], today: string): StreakSummary {
  // totalSolved counts every solved puzzle, including archive catch-up.
  const allSolvedDates = new Set<string>();
  // solvedDates (used for current/longest) is strict same-day only — an
  // archive puzzle solved later must never patch a streak gap.
  const solvedDates = new Set<string>();
  for (const row of rows) {
    if (row.status === "solved") {
      allSolvedDates.add(row.puzzleDate);
      if (row.onTime) {
        solvedDates.add(row.puzzleDate);
      }
    }
  }

  const totalSolved = allSolvedDates.size;

  if (solvedDates.size === 0) {
    return { current: 0, longest: 0, totalSolved };
  }

  // Compute longest consecutive run across all on-time history
  const sortedSolved = Array.from(solvedDates).sort();
  let longest = 0;
  let currentRun = 0;
  let prevDate: string | null = null;

  for (const d of sortedSolved) {
    if (prevDate !== null && getPrevDay(d) === prevDate) {
      currentRun += 1;
    } else {
      currentRun = 1;
    }
    if (currentRun > longest) {
      longest = currentRun;
    }
    prevDate = d;
  }

  // Compute current streak: must end at today or today-1
  let current = 0;
  let checkDate: string | null = null;

  if (solvedDates.has(today)) {
    checkDate = today;
  } else {
    const yesterday = getPrevDay(today);
    if (solvedDates.has(yesterday)) {
      checkDate = yesterday;
    }
  }

  if (checkDate !== null) {
    let curr = checkDate;
    while (solvedDates.has(curr)) {
      current += 1;
      curr = getPrevDay(curr);
    }
  }

  return {
    current,
    longest,
    totalSolved,
  };
}
