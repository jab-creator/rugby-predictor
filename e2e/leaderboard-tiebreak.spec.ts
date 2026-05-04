import { expect, test, type Page } from '@playwright/test';
import {
  addPoolMember,
  createTestPool,
  deletePool,
  setSeasonLeaderboardConfig,
  setUserTournamentStatsDoc,
} from './helpers/firestore';
import { TEST_SEASON_ID, TEST_USER } from './helpers/constants';
import { waitForUserHeader } from './helpers/waits';

/**
 * Milestone 9 — pool leaderboard tiebreak hardening.
 *
 * Seeds a small deterministic set of pool members + user_tournament_stats docs
 * arranged so that each adjacent pair is decided by exactly one comparator
 * level. If any tier of the comparator chain is dropped, swapped, or its
 * direction inverted, the asserted top-to-bottom order changes.
 *
 * Comparator order under test (src/lib/leaderboard.ts compareLeaderboardEntries):
 *   1. totalPoints              DESC
 *   2. correctWinners           DESC
 *   3. sumErrOnCorrectWinners   ASC
 *   4. exactScores              DESC
 *   5. lastLockedPredictionAt   ASC
 */

async function getCurrentUid(page: Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser'));
    if (!key) throw new Error('No Firebase auth user found in localStorage');
    return JSON.parse(localStorage.getItem(key)!).uid as string;
  });
}

const RUN_ID = `lb-tiebreak-${Date.now()}`;

interface TiebreakPlayer {
  id: string;
  displayName: string;
  totalPoints: number;
  correctWinners: number;
  sumErrOnCorrectWinners: number;
  exactScores: number;
  lastLockedPredictionAt: string;
}

// Each adjacent pair below is decided by a single comparator level.
//   A → B  level 1 (totalPoints DESC)
//   B → C  level 2 (correctWinners DESC)
//   C → D  level 3 (sumErrOnCorrectWinners ASC)
//   D → E  level 4 (exactScores DESC)
//   E → F  level 5 (lastLockedPredictionAt ASC)
const PLAYERS: TiebreakPlayer[] = [
  { id: `${RUN_ID}-A`, displayName: 'Alpha Tiebreak',  totalPoints: 100, correctWinners: 10, sumErrOnCorrectWinners: 10, exactScores: 4, lastLockedPredictionAt: '2099-07-01T10:00:00Z' },
  { id: `${RUN_ID}-B`, displayName: 'Bravo Tiebreak',  totalPoints:  90, correctWinners: 10, sumErrOnCorrectWinners: 10, exactScores: 4, lastLockedPredictionAt: '2099-07-01T10:00:00Z' },
  { id: `${RUN_ID}-C`, displayName: 'Charlie Tiebreak', totalPoints: 90, correctWinners:  5, sumErrOnCorrectWinners: 10, exactScores: 4, lastLockedPredictionAt: '2099-07-01T10:00:00Z' },
  { id: `${RUN_ID}-D`, displayName: 'Delta Tiebreak',  totalPoints:  90, correctWinners:  5, sumErrOnCorrectWinners: 30, exactScores: 4, lastLockedPredictionAt: '2099-07-01T10:00:00Z' },
  { id: `${RUN_ID}-E`, displayName: 'Echo Tiebreak',   totalPoints:  90, correctWinners:  5, sumErrOnCorrectWinners: 30, exactScores: 1, lastLockedPredictionAt: '2099-08-01T10:00:00Z' },
  { id: `${RUN_ID}-F`, displayName: 'Foxtrot Tiebreak', totalPoints: 90, correctWinners:  5, sumErrOnCorrectWinners: 30, exactScores: 1, lastLockedPredictionAt: '2099-08-02T10:00:00Z' },
];

test.describe.serial('Milestone 9 — pool leaderboard tiebreak ordering', () => {
  let poolId: string;
  let viewerUid: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForUserHeader(page);
    viewerUid = await getCurrentUid(page);

    const pool = await createTestPool(viewerUid, TEST_USER.displayName, 'Tiebreak Pool', TEST_SEASON_ID);
    poolId = pool.poolId;

    await setSeasonLeaderboardConfig(TEST_SEASON_ID, {
      enableOverall: true,
      enableCountry: true,
      enableHemisphere: true,
      enablePundit: true,
    });

    for (const player of PLAYERS) {
      await addPoolMember(poolId, player.id, player.displayName);
      await setUserTournamentStatsDoc(TEST_SEASON_ID, player.id, {
        userId: player.id,
        tournamentId: TEST_SEASON_ID,
        displayName: player.displayName,
        totalPoints: player.totalPoints,
        correctWinners: player.correctWinners,
        sumErrOnCorrectWinners: player.sumErrOnCorrectWinners,
        exactScores: player.exactScores,
        lastLockedPredictionAt: new Date(player.lastLockedPredictionAt),
        isPundit: false,
        updatedAt: new Date(),
      });
    }
  });

  test.afterEach(async () => {
    await deletePool(poolId);
  });

  test('row order honors totalPoints → correctWinners → sumErrOnCorrectWinners → exactScores → lastLockedPredictionAt', async ({ page }) => {
    await page.goto(`/pools/${poolId}/leaderboard`);
    await expect(page.getByRole('tab', { name: 'Pool' })).toHaveAttribute('aria-selected', 'true');

    const expectedIds = PLAYERS.map((p) => p.id);

    // Wait for all rows to render: 6 seeded players + the pool creator (zero-stats fallback).
    const rows = page.locator('[data-testid^="leaderboard-row-"]');
    await expect(rows).toHaveCount(PLAYERS.length + 1);

    // Each seeded player must render with their expected display name and totalPoints.
    for (const player of PLAYERS) {
      const row = page.getByTestId(`leaderboard-row-${player.id}`);
      await expect(row).toContainText(player.displayName);
      await expect(row).toContainText(String(player.totalPoints));
    }

    const renderedIds = await rows.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).getAttribute('data-testid')!.replace('leaderboard-row-', '')),
    );

    // Strict order assertion: A → B → C → D → E → F before the zero-stats creator.
    expect(renderedIds.slice(0, expectedIds.length)).toEqual(expectedIds);
    expect(renderedIds[expectedIds.length]).toBe(viewerUid);

    // Rank #1 should be the unique top scorer (Alpha) — proves totalPoints is decisive at level 1.
    const topRow = page.getByTestId(`leaderboard-row-${PLAYERS[0].id}`);
    await expect(topRow.locator('td').first()).toHaveText('1');
  });
});
