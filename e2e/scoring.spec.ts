import { test, expect, Browser } from '@playwright/test';
import {
  addPoolMember,
  createTestPool,
  deletePool,
  finalizeMatchDirectly,
  getPrediction,
  getScoringRun,
  getUserTournamentStats,
  resetTestSeasonState,
} from './helpers/firestore';
import { createTestUser, injectAuthState } from './helpers/auth';
import { TEST_SEASON_ID, TEST_USER, TEST_USER_2 } from './helpers/constants';
import { waitForUserHeader } from './helpers/waits';

const ROUND_1_MATCH_ID = `${TEST_SEASON_ID}-r1-JPN-ITA`;
const ROUND_1_MATCH_ID_2 = `${TEST_SEASON_ID}-r1-NZL-FRA`;

function getRoundPoints(stats: Record<string, unknown> | null, round: number): number | undefined {
  const pointsByRound = stats?.pointsByRound as Record<string, unknown> | undefined;
  const value = pointsByRound?.[String(round)];
  return typeof value === 'number' ? value : undefined;
}

async function getCurrentUid(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser'));
    if (!key) throw new Error('No Firebase auth user found in localStorage');
    return JSON.parse(localStorage.getItem(key)!).uid as string;
  });
}

async function openAsUser2(browser: Browser): Promise<import('@playwright/test').Page> {
  const user2 = await createTestUser(TEST_USER_2.email, TEST_USER_2.password, TEST_USER_2.displayName);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');
  await injectAuthState(page, user2);
  await page.reload();
  await waitForUserHeader(page, TEST_USER_2.displayName);
  return page;
}

test.describe.serial('Milestone 6 — universal scoring', () => {
  let poolId: string;
  let user1Uid: string;
  let user2Uid: string | null = null;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForUserHeader(page);
    user1Uid = await getCurrentUid(page);
    const pool = await createTestPool(user1Uid, TEST_USER.displayName, 'Scoring Pool', TEST_SEASON_ID);
    poolId = pool.poolId;
    user2Uid = null;
  });

  test.afterEach(async () => {
    await deletePool(poolId);
    await resetTestSeasonState(TEST_SEASON_ID);
  });

  test('creator can finalize a match and score all universal predictions', async ({ page, browser }) => {
    const page2 = await openAsUser2(browser);
    user2Uid = await getCurrentUid(page2);
    await addPoolMember(poolId, user2Uid, TEST_USER_2.displayName);

    try {
      await page.goto(`/pools/${poolId}/round/1`);
      await expect(page.getByRole('heading', { name: 'Round 1' })).toBeVisible({ timeout: 10_000 });
      await page.locator('button').filter({ hasText: 'Japan' }).first().click();
      await page.locator(`#margin-${ROUND_1_MATCH_ID}`).fill('7');

      await expect.poll(async () => {
        const prediction = await getPrediction(user1Uid, ROUND_1_MATCH_ID);
        return prediction?.margin;
      }).toBe(7);

      await page2.goto(`/pools/${poolId}/round/1`);
      await expect(page2.getByRole('heading', { name: 'Round 1' })).toBeVisible({ timeout: 10_000 });
      await page2.locator('button').filter({ hasText: 'Japan' }).first().click();
      await page2.locator(`#margin-${ROUND_1_MATCH_ID}`).fill('12');

      await expect.poll(async () => {
        const prediction = await getPrediction(user2Uid!, ROUND_1_MATCH_ID);
        return prediction?.margin;
      }).toBe(12);

      await page.getByLabel(/japan score/i).fill('27');
      await page.getByLabel(/italy score/i).fill('20');
      await page.getByRole('button', { name: /mark final/i }).first().click();

      await expect(page.getByText(/match finalized and scored/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/final score: Japan 27–20 Italy/i)).toBeVisible({ timeout: 10_000 });

      await expect.poll(async () => {
        const prediction = await getPrediction(user1Uid, ROUND_1_MATCH_ID);
        return prediction?.totalPoints;
      }).toBe(20);

      await expect.poll(async () => {
        const prediction = await getPrediction(user2Uid!, ROUND_1_MATCH_ID);
        return prediction?.totalPoints;
      }).toBe(17);

      await expect.poll(async () => {
        const stats = await getUserTournamentStats(TEST_SEASON_ID, user1Uid);
        return `${stats?.totalPoints}:${stats?.correctWinners}:${stats?.sumErrOnCorrectWinners}:${stats?.exactScores}:${stats?.scoredMatchCount}:${stats?.lastScoredMatchId}:${getRoundPoints(stats, 1)}`;
      }).toBe(`20:1:0:1:1:${ROUND_1_MATCH_ID}:20`);

      await expect.poll(async () => {
        const stats = await getUserTournamentStats(TEST_SEASON_ID, user2Uid!);
        return `${stats?.totalPoints}:${stats?.correctWinners}:${stats?.sumErrOnCorrectWinners}:${stats?.exactScores}:${stats?.scoredMatchCount}:${stats?.lastScoredMatchId}:${getRoundPoints(stats, 1)}`;
      }).toBe(`17:1:5:0:1:${ROUND_1_MATCH_ID}:17`);

      await expect.poll(async () => {
        const scoringRun = await getScoringRun(TEST_SEASON_ID, ROUND_1_MATCH_ID);
        return scoringRun?.predictionCount;
      }).toBe(2);
    } finally {
      await page2.context().close();
    }
  });

  test('scoring trigger is idempotent for repeated final match writes', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await expect(page.getByRole('heading', { name: 'Round 1' })).toBeVisible({ timeout: 10_000 });
    await page.locator('button').filter({ hasText: 'New Zealand' }).first().click();
    await page.locator(`#margin-${ROUND_1_MATCH_ID_2}`).fill('4');

    await expect.poll(async () => {
      const prediction = await getPrediction(user1Uid, ROUND_1_MATCH_ID_2);
      return prediction?.margin;
    }).toBe(4);

    await finalizeMatchDirectly(TEST_SEASON_ID, ROUND_1_MATCH_ID_2, 24, 20);

    await expect.poll(async () => {
      const stats = await getUserTournamentStats(TEST_SEASON_ID, user1Uid);
      return stats?.totalPoints;
    }, { timeout: 15_000 }).toBe(20);

    await finalizeMatchDirectly(TEST_SEASON_ID, ROUND_1_MATCH_ID_2, 24, 20);

    await expect.poll(async () => {
      const stats = await getUserTournamentStats(TEST_SEASON_ID, user1Uid);
      return `${stats?.totalPoints}:${stats?.scoredMatchCount}:${stats?.lastScoredMatchId}:${getRoundPoints(stats, 1)}`;
    }, { timeout: 15_000 }).toBe(`20:1:${ROUND_1_MATCH_ID_2}:20`);

    await expect.poll(async () => {
      const scoringRun = await getScoringRun(TEST_SEASON_ID, ROUND_1_MATCH_ID_2);
      return scoringRun?.actualMargin;
    }, { timeout: 15_000 }).toBe(4);
  });
});
