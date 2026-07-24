import type { GameEvent } from "@merky/game-sdk";
import { matchRng } from "@merky/game-sdk";
import type {
  DailyAction,
  DailyContentPack,
  DailyContext,
  DailyGameModule,
  DailyReduceError,
  DailyReduceResult,
  DailyStateIn,
} from "./types";
import { isDailyReduceError } from "./types";

export interface DailyTestRun {
  game: DailyGameModule;
  puzzleDate: string;
  seed: string;
  now: number;
  version: number;
  state: DailyStateIn;
  phase: string;
  over: boolean;
  events: GameEvent[];
  log: GameEvent[];
}

export function ctxOf(run: DailyTestRun): DailyContext {
  return {
    gameId: run.game.meta.id,
    puzzleDate: run.puzzleDate,
    seed: run.seed,
    now: run.now,
    rng: matchRng(run.seed, run.version),
  };
}

export function createDailyTestRun(
  game: DailyGameModule,
  opts: {
    puzzleDate: string;
    pack: DailyContentPack;
    seed?: string;
    now?: number;
  }
): DailyTestRun {
  const seed = opts.seed ?? `${game.meta.id}:${opts.puzzleDate}`;
  const now = opts.now ?? 1_750_000_000_000;
  const run: DailyTestRun = {
    game,
    puzzleDate: opts.puzzleDate,
    seed,
    now,
    version: 0,
    state: { publicState: null, secretState: null, phase: "init" },
    phase: "init",
    over: false,
    events: [],
    log: [],
  };

  const initRes = game.init(ctxOf(run), opts.pack);
  run.state = {
    publicState: initRes.publicState,
    secretState: initRes.secretState,
    phase: initRes.phase,
  };
  run.phase = initRes.phase;
  run.version += 1;
  return run;
}

export function applyDailyResult(
  run: DailyTestRun,
  r: DailyReduceResult
): DailyReduceResult {
  run.state = {
    publicState: r.publicState,
    secretState:
      r.secretState !== undefined ? r.secretState : run.state.secretState,
    phase: r.phase,
  };
  run.phase = r.phase;
  if (r.attemptOver) run.over = true;
  run.events.push(...r.events);
  run.log.push(...r.events);
  run.version += 1;
  return r;
}

export function act(
  run: DailyTestRun,
  type: string,
  payload?: unknown
): DailyReduceResult {
  const action: DailyAction = { type, payload };
  const r = run.game.reduce(ctxOf(run), run.state, action);
  if (isDailyReduceError(r)) {
    throw new Error(
      `daily reduce error [${r.code}] ${r.error} — action "${type}" in phase "${run.phase}"`
    );
  }
  return applyDailyResult(run, r);
}

export function actErr(
  run: DailyTestRun,
  type: string,
  payload?: unknown
): DailyReduceError {
  const action: DailyAction = { type, payload };
  const r = run.game.reduce(ctxOf(run), run.state, action);
  if (!isDailyReduceError(r)) {
    throw new Error(
      `expected daily error for action "${type}", but it was accepted (phase → "${r.phase}")`
    );
  }
  return r;
}
