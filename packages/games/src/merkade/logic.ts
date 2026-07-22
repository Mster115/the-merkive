import type { GameAction, GameContext, GameStateIn, ReduceError, ReduceResult, SeatIndex } from "@merky/game-sdk";
import {
  initEngine,
  reduceEngine,
  onTickEngine,
  onSeatAbandonedEngine,
  awaitedSeatsEngine,
  suggestBotActionEngine,
} from "./engine";

export function initMerkadeGame(ctx: GameContext): ReduceResult {
  return initEngine(ctx);
}

export function reduceMerkade(
  ctx: GameContext,
  state: GameStateIn,
  action: GameAction
): ReduceResult | ReduceError {
  return reduceEngine(ctx, state, action);
}

export function onTickMerkade(ctx: GameContext, state: GameStateIn): ReduceResult | null {
  return onTickEngine(ctx, state);
}

export function onSeatAbandonedMerkade(
  ctx: GameContext,
  state: GameStateIn,
  seat: SeatIndex
): ReduceResult | null {
  return onSeatAbandonedEngine(ctx, state, seat);
}

export function awaitedSeatsMerkade(ctx: GameContext, state: GameStateIn): SeatIndex[] {
  return awaitedSeatsEngine(ctx, state);
}

export function suggestBotActionMerkade(
  ctx: GameContext,
  state: GameStateIn,
  seat: SeatIndex
): GameAction | null {
  return suggestBotActionEngine(ctx, state, seat);
}
