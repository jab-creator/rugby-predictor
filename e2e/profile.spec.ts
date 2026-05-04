import { expect, test } from '@playwright/test';
import {
  deleteUserTournamentStatsDoc,
  getUserProfileDoc,
  getUserTournamentStats,
  setUserTournamentStatsDoc,
} from './helpers/firestore';
import { TEST_SEASON_ID, TEST_USER } from './helpers/constants';

async function getCurrentUid(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((entry) => entry.startsWith('firebase:authUser'));
    if (!key) {
      throw new Error('No Firebase auth user found in localStorage');
    }

    const parsed = JSON.parse(localStorage.getItem(key)!);
    return parsed.uid as string;
  });
}

test.describe('Profile page', () => {
  let statsUserId: string | null = null;

  test.afterEach(async () => {
    if (statsUserId) {
      await deleteUserTournamentStatsDoc(TEST_SEASON_ID, statsUserId);
      statsUserId = null;
    }
  });

  test('saves country and syncs tournament-specific resolved hemisphere to stats', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();

    const uid = await getCurrentUid(page);
    statsUserId = uid;
    await setUserTournamentStatsDoc(TEST_SEASON_ID, uid, {
      id: `${TEST_SEASON_ID}_${uid}`,
      userId: uid,
      tournamentId: TEST_SEASON_ID,
      totalPoints: 12,
      correctWinners: 1,
      sumErrOnCorrectWinners: 4,
      exactScores: 0,
      scoredMatchCount: 1,
      displayName: TEST_USER.displayName,
      countryCode: 'GB',
      resolvedHemisphere: 'north',
      hemisphere: 'north',
      isPundit: false,
      updatedAt: new Date(),
    });

    await page.getByLabel(/country code/i).fill('jp');
    await page.getByRole('button', { name: /save profile/i }).click();

    await expect(page.getByText(/profile saved/i)).toBeVisible();
    await expect(page.getByText(/pundit status is managed separately/i)).toBeVisible();

    await expect
      .poll(async () => (await getUserProfileDoc(uid))?.countryCode)
      .toBe('JP');
    await expect
      .poll(async () => (await getUserTournamentStats(TEST_SEASON_ID, uid))?.countryCode)
      .toBe('JP');
    await expect
      .poll(async () => (await getUserTournamentStats(TEST_SEASON_ID, uid))?.resolvedHemisphere)
      .toBe('south');
    await expect
      .poll(async () => (await getUserTournamentStats(TEST_SEASON_ID, uid))?.hemisphere)
      .toBeUndefined();

  });

  test('shows client validation for invalid country codes', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();

    await page.getByLabel(/country code/i).fill('1');
    await page.getByRole('button', { name: /save profile/i }).click();

    await expect(page.getByText(/two-letter country code/i).first()).toBeVisible();
  });
});
