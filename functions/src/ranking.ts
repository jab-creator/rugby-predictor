/**
 * Pure ranking/leaderboard utilities — no Firestore or Firebase imports.
 *
 * Tiebreaker order (defined in docs/DATA_MODEL.md):
 *   1. totalPoints        DESC
 *   2. correctWinners     DESC
 *   3. sumErrOnCorrectWinners ASC  (lower cumulative error = better)
 *   4. exactScores        DESC
 *   5. lastLockedPredictionAt ASC  (earlier lock = better)
 *
 * Tie handling (sports-style):
 *   - Users identical on ALL tiebreakers share the same rank
 *   - Next distinct user gets rank = previous rank + count of tied users
 *   - position is always sequential (1, 2, 3, ...)
 */

// ==================== Types ====================

/** Input to the ranking function — the tiebreaker fields from user_tournament_stats. */
export interface RankableEntry {
  userId: string;
  displayName: string;
  photoURL?: string;

  totalPoints: number;
  correctWinners: number;
  sumErrOnCorrectWinners: number;
  exactScores: number;
  lastLockedPredictionAt?: number; // epoch millis (null/undefined = Infinity for sorting)
}

/** Output from the ranking function — adds rank, position, percentile. */
export interface RankedEntry extends RankableEntry {
  rank: number;
  position: number;
  percentile: number; // 0–100, 100 = best
}

// ==================== Comparator ====================

/**
 * Compare two entries by the tiebreaker chain.
 * Returns negative if a should rank higher (better) than b.
 */
export function compareTiebreakers(a: RankableEntry, b: RankableEntry): number {
  // 1. totalPoints DESC
  if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;

  // 2. correctWinners DESC
  if (a.correctWinners !== b.correctWinners) return b.correctWinners - a.correctWinners;

  // 3. sumErrOnCorrectWinners ASC (lower is better)
  if (a.sumErrOnCorrectWinners !== b.sumErrOnCorrectWinners)
    return a.sumErrOnCorrectWinners - b.sumErrOnCorrectWinners;

  // 4. exactScores DESC
  if (a.exactScores !== b.exactScores) return b.exactScores - a.exactScores;

  // 5. lastLockedPredictionAt ASC (earlier is better, null/undefined = worst)
  const aTime = a.lastLockedPredictionAt ?? Infinity;
  const bTime = b.lastLockedPredictionAt ?? Infinity;
  if (aTime !== bTime) return aTime - bTime;

  return 0; // Full tie
}

/**
 * Returns true if two entries are tied on ALL tiebreakers.
 */
function isTied(a: RankableEntry, b: RankableEntry): boolean {
  return compareTiebreakers(a, b) === 0;
}

// ==================== Ranking ====================

/**
 * Sort entries and assign tie-aware ranks, sequential positions, and percentiles.
 *
 * Returns a new array (does not mutate input).
 */
export function rankEntries(entries: readonly RankableEntry[]): RankedEntry[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort(compareTiebreakers);
  const total = sorted.length;
  const result: RankedEntry[] = [];

  let currentRank = 1;

  for (let i = 0; i < total; i++) {
    if (i > 0 && !isTied(sorted[i], sorted[i - 1])) {
      currentRank = i + 1; // skip ranks for tied users above
    }

    // percentile: percentage of users this entry is better than or equal to
    // rank 1 out of 100 => percentile 100; rank 100 out of 100 => percentile ~1
    const percentile = total === 1 ? 100 : Math.round(((total - currentRank) / (total - 1)) * 100);

    result.push({
      ...sorted[i],
      rank: currentRank,
      position: i + 1,
      percentile,
    });
  }

  return result;
}

// ==================== Summary Stats ====================

export interface LeaderboardSummaryStats {
  totalUsers: number;
  avgPoints: number;
  medianPoints: number;
  top10AvgPoints: number;
  winnerPoints: number;
  percentileBuckets: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
}

/**
 * Compute summary statistics for a set of ranked entries.
 * Expects entries already sorted by rank (output of rankEntries).
 */
export function computeSummaryStats(ranked: readonly RankedEntry[]): LeaderboardSummaryStats {
  if (ranked.length === 0) {
    return {
      totalUsers: 0,
      avgPoints: 0,
      medianPoints: 0,
      top10AvgPoints: 0,
      winnerPoints: 0,
      percentileBuckets: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 },
    };
  }

  const points = ranked.map(e => e.totalPoints);
  const total = points.length;
  const sum = points.reduce((a, b) => a + b, 0);

  // Points are already sorted DESC (from rankEntries)
  const sortedAsc = [...points].sort((a, b) => a - b);

  const percentileValue = (p: number): number => {
    const idx = Math.ceil((p / 100) * total) - 1;
    return sortedAsc[Math.max(0, Math.min(idx, total - 1))];
  };

  const top10Count = Math.min(10, total);
  const top10Sum = points.slice(0, top10Count).reduce((a, b) => a + b, 0);

  return {
    totalUsers: total,
    avgPoints: Math.round((sum / total) * 100) / 100,
    medianPoints: percentileValue(50),
    top10AvgPoints: Math.round((top10Sum / top10Count) * 100) / 100,
    winnerPoints: points[0],
    percentileBuckets: {
      p10: percentileValue(10),
      p25: percentileValue(25),
      p50: percentileValue(50),
      p75: percentileValue(75),
      p90: percentileValue(90),
    },
  };
}
