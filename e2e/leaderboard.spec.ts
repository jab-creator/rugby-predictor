import { expect, test } from '@playwright/test';
import { createTestPool, deletePool, setSeasonLeaderboardConfig, setUserTournamentStatsDoc } from './helpers/firestore';
import { TEST_SEASON_ID, TEST_USER } from './helpers/constants';
import { waitForUserHeader } from './helpers/waits';

async function getCurrentUid(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser'));
    if (!key) throw new Error('No Firebase auth user found in localStorage');
    return JSON.parse(localStorage.getItem(key)!).uid as string;
  });
}

test.describe.serial('Milestone 8 — leaderboard UI and filters', () => {
  let poolId: string;
  let uid: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForUserHeader(page);
    uid = await getCurrentUid(page);

    const pool = await createTestPool(uid, TEST_USER.displayName, 'Leaderboard Pool', TEST_SEASON_ID);
    poolId = pool.poolId;

    await setSeasonLeaderboardConfig(TEST_SEASON_ID, {
      enableOverall: true,
      enableCountry: true,
      enableHemisphere: true,
      enablePundit: true,
    });

    await setUserTournamentStatsDoc(TEST_SEASON_ID, uid, {
      userId: uid,
      tournamentId: TEST_SEASON_ID,
      displayName: TEST_USER.displayName,
      totalPoints: 42,
      correctWinners: 8,
      sumErrOnCorrectWinners: 11,
      exactScores: 2,
      lastLockedPredictionAt: new Date('2099-07-01T10:00:00Z'),
      countryCode: 'JP',
      resolvedHemisphere: 'south',
      hemisphere: 'north',
      isPundit: false,
      updatedAt: new Date('2099-07-01T10:05:00Z'),
    });
  });

  test.afterEach(async () => {
    await setSeasonLeaderboardConfig(TEST_SEASON_ID, {
      enableOverall: true,
      enableCountry: true,
      enableHemisphere: true,
      enablePundit: true,
    });
    await deletePool(poolId);
  });

  test('overall leaderboard renders', async ({ page }) => {
    await page.goto(`/pools/${poolId}/leaderboard`);

    await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Overall' })).toBeVisible();
    await expect(page.getByRole('cell', { name: TEST_USER.displayName })).toBeVisible();
  });

  test('country filter queries countryCode and supports empty state', async ({ page }) => {
    await page.goto(`/pools/${poolId}/leaderboard`);
    await expect(page.getByRole('cell', { name: TEST_USER.displayName })).toBeVisible();
    await page.getByRole('tab', { name: 'Country' }).click();

    await page.getByLabel('Country code').fill('JP');
    await expect(page.getByRole('cell', { name: TEST_USER.displayName })).toBeVisible();

    await page.getByLabel('Country code').fill('NZ');
    await expect(page.getByText('No leaderboard rows for country NZ.')).toBeVisible();
  });

  test('hemisphere filter uses resolvedHemisphere (not legacy hemisphere)', async ({ page }) => {
    await page.goto(`/pools/${poolId}/leaderboard`);
    await expect(page.getByRole('cell', { name: TEST_USER.displayName })).toBeVisible();
    await page.getByRole('tab', { name: 'Hemisphere' }).click();

    await page.getByLabel('Hemisphere').selectOption('south');
    await expect(page.getByRole('cell', { name: TEST_USER.displayName })).toBeVisible();

    await page.getByLabel('Hemisphere').selectOption('north');
    await expect(page.getByText('No leaderboard rows for the north hemisphere.')).toBeVisible();
  });

  test('pundit filter queries isPundit and disabled config tabs are hidden', async ({ page }) => {
    await page.goto(`/pools/${poolId}/leaderboard`);
    await expect(page.getByRole('cell', { name: TEST_USER.displayName })).toBeVisible();
    await page.getByRole('tab', { name: 'Pundits' }).click();
    await expect(page.getByText('No pundits found for this tournament yet.')).toBeVisible();

    await setSeasonLeaderboardConfig(TEST_SEASON_ID, {
      enableOverall: true,
      enableCountry: false,
      enableHemisphere: false,
      enablePundit: false,
    });

    await page.reload();

    await expect(page.getByRole('tab', { name: 'Overall' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Country' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Hemisphere' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Pundits' })).toHaveCount(0);
  });
});
