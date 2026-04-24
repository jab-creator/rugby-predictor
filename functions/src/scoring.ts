/**
 * Pure scoring functions — no Firestore or Firebase imports.
 * Follows docs/SCORING.md exactly.
 */

// ==================== Constants ====================

const WINNER_PTS = 10;

const MARGIN_BONUS_TABLE: ReadonlyArray<{ maxErr: number; bonus: number }> = [
  { maxErr: 2, bonus: 10 },
  { maxErr: 5, bonus: 7 },
  { maxErr: 9, bonus: 5 },
  { maxErr: 14, bonus: 2 },
];

// ==================== Types ====================

export interface MatchResult {
  homeScore: number;
  awayScore: number;
}

export interface Prediction {
  pickedWinnerTeamId: string | null;
  pickedMargin: number | null;
}

export interface MatchContext {
  homeTeamId: string;
  awayTeamId: string;
}

export interface PredictionScore {
  winnerCorrect: boolean;
  err: number;
  marginBonus: number;
  totalPoints: number;
}

export interface StatsIncrement {
  points: number;
  correctWinner: boolean;
  exactScore: boolean;
  errOnCorrectWinner: number; // err value if winner correct, 0 otherwise
}

export interface AggregateStatsState {
  totalPoints: number;
  correctWinners: number;
  sumErrOnCorrectWinners: number;
  exactScores: number;
  scoredMatchCount: number;
  lastScoredMatchId?: string;
  pointsByRound?: Record<string, number>;
  lastLockedPredictionAtMillis?: number;
}

// ==================== Functions ====================

export function marginBonus(err: number): number {
  for (const tier of MARGIN_BONUS_TABLE) {
    if (err <= tier.maxErr) return tier.bonus;
  }
  return 0;
}

/**
 * Score a single prediction against a match result.
 * Returns null if the prediction is incomplete.
 */
export function scorePrediction(
  prediction: Prediction,
  result: MatchResult,
  match: MatchContext,
): PredictionScore | null {
  if (prediction.pickedWinnerTeamId == null || prediction.pickedMargin == null) {
    return null;
  }

  const isDraw = result.homeScore === result.awayScore;
  const actualMargin = Math.abs(result.homeScore - result.awayScore);
  const err = Math.abs(prediction.pickedMargin - actualMargin);
  const bonus = marginBonus(err);

  if (isDraw) {
    return {
      winnerCorrect: false,
      err,
      marginBonus: bonus,
      totalPoints: bonus,
    };
  }

  const actualWinner = result.homeScore > result.awayScore
    ? match.homeTeamId
    : match.awayTeamId;
  const winnerCorrect = prediction.pickedWinnerTeamId === actualWinner;

  return {
    winnerCorrect,
    err,
    marginBonus: bonus,
    totalPoints: winnerCorrect ? WINNER_PTS + bonus : 0,
  };
}


/**
 * Apply a scored prediction to aggregate user tournament stats.
 */
export function applyScoreToAggregateStats(
  current: AggregateStatsState,
  score: PredictionScore,
  round: number,
  matchId: string,
  lockedAtMillis?: number,
): AggregateStatsState {
  const increment = statsIncrement(score);
  const roundKey = String(round);
  const nextLastLockedPredictionAtMillis = lockedAtMillis == null
    ? current.lastLockedPredictionAtMillis
    : Math.max(current.lastLockedPredictionAtMillis ?? 0, lockedAtMillis);

  return {
    totalPoints: current.totalPoints + increment.points,
    correctWinners: current.correctWinners + (increment.correctWinner ? 1 : 0),
    sumErrOnCorrectWinners: current.sumErrOnCorrectWinners + increment.errOnCorrectWinner,
    exactScores: current.exactScores + (increment.exactScore ? 1 : 0),
    scoredMatchCount: current.scoredMatchCount + 1,
    lastScoredMatchId: matchId,
    pointsByRound: {
      ...(current.pointsByRound ?? {}),
      [roundKey]: (current.pointsByRound?.[roundKey] ?? 0) + increment.points,
    },
    ...(nextLastLockedPredictionAtMillis == null ? {} : { lastLockedPredictionAtMillis: nextLastLockedPredictionAtMillis }),
  };
}

/**
 * Derive the stats increment for user_tournament_stats from a scored prediction.
 */
export function statsIncrement(score: PredictionScore): StatsIncrement {
  return {
    points: score.totalPoints,
    correctWinner: score.winnerCorrect,
    exactScore: score.winnerCorrect && score.err === 0,
    errOnCorrectWinner: score.winnerCorrect ? score.err : 0,
  };
}
