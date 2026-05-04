import { expect, test } from '@playwright/test';
import { createTestUser } from './helpers/auth';
import {
  deleteUserTournamentStatsDoc,
  getUserProfileDoc,
  getUserTournamentStats,
  setUserTournamentStatsDoc,
} from './helpers/firestore';
import { TEST_SEASON_ID, TEST_USER_2 } from './helpers/constants';
import { waitForUserHeader } from './helpers/waits';

test.describe('Pundit admin page', () => {
  let targetUserId: string | null = null;

  test.afterEach(async () => {
    if (targetUserId) {
      await deleteUserTournamentStatsDoc(TEST_SEASON_ID, targetUserId);
    }
  });

  test('configured admins can flag and unflag pundits and sync stats', async ({ page }) => {
    const targetUser = await createTestUser(
      TEST_USER_2.email,
      TEST_USER_2.password,
      TEST_USER_2.displayName,
    );
    targetUserId = targetUser.uid;

    await setUserTournamentStatsDoc(TEST_SEASON_ID, targetUser.uid, {
      id: `${TEST_SEASON_ID}_${targetUser.uid}`,
      userId: targetUser.uid,
      tournamentId: TEST_SEASON_ID,
      totalPoints: 25,
      correctWinners: 2,
      sumErrOnCorrectWinners: 6,
      exactScores: 1,
      scoredMatchCount: 2,
      displayName: TEST_USER_2.displayName,
      isPundit: false,
      updatedAt: new Date(),
    });

    await page.goto('/admin/pundits');
    await waitForUserHeader(page);
    await expect(page.getByRole('heading', { name: /pundit admin/i })).toBeVisible();

    await page.getByLabel(/target user email/i).fill(TEST_USER_2.email);
    await page.getByRole('button', { name: /save pundit status/i }).click();

    await expect(page.getByText(/pundit status is now enabled/i)).toBeVisible();
    await expect.poll(async () => (await getUserProfileDoc(targetUser.uid))?.isPundit).toBe(true);
    await expect.poll(async () => (await getUserTournamentStats(TEST_SEASON_ID, targetUser.uid))?.isPundit).toBe(true);

    await page.getByLabel(/flag this user as a pundit/i).uncheck();
    await page.getByRole('button', { name: /save pundit status/i }).click();

    await expect(page.getByText(/pundit status is now disabled/i)).toBeVisible();
    await expect.poll(async () => (await getUserProfileDoc(targetUser.uid))?.isPundit).toBe(false);
    await expect.poll(async () => (await getUserTournamentStats(TEST_SEASON_ID, targetUser.uid))?.isPundit).toBe(false);
  });
});
