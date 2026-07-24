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
import type { MerkChainPayload, MerkChainPublicState } from "./types";
import { findValidChain } from "./solver";
import { Play } from "./Play";

export const merkChain = defineDailyGame({
  meta: {
    id: "merk-chain",
    nameKey: "daily.merk-chain.title",
    descriptionKey: "daily.merk-chain.description",
    taglineKey: "daily.merk-chain.tagline",
    estimatedMinutes: 3,
    tags: ["word", "puzzle", "solo"],
  },

  i18n: {
    en: {
      "daily.merk-chain.title": "Merk Chain",
      "daily.merk-chain.description":
        "Link words from start to end by matching first and last letters.",
      "daily.merk-chain.tagline": "Find the missing links!",
      "daily.merk-chain.target": "Target",
      "daily.merk-chain.moves": "Moves",
      "daily.merk-chain.chainHeader": "Current Chain",
      "daily.merk-chain.bankHeader": "Word Bank",
      "daily.merk-chain.nextLetterPrompt": "Starts with",
      "daily.merk-chain.undo": "Undo",
      "daily.merk-chain.submit": "Submit Chain",
      "daily.merk-chain.giveUp": "Give Up",
      "daily.merk-chain.solvedTitle": "Puzzle Solved!",
      "daily.merk-chain.failedTitle": "Puzzle Failed",
      "daily.merk-chain.ariaAdded": "Added {word}. Next word must start with {letter}.",
      "daily.merk-chain.ariaRemoved": "Removed last word.",
      "daily.merk-chain.ariaSolved": "Puzzle solved!",
      "daily.merk-chain.ariaFailed": "Puzzle failed.",
    },
  },

  generatePrompt(puzzleDate: string): string {
    return (
      `Generate a daily word-chain puzzle for ${puzzleDate}. ` +
      `Provide a startWord, an endWord, a valid connecting word chain where each word's first letter ` +
      `matches the previous word's last letter, and several decoy words. ` +
      `Ensure original content, commonly recognized English words, no copyrighted material, and no obscure terms.`
    );
  },

  validatePack(raw: unknown, puzzleDate: string) {
    if (typeof raw !== "object" || raw === null) {
      return { ok: false as const, error: "Raw pack payload must be an object" };
    }

    const obj = raw as Record<string, unknown>;
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

    const sourceRefs = Array.isArray(obj.sourceRefs)
      ? (obj.sourceRefs as { url: string; title: string }[])
      : [];

    const payload: MerkChainPayload = {
      startWord,
      endWord,
      wordBank,
      parMoves: validPath.length,
    };

    const pack: DailyContentPack = {
      gameId: "merk-chain",
      puzzleDate,
      payload,
      sourceRefs,
    };

    return { ok: true as const, pack };
  },

  init(ctx: DailyContext, pack: DailyContentPack) {
    const payload = pack.payload as MerkChainPayload;
    const publicState: MerkChainPublicState = {
      startWord: payload.startWord,
      endWord: payload.endWord,
      wordBank: payload.wordBank,
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
    const pub = state.publicState as MerkChainPublicState;

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

        const nextPublicState: MerkChainPublicState = {
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

        const nextPublicState: MerkChainPublicState = {
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

        const nextPublicState: MerkChainPublicState = {
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
        const nextPublicState: MerkChainPublicState = {
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
    const pub = state.publicState as MerkChainPublicState;
    const sec = state.secretState as MerkChainPayload | undefined;

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

    let shareText = `Merk Chain — ${ctx.puzzleDate}\n`;
    if (status === "solved") {
      shareText += `Solved in ${pub?.movesUsed ?? 0} moves (${timeStr})`;
    } else if (status === "failed") {
      shareText += `Failed after ${pub?.movesUsed ?? 0} moves`;
    } else {
      shareText += `In progress (${pub?.movesUsed ?? 0} moves)`;
    }

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
  },
});
