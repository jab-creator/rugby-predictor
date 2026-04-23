import { marginBonus, scorePrediction, statsIncrement } from './scoring';

describe('marginBonus', () => {
  it.each([
    [0, 10], [1, 10], [2, 10],
    [3, 7], [4, 7], [5, 7],
    [6, 5], [7, 5], [9, 5],
    [10, 2], [14, 2],
    [15, 0], [20, 0], [99, 0],
  ])('err=%d => bonus=%d', (err, expected) => {
    expect(marginBonus(err)).toBe(expected);
  });
});

describe('scorePrediction', () => {
  const match = { homeTeamId: 'ENG', awayTeamId: 'FRA' };

  it('returns null for incomplete prediction', () => {
    expect(scorePrediction({ pickedWinnerTeamId: null, pickedMargin: null }, { homeScore: 20, awayScore: 10 }, match)).toBeNull();
    expect(scorePrediction({ pickedWinnerTeamId: 'ENG', pickedMargin: null }, { homeScore: 20, awayScore: 10 }, match)).toBeNull();
  });

  it('correct winner, exact margin (err=0) => 20 points', () => {
    const result = scorePrediction(
      { pickedWinnerTeamId: 'ENG', pickedMargin: 10 },
      { homeScore: 20, awayScore: 10 },
      match,
    )!;
    expect(result.winnerCorrect).toBe(true);
    expect(result.err).toBe(0);
    expect(result.marginBonus).toBe(10);
    expect(result.totalPoints).toBe(20);
  });

  it('correct winner, err=5 => 17 points', () => {
    const result = scorePrediction(
      { pickedWinnerTeamId: 'ENG', pickedMargin: 5 },
      { homeScore: 20, awayScore: 10 },
      match,
    )!;
    expect(result.winnerCorrect).toBe(true);
    expect(result.err).toBe(5);
    expect(result.totalPoints).toBe(17);
  });

  it('wrong winner => 0 points', () => {
    const result = scorePrediction(
      { pickedWinnerTeamId: 'FRA', pickedMargin: 10 },
      { homeScore: 20, awayScore: 10 },
      match,
    )!;
    expect(result.winnerCorrect).toBe(false);
    expect(result.totalPoints).toBe(0);
  });

  it('draw: no winner points, margin bonus only', () => {
    const result = scorePrediction(
      { pickedWinnerTeamId: 'ENG', pickedMargin: 2 },
      { homeScore: 15, awayScore: 15 },
      match,
    )!;
    expect(result.winnerCorrect).toBe(false);
    expect(result.err).toBe(2); // abs(2 - 0)
    expect(result.marginBonus).toBe(10);
    expect(result.totalPoints).toBe(10); // marginBonus only
  });

  it('draw with large picked margin => 0', () => {
    const result = scorePrediction(
      { pickedWinnerTeamId: 'FRA', pickedMargin: 20 },
      { homeScore: 10, awayScore: 10 },
      match,
    )!;
    expect(result.totalPoints).toBe(0);
  });

  it('away team wins', () => {
    const result = scorePrediction(
      { pickedWinnerTeamId: 'FRA', pickedMargin: 3 },
      { homeScore: 10, awayScore: 17 },
      match,
    )!;
    expect(result.winnerCorrect).toBe(true);
    expect(result.err).toBe(4); // abs(3 - 7)
    expect(result.totalPoints).toBe(17); // 10 + 7
  });
});

describe('statsIncrement', () => {
  it('correct winner: increments correctWinner, errOnCorrectWinner', () => {
    const inc = statsIncrement({ winnerCorrect: true, err: 5, marginBonus: 7, totalPoints: 17 });
    expect(inc.points).toBe(17);
    expect(inc.correctWinner).toBe(true);
    expect(inc.errOnCorrectWinner).toBe(5);
    expect(inc.exactScore).toBe(false);
  });

  it('correct winner with exact score: exactScore=true, errOnCorrectWinner=0', () => {
    const inc = statsIncrement({ winnerCorrect: true, err: 0, marginBonus: 10, totalPoints: 20 });
    expect(inc.exactScore).toBe(true);
    expect(inc.errOnCorrectWinner).toBe(0);
  });

  it('wrong winner: no correctWinner, no errOnCorrectWinner', () => {
    const inc = statsIncrement({ winnerCorrect: false, err: 8, marginBonus: 5, totalPoints: 0 });
    expect(inc.correctWinner).toBe(false);
    expect(inc.errOnCorrectWinner).toBe(0);
    expect(inc.exactScore).toBe(false);
  });
});
