/**
 * init/reduce/summarize must be pure and deterministic — no Math.random(),
 * no Date.now(), no I/O, no mutation of inputs. Use ctx.rng/ctx.now only.
 */

import type * as React from "react";
import type { Locale, GameEvent, Translate } from "@merky/game-sdk";

export interface DailyGameMeta {
  id: string;
  nameKey: string;
  descriptionKey: string;
  taglineKey?: string;
  estimatedMinutes: number;
  tags: string[];
}

export interface DailyContentPack {
  gameId: string;
  puzzleDate: string; // "YYYY-MM-DD"
  payload: unknown;   // game-specific, opaque to the platform; INCLUDES the answer key
  sourceRefs: { url: string; title: string }[];
}

export interface DailyContext {
  gameId: string;
  puzzleDate: string;
  seed: string;
  now: number;
  rng: () => number;
}

export interface DailyStateIn {
  publicState: unknown;
  secretState: unknown;
  phase: string;
}

export interface DailyAction {
  type: string;
  payload?: unknown;
}

export interface DailyReduceResult {
  publicState: unknown;
  secretState?: unknown; // omit = keep previous; present (incl. null) = full replace
  phase: string;
  events: GameEvent[];
  attemptOver?: boolean; // set exactly once, mirrors room `matchOver` semantics
}

export interface DailyReduceError {
  error: string;
  code: string; // snake_case
}

export function isDailyReduceError(
  r: DailyReduceResult | DailyReduceError
): r is DailyReduceError {
  return typeof r === "object" && r !== null && "error" in r;
}

export type DailyStatus = "in_progress" | "solved" | "failed";

export interface DailySummary {
  status: DailyStatus;
  shareText: string; // spoiler-free, emoji-grid style
  stats: {
    completed: boolean;
    durationMs?: number;
    score?: number;
    extra?: Record<string, number | string>;
  };
}

export interface DailyPlayProps {
  meta: DailyGameMeta;
  puzzleDate: string;
  publicState: unknown;
  phase: string;
  act: (
    type: string,
    payload?: unknown
  ) => Promise<{ ok: true } | { ok: false; code: string; error: string }>;
  t: Translate;
  now: number;
}

export interface DailyGameModule {
  meta: DailyGameMeta;
  i18n: Partial<Record<Locale, Record<string, string>>>; // keys prefixed `daily.<id>.*`
  /** Research brief for the content pipeline: what to find/verify for this date. */
  generatePrompt(puzzleDate: string): string;
  /** Validates+normalizes a raw submission before it's allowed into the content queue. */
  validatePack(
    raw: unknown,
    puzzleDate: string
  ): { ok: true; pack: DailyContentPack } | { ok: false; error: string };
  /** Splits the full (secret-containing) pack into initial public/secret state. Server-only. */
  init(
    ctx: DailyContext,
    pack: DailyContentPack
  ): { publicState: unknown; secretState: unknown; phase: string };
  /** Validate + apply an intent. Pure given (ctx, state, action). Never throws. */
  reduce(
    ctx: DailyContext,
    state: DailyStateIn,
    action: DailyAction
  ): DailyReduceResult | DailyReduceError;
  /** Pure derivation of status/share-text/stats. Must be side-effect-free and produce the
   *  same output given the same state (used both server-side at completion and client-side
   *  for instant share-card rendering — no drift allowed between the two call sites). */
  summarize(ctx: DailyContext, state: DailyStateIn): DailySummary;
  ui: {
    Play: React.ComponentType<DailyPlayProps>;
    HowToPlay?: React.ComponentType<{ t: Translate }>;
  };
}

export function defineDailyGame(mod: DailyGameModule): DailyGameModule {
  return mod;
}
