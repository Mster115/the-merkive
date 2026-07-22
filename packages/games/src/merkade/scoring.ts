import type { SeatIndex } from "@merky/game-sdk";

export interface ScoreTruthHuntParams {
  options: string[];
  truthIndex: number;
  votesBySeat: Partial<Record<SeatIndex, number>>;
  authorsBySeat: Partial<Record<SeatIndex, number>>;
  artistSeat?: SeatIndex;
  artistBonusPerFooled?: number;
}

export function scoreTruthHunt(params: ScoreTruthHuntParams): Partial<Record<SeatIndex, number>> {
  const { options, truthIndex, votesBySeat, authorsBySeat, artistSeat, artistBonusPerFooled = 250 } = params;
  const roundScores: Record<number, number> = {};

  const seatsWithVotes = Object.keys(votesBySeat).map(Number);

  // 1. Correct truth votes: +1000 each
  for (const seatStr of Object.keys(votesBySeat)) {
    const seat = Number(seatStr);
    const vote = (votesBySeat as Record<number, number | undefined>)[seat];
    if (vote === truthIndex) {
      roundScores[seat] = (roundScores[seat] ?? 0) + 1000;
    }
  }

  // 2. Decoy / guess authors: +500 * (number of *other* seats whose vote === author's optionIndex)
  for (const seatStr of Object.keys(authorsBySeat)) {
    const authorSeat = Number(seatStr);
    const optionIdx = (authorsBySeat as Record<number, number | undefined>)[authorSeat];
    if (optionIdx === undefined) continue;

    let fooledCount = 0;
    for (const voterSeat of seatsWithVotes) {
      if (voterSeat !== authorSeat && (votesBySeat as Record<number, number | undefined>)[voterSeat] === optionIdx) {
        fooledCount++;
      }
    }

    if (fooledCount > 0) {
      roundScores[authorSeat] = (roundScores[authorSeat] ?? 0) + 500 * fooledCount;
    }
  }

  // 3. Doodle artist bonus: +250 * (number of non-artist seats whose vote !== truthIndex)
  if (artistSeat !== undefined) {
    let fooledByArtistCount = 0;
    for (const voterSeat of seatsWithVotes) {
      if (voterSeat !== artistSeat && (votesBySeat as Record<number, number | undefined>)[voterSeat] !== truthIndex) {
        fooledByArtistCount++;
      }
    }
    if (fooledByArtistCount > 0) {
      roundScores[artistSeat] = (roundScores[artistSeat] ?? 0) + artistBonusPerFooled * fooledByArtistCount;
    }
  }

  return roundScores as Partial<Record<SeatIndex, number>>;
}

export interface ScoreMajorityParams {
  choicesBySeat: Partial<Record<SeatIndex, 0 | 1>>;
  predictionsBySeat: Partial<Record<SeatIndex, 0 | 1>>;
}

export interface ScoreMajorityResult {
  counts: [number, number];
  majorityOptionIndex: 0 | 1;
  roundScores: Partial<Record<SeatIndex, number>>;
}

export function scoreMajority(params: ScoreMajorityParams): ScoreMajorityResult {
  const { choicesBySeat, predictionsBySeat } = params;

  let count0 = 0;
  let count1 = 0;

  for (const choice of Object.values(choicesBySeat)) {
    if (choice === 0) count0++;
    else if (choice === 1) count1++;
  }

  const counts: [number, number] = [count0, count1];
  const majorityOptionIndex: 0 | 1 = count0 >= count1 ? 0 : 1;

  const roundScores: Record<number, number> = {};

  for (const [seatStr, prediction] of Object.entries(predictionsBySeat)) {
    const seat = Number(seatStr);
    if (prediction === majorityOptionIndex) {
      roundScores[seat] = 1000;
    } else {
      roundScores[seat] = 0;
    }
  }

  return {
    counts,
    majorityOptionIndex,
    roundScores: roundScores as Partial<Record<SeatIndex, number>>,
  };
}
