import { expect, test, type Page } from '@playwright/test';
import {
  createTestPool,
  deletePool,
  removePoolMember,
  setSeasonLeaderboardConfig,
} from './helpers/firestore';
import { TEST_SEASON_ID, TEST_USER } from './helpers/constants';
import { waitForUserHeader } from './helpers/waits';

/**
 * Milestone 9 — empty Pool leaderboard state.
 *
 * `getManualPoolLeaderboardEntries` produces a row for every pool member,
 * defaulting their stats to zero when no `user_tournament_stats` doc exists.
 * The empty branch in src/app/pools/[poolId]/leaderboard/page.tsx is therefore
 * only reachable when the pool literally has zero members. This test exercises
 * exactly that path so it stops being silent dead code.
 */

async function getCurrentUid(page: Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser'));
    if (!key) throw new Error('No Firebase auth user found in localStorage');
    return JSON.parse(localStorage.getItem(key)!).uid as string;
  });
}

test.describe.serial('Milestone 9 — pool leaderboard empty state', () => {
  let poolId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForUserHeader(page);
    const uid = await getCurrentUid(page);

    const pool = await createTestPool(uid, TEST_USER.displayName, 'Empty Pool Leaderboard', TEST_SEASON_ID);
    poolId = pool.poolId;

    await setSeasonLeaderboardConfig(TEST_SEASON_ID, {
      enableOverall: true,
      enableCountry: true,
      enableHemisphere: true,
      enablePundit: true,
    });

    // Strip the creator membership so the Pool tab has zero members.
    await removePoolMember(poolId, uid);
  });

  test.afterEach(async () => {
    await deletePool(poolId);
  });

  test('Pool tab shows the empty-state message when the pool has no members', async ({ page }) => {
    await page.goto(`/pools/${poolId}/leaderboard`);

    await expect(page.getByRole('tab', { name: 'Pool' })).toHaveAttribute('aria-selected', 'true');

    const emptyState = page.getByTestId('leaderboard-empty');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toHaveText('No pool members have leaderboard rows yet.');

    // No leaderboard rows should be rendered alongside the empty state.
    await expect(page.locator('[data-testid^="leaderboard-row-"]')).toHaveCount(0);
  });
});
