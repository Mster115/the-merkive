import { defineDailyGame } from "../types";
import type {
  DailyAction,
  DailyContentPack,
  DailyContext,
  DailyReduceResult,
  DailyReduceError,
  DailyStateIn,
  DailySummary,
  DailyStatus,
} from "../types";
import { isDailyReduceError } from "../types";
import type { RelayPayload, RelayPublicState } from "./types";
import { findValidChain, findInterchangeableWords } from "./solver";
import { Play } from "./Play";
import { HowToPlay } from "./HowToPlay";

/**
 * Advisory notes for a human reviewing a Relay draft. Never blocks a pack —
 * see findInterchangeableWords for why this is a warning and not a rejection.
 */
export function relayContentWarnings(payload: unknown): string[] {
  const bank = (payload as RelayPayload | null)?.wordBank;
  if (!Array.isArray(bank)) return [];

  return findInterchangeableWords(bank).map(
    (group) =>
      `interchangeable bank words: ${group.join(" / ")} — same first and last letter, ` +
      `so choosing between them decides nothing. Consider swapping one.`
  );
}

/**
 * Content authors write the intended chain first and append the decoys, so an
 * unshuffled bank hands the answer to anyone who reads the first rows in order.
 * Seeded from ctx.rng, so the order is stable for a given attempt.
 */
function shuffleBank(bank: string[], rng: () => number): string[] {
  const out = [...bank];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export const relay = defineDailyGame({
  meta: {
    id: "relay",
    nameKey: "daily.relay.title",
    descriptionKey: "daily.relay.description",
    taglineKey: "daily.relay.tagline",
    estimatedMinutes: 3,
    tags: ["word", "puzzle", "solo"],
  },

  i18n: {
    en: {
      "daily.relay.title": "Relay",
      "daily.relay.description":
        "Pass the word baton — link start to end by matching first and last letters.",
      "daily.relay.tagline": "Daily Word Relay",
      "daily.relay.target": "Target",
      "daily.relay.moves": "Moves",
      "daily.relay.chainHeader": "Current Chain",
      "daily.relay.bankHeader": "Word Bank",
      "daily.relay.nextLetterPrompt": "Starts with",
      "daily.relay.undo": "Undo",
      "daily.relay.submit": "Submit Chain",
      "daily.relay.giveUp": "Give Up",
      "daily.relay.solvedTitle": "Puzzle Solved!",
      "daily.relay.failedTitle": "Puzzle Failed",
      "daily.relay.ariaAdded": "Added {word}. Next word must start with {letter}.",
      "daily.relay.ariaRemoved": "Removed last word.",
      "daily.relay.ariaSolved": "Puzzle solved!",
      "daily.relay.ariaFailed": "Puzzle failed.",
      "daily.relay.howto.goal":
        "Get from the start word to the target word, one word at a time.",
      "daily.relay.howto.step1":
        "Each word must begin with the letter the word before it ended on. The first and last letters are marked for you.",
      "daily.relay.howto.step2":
        "Tap words from the bank to add them to your chain. Undo takes the last one back — you can change your mind as often as you like.",
      "daily.relay.howto.step3":
        "Land on the target word, then hit Submit Chain. Fewer moves is a better score.",
      "daily.relay.howto.note":
        "You will not need every word in the bank — some are there to tempt you.",
      "daily.relay.howto.diagramCaption": "ends in S → starts with S",
      "daily.relay.howto.diagramAlt":
        "CIRCUS links to SUNSET because CIRCUS ends in S and SUNSET starts with S; SUNSET then links to TANGO through the letter T.",
    },
  },

  generatePrompt(puzzleDate: string): string {
    return (
      `Generate a daily word-chain puzzle for ${puzzleDate}. ` +
      `Provide a startWord, an endWord, a valid connecting word chain where each word's first letter ` +
      `matches the previous word's last letter, and several decoy words. ` +
      // A decoy that starts and ends on the same letters as a chain word is a
      // drop-in substitute for it — a playtester hit TANGO and TEMPO in one
      // bank and could take either. It does not make the puzzle wrong (the
      // score is the number of moves), but the choice stops meaning anything.
      // Cheaper to ask for good decoys than to detect bad ones later.
      `Decoys must not be interchangeable with chain words: no two words in the bank should share ` +
      `the same first letter and the same last letter, or the player's choice between them carries no weight. ` +
      `Prefer decoys that start on a letter the chain actually reaches, so they are tempting rather than obviously wrong. ` +
      `Ensure original content, commonly recognized English words, no copyrighted material, and no obscure terms.`
    );
  },

  validatePack(raw: unknown, puzzleDate: string) {
    if (typeof raw !== "object" || raw === null) {
      return { ok: false as const, error: "Raw pack payload must be an object" };
    }

    const envelope = raw as Record<string, unknown>;
    // The pipeline hands us the submission envelope
    // ({ gameId, puzzleDate, payload, sourceRefs }); direct callers and tests
    // may pass the bare payload. Accept both — see daily/types.ts.
    const obj =
      typeof envelope.payload === "object" && envelope.payload !== null
        ? (envelope.payload as Record<string, unknown>)
        : envelope;

    const startWord = typeof obj.startWord === "string" ? obj.startWord.trim().toUpperCase() : "";
    const endWord = typeof obj.endWord === "string" ? obj.endWord.trim().toUpperCase() : "";
    const rawBank = Array.isArray(obj.wordBank) ? obj.wordBank : [];

    if (!startWord || !endWord || rawBank.length === 0) {
      return {
        ok: false as const,
        error: "Pack must specify non-empty startWord, endWord, and wordBank array",
      };
    }

    let wordBank = rawBank
      .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
      .map((w) => w.trim().toUpperCase());

    // Remove startWord from wordBank if present
    wordBank = wordBank.filter((w) => w !== startWord);

    // Ensure endWord is in wordBank
    if (!wordBank.includes(endWord)) {
      wordBank.push(endWord);
    }

    const validPath = findValidChain(startWord, endWord, wordBank);
    if (!validPath) {
      return {
        ok: false as const,
        error: `No valid word chain path found from "${startWord}" to "${endWord}" in submitted wordBank`,
      };
    }

    const sourceRefs = Array.isArray(envelope.sourceRefs)
      ? (envelope.sourceRefs as { url: string; title: string }[])
      : Array.isArray(obj.sourceRefs)
      ? (obj.sourceRefs as { url: string; title: string }[])
      : [];

    const payload: RelayPayload = {
      startWord,
      endWord,
      wordBank,
      parMoves: validPath.length,
    };

    const pack: DailyContentPack = {
      gameId: "relay",
      puzzleDate,
      payload,
      sourceRefs,
    };

    return { ok: true as const, pack };
  },

  init(ctx: DailyContext, pack: DailyContentPack) {
    const payload = pack.payload as RelayPayload;
    const publicState: RelayPublicState = {
      startWord: payload.startWord,
      endWord: payload.endWord,
      wordBank: shuffleBank(payload.wordBank, ctx.rng),
      chain: [payload.startWord],
      usedWords: [],
      movesUsed: 0,
      startedAtMs: ctx.now,
      completedAtMs: null,
    };

    return {
      publicState,
      secretState: payload,
      phase: "in_progress",
    };
  },

  reduce(
    ctx: DailyContext,
    state: DailyStateIn,
    action: DailyAction
  ): DailyReduceResult | DailyReduceError {
    const pub = state.publicState as RelayPublicState;

    // Post-completion guard
    if (state.phase !== "in_progress") {
      if (action.type === "submit" || action.type === "give_up") {
        return {
          publicState: state.publicState,
          secretState: state.secretState,
          phase: state.phase,
          events: [],
        };
      }
      return {
        error: "Attempt is already over",
        code: "attempt_over",
      };
    }

    switch (action.type) {
      case "add_word": {
        const payloadObj = action.payload as { word?: string } | undefined;
        const word = typeof payloadObj?.word === "string" ? payloadObj.word.trim().toUpperCase() : "";

        if (!word || !pub.wordBank.includes(word)) {
          return {
            error: "Word is not in the word bank",
            code: "invalid_word",
          };
        }

        if (pub.usedWords.includes(word)) {
          return {
            error: "Word has already been used",
            code: "invalid_word",
          };
        }

        const currentLastWord = pub.chain[pub.chain.length - 1]!;
        const lastChar = currentLastWord.charAt(currentLastWord.length - 1).toUpperCase();
        const firstChar = word.charAt(0).toUpperCase();

        if (firstChar !== lastChar) {
          return {
            error: "Word does not link to the end of the chain",
            code: "invalid_word",
          };
        }

        const nextPublicState: RelayPublicState = {
          ...pub,
          chain: [...pub.chain, word],
          usedWords: [...pub.usedWords, word],
          movesUsed: pub.movesUsed + 1,
        };

        return {
          publicState: nextPublicState,
          phase: "in_progress",
          events: [],
        };
      }

      case "remove_last": {
        if (pub.chain.length <= 1) {
          return {
            error: "Cannot remove the starting word",
            code: "invalid_remove",
          };
        }

        const removedWord = pub.chain[pub.chain.length - 1]!;
        const nextChain = pub.chain.slice(0, -1);
        const nextUsedWords = pub.usedWords.filter((w) => w !== removedWord);

        const nextPublicState: RelayPublicState = {
          ...pub,
          chain: nextChain,
          usedWords: nextUsedWords,
        };

        return {
          publicState: nextPublicState,
          phase: "in_progress",
          events: [],
        };
      }

      case "submit": {
        const currentLastWord = pub.chain[pub.chain.length - 1];
        if (currentLastWord !== pub.endWord) {
          return {
            error: "Chain does not reach the end word yet",
            code: "incomplete",
          };
        }

        const nextPublicState: RelayPublicState = {
          ...pub,
          completedAtMs: ctx.now,
        };

        return {
          publicState: nextPublicState,
          phase: "solved",
          attemptOver: true,
          events: [],
        };
      }

      case "give_up": {
        const nextPublicState: RelayPublicState = {
          ...pub,
          completedAtMs: ctx.now,
        };

        return {
          publicState: nextPublicState,
          phase: "failed",
          attemptOver: true,
          events: [],
        };
      }

      default: {
        return {
          error: `Unknown action type "${action.type}"`,
          code: "unknown_action",
        };
      }
    }
  },

  summarize(ctx: DailyContext, state: DailyStateIn): DailySummary {
    const pub = state.publicState as RelayPublicState;
    const sec = state.secretState as RelayPayload | undefined;

    const status: DailyStatus =
      state.phase === "solved"
        ? "solved"
        : state.phase === "failed"
        ? "failed"
        : "in_progress";

    const durationMs = pub?.startedAtMs
      ? (pub.completedAtMs ?? ctx.now) - pub.startedAtMs
      : undefined;

    let timeStr = "";
    if (durationMs !== undefined) {
      const totalSeconds = Math.floor(durationMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    }

    let shareText = `Relay — ${ctx.puzzleDate}\n`;
    if (status === "solved") {
      shareText += `Solved in ${pub?.movesUsed ?? 0} moves (${timeStr})`;
    } else if (status === "failed") {
      shareText += `Failed after ${pub?.movesUsed ?? 0} moves`;
    } else {
      shareText += `In progress (${pub?.movesUsed ?? 0} moves)`;
    }

    // Spoiler-free "route" bar, Wordle-style: one square per word actually
    // left in the final chain (green at-or-under the optimal path length,
    // gold if longer or the attempt was abandoned), plus a hollow square for
    // every backtrack — so the shape of the attempt shows without printing a
    // single word.
    const finalLinks = Math.max(0, (pub?.chain?.length ?? 1) - 1);
    const parMoves = sec?.parMoves ?? finalLinks;
    const backtracks = Math.max(0, (pub?.movesUsed ?? 0) - finalLinks);

    const pathChar = status === "failed" ? "🟨" : finalLinks <= parMoves ? "🟩" : "🟨";
    let routeBar = pathChar.repeat(finalLinks) + "⬜".repeat(backtracks);
    if (status === "failed") routeBar += "🟥";

    shareText += `\n\n${routeBar}`;

    return {
      status,
      shareText,
      stats: {
        completed: status === "solved",
        durationMs,
        extra: {
          movesUsed: pub?.movesUsed ?? 0,
          parMoves: sec?.parMoves ?? 0,
        },
      },
    };
  },

  ui: {
    Play,
    HowToPlay,
  },
});
