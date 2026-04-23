import { compareTiebreakers, rankEntries, computeSummaryStats, RankableEntry } from './ranking';

function entry(overrides: Partial<RankableEntry> & { userId: string }): RankableEntry {
  return {
    displayName: overrides.userId,
    totalPoints: 0,
    correctWinners: 0,
    sumErrOnCorrectWinners: 0,
    exactScores: 0,
    ...overrides,
  };
}

// ==================== compareTiebreakers ====================

describe('compareTiebreakers', () => {
  it('higher totalPoints ranks first', () => {
    const a = entry({ userId: 'a', totalPoints: 50 });
    const b = entry({ userId: 'b', totalPoints: 40 });
    expect(compareTiebreakers(a, b)).toBeLessThan(0);
  });

  it('same points, higher correctWinners ranks first', () => {
    const a = entry({ userId: 'a', totalPoints: 50, correctWinners: 4 });
    const b = entry({ userId: 'b', totalPoints: 50, correctWinners: 3 });
    expect(compareTiebreakers(a, b)).toBeLessThan(0);
  });

  it('same correctWinners, lower sumErrOnCorrectWinners ranks first', () => {
    const a = entry({ userId: 'a', totalPoints: 50, correctWinners: 4, sumErrOnCorrectWinners: 8 });
    const b = entry({ userId: 'b', totalPoints: 50, correctWinners: 4, sumErrOnCorrectWinners: 12 });
    expect(compareTiebreakers(a, b)).toBeLessThan(0);
  });

  it('same sumErr, higher exactScores ranks first', () => {
    const a = entry({ userId: 'a', totalPoints: 50, correctWinners: 4, sumErrOnCorrectWinners: 8, exactScores: 2 });
    const b = entry({ userId: 'b', totalPoints: 50, correctWinners: 4, sumErrOnCorrectWinners: 8, exactScores: 1 });
    expect(compareTiebreakers(a, b)).toBeLessThan(0);
  });

  it('same exactScores, earlier lastLockedPredictionAt ranks first', () => {
    const a = entry({ userId: 'a', totalPoints: 50, correctWinners: 4, sumErrOnCorrectWinners: 8, exactScores: 2, lastLockedPredictionAt: 1000 });
    const b = entry({ userId: 'b', totalPoints: 50, correctWinners: 4, sumErrOnCorrectWinners: 8, exactScores: 2, lastLockedPredictionAt: 2000 });
    expect(compareTiebreakers(a, b)).toBeLessThan(0);
  });

  it('full tie returns 0', () => {
    const a = entry({ userId: 'a', totalPoints: 50, correctWinners: 4, sumErrOnCorrectWinners: 8, exactScores: 2, lastLockedPredictionAt: 1000 });
    const b = entry({ userId: 'b', totalPoints: 50, correctWinners: 4, sumErrOnCorrectWinners: 8, exactScores: 2, lastLockedPredictionAt: 1000 });
    expect(compareTiebreakers(a, b)).toBe(0);
  });

  it('null lastLockedPredictionAt is worse than any timestamp', () => {
    const a = entry({ userId: 'a', totalPoints: 50, lastLockedPredictionAt: 9999999 });
    const b = entry({ userId: 'b', totalPoints: 50 }); // undefined
    expect(compareTiebreakers(a, b)).toBeLessThan(0);
  });
});

// ==================== rankEntries ====================

describe('rankEntries', () => {
  it('returns empty array for empty input', () => {
    expect(rankEntries([])).toEqual([]);
  });

  it('single entry gets rank 1, position 1, percentile 100', () => {
    const result = rankEntries([entry({ userId: 'a', totalPoints: 50 })]);
    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe(1);
    expect(result[0].position).toBe(1);
    expect(result[0].percentile).toBe(100);
  });

  it('sorts by totalPoints DESC and assigns sequential ranks', () => {
    const result = rankEntries([
      entry({ userId: 'c', totalPoints: 30 }),
      entry({ userId: 'a', totalPoints: 80 }),
      entry({ userId: 'b', totalPoints: 50 }),
    ]);
    expect(result.map(e => e.userId)).toEqual(['a', 'b', 'c']);
    expect(result.map(e => e.rank)).toEqual([1, 2, 3]);
    expect(result.map(e => e.position)).toEqual([1, 2, 3]);
  });

  it('tied users share rank, next skips', () => {
    const result = rankEntries([
      entry({ userId: 'a', totalPoints: 80 }),
      entry({ userId: 'b', totalPoints: 80 }),
      entry({ userId: 'c', totalPoints: 50 }),
    ]);
    expect(result.map(e => e.rank)).toEqual([1, 1, 3]);
    expect(result.map(e => e.position)).toEqual([1, 2, 3]);
  });

  it('three-way tie', () => {
    const result = rankEntries([
      entry({ userId: 'a', totalPoints: 80 }),
      entry({ userId: 'b', totalPoints: 80 }),
      entry({ userId: 'c', totalPoints: 80 }),
      entry({ userId: 'd', totalPoints: 50 }),
    ]);
    expect(result.map(e => e.rank)).toEqual([1, 1, 1, 4]);
    expect(result.map(e => e.position)).toEqual([1, 2, 3, 4]);
  });

  it('tiebreaker scenario: same points, different correctWinners', () => {
    const result = rankEntries([
      entry({ userId: 'a', totalPoints: 50, correctWinners: 3 }),
      entry({ userId: 'b', totalPoints: 50, correctWinners: 5 }),
    ]);
    expect(result[0].userId).toBe('b'); // more correct winners
    expect(result[0].rank).toBe(1);
    expect(result[1].userId).toBe('a');
    expect(result[1].rank).toBe(2);
  });

  it('tiebreaker scenario: same correctWinners, different sumErr', () => {
    const result = rankEntries([
      entry({ userId: 'a', totalPoints: 50, correctWinners: 5, sumErrOnCorrectWinners: 15 }),
      entry({ userId: 'b', totalPoints: 50, correctWinners: 5, sumErrOnCorrectWinners: 8 }),
    ]);
    expect(result[0].userId).toBe('b'); // lower err
    expect(result[1].userId).toBe('a');
  });

  it('tiebreaker scenario: same sumErr, different exactScores', () => {
    const result = rankEntries([
      entry({ userId: 'a', totalPoints: 50, correctWinners: 5, sumErrOnCorrectWinners: 8, exactScores: 1 }),
      entry({ userId: 'b', totalPoints: 50, correctWinners: 5, sumErrOnCorrectWinners: 8, exactScores: 3 }),
    ]);
    expect(result[0].userId).toBe('b'); // more exact scores
    expect(result[1].userId).toBe('a');
  });

  it('tiebreaker scenario: full tie falls back to lastLockedPredictionAt', () => {
    const result = rankEntries([
      entry({ userId: 'a', totalPoints: 50, correctWinners: 5, sumErrOnCorrectWinners: 8, exactScores: 2, lastLockedPredictionAt: 2000 }),
      entry({ userId: 'b', totalPoints: 50, correctWinners: 5, sumErrOnCorrectWinners: 8, exactScores: 2, lastLockedPredictionAt: 1000 }),
    ]);
    expect(result[0].userId).toBe('b'); // earlier lock
    expect(result[0].rank).toBe(1);
    expect(result[1].userId).toBe('a');
    expect(result[1].rank).toBe(2);
  });

  it('absolute tie on all tiebreakers => shared rank', () => {
    const result = rankEntries([
      entry({ userId: 'a', totalPoints: 50, correctWinners: 5, sumErrOnCorrectWinners: 8, exactScores: 2, lastLockedPredictionAt: 1000 }),
      entry({ userId: 'b', totalPoints: 50, correctWinners: 5, sumErrOnCorrectWinners: 8, exactScores: 2, lastLockedPredictionAt: 1000 }),
      entry({ userId: 'c', totalPoints: 30 }),
    ]);
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(1);
    expect(result[2].rank).toBe(3);
  });

  it('does not mutate input array', () => {
    const input = [
      entry({ userId: 'c', totalPoints: 30 }),
      entry({ userId: 'a', totalPoints: 80 }),
    ];
    const copy = [...input];
    rankEntries(input);
    expect(input).toEqual(copy);
  });

  it('computes percentiles correctly', () => {
    const result = rankEntries([
      entry({ userId: 'a', totalPoints: 100 }),
      entry({ userId: 'b', totalPoints: 80 }),
      entry({ userId: 'c', totalPoints: 60 }),
      entry({ userId: 'd', totalPoints: 40 }),
      entry({ userId: 'e', totalPoints: 20 }),
    ]);
    // rank 1/5 => (5-1)/(5-1) * 100 = 100
    expect(result[0].percentile).toBe(100);
    // rank 2/5 => (5-2)/(5-1) * 100 = 75
    expect(result[1].percentile).toBe(75);
    // rank 3/5 => (5-3)/(5-1) * 100 = 50
    expect(result[2].percentile).toBe(50);
    // rank 5/5 => (5-5)/(5-1) * 100 = 0
    expect(result[4].percentile).toBe(0);
  });
});

// ==================== computeSummaryStats ====================

describe('computeSummaryStats', () => {
  it('returns zeros for empty input', () => {
    const stats = computeSummaryStats([]);
    expect(stats.totalUsers).toBe(0);
    expect(stats.avgPoints).toBe(0);
  });

  it('computes correct stats for a ranked set', () => {
    const ranked = rankEntries([
      entry({ userId: 'a', totalPoints: 100 }),
      entry({ userId: 'b', totalPoints: 80 }),
      entry({ userId: 'c', totalPoints: 60 }),
      entry({ userId: 'd', totalPoints: 40 }),
      entry({ userId: 'e', totalPoints: 20 }),
    ]);
    const stats = computeSummaryStats(ranked);
    expect(stats.totalUsers).toBe(5);
    expect(stats.avgPoints).toBe(60);
    expect(stats.winnerPoints).toBe(100);
    expect(stats.medianPoints).toBe(60);
    expect(stats.percentileBuckets.p50).toBe(60);
  });
});
