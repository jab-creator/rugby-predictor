import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  addPoolMember,
  createTestPool,
  deletePool,
  getPickStatus,
  getPrediction,
  resetTestSeasonState,
} from './helpers/firestore';
import { createTestUser, injectAuthState, type TestAuthUser } from './helpers/auth';
import { TEST_SEASON_ID, TEST_USER, TEST_USER_2 } from './helpers/constants';
import { waitForUserHeader } from './helpers/waits';

/**
 * Milestone 9 — focused 2-user lock-state visibility before kickoff.
 *
 * Proves the cloud function visibility rule (functions/src/index.ts:
 * canSeePrediction = id === viewerId || isFinal || isAfterKickoff || (viewerLocked && isLocked)):
 *
 *   - A viewer always sees their own prediction.
 *   - A locked-but-incomplete peer is visible only when the viewer is also locked.
 *   - A picked-but-unlocked peer is hidden regardless of the viewer's lock state.
 *   - Once both users have locked, peer predictions become visible to each other.
 *
 * Kept narrow: 2 users, 1 match, no scoring/finalization. The broader scoring +
 * leaderboard flow is exercised by manual-pool-leaderboard.spec.ts.
 */

const MATCH_ID = `${TEST_SEASON_ID}-r1-JPN-ITA`;

async function getCurrentUid(page: Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser'));
    if (!key) throw new Error('No Firebase auth user found in localStorage');
    return JSON.parse(localStorage.getItem(key)!).uid as string;
  });
}

async function openSecondaryUser(browser: Browser, user: TestAuthUser, poolId: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await injectAuthState(page, user);
  await page.reload();
  await waitForUserHeader(page, user.displayName);
  await page.goto(`/pools/${poolId}/round/1`);
  await expect(page.getByRole('heading', { name: 'Round 1' })).toBeVisible({ timeout: 10_000 });
  return page;
}

async function pickWinnerAndMargin(page: Page, userId: string, matchId: string, winnerLabel: string, margin: number) {
  const section = page.getByTestId(`match-section-${matchId}`);
  await section.locator('button').filter({ hasText: winnerLabel }).first().click();
  await section.locator(`#margin-${matchId}`).fill(String(margin));

  await expect.poll(async () => {
    const prediction = await getPrediction(userId, matchId);
    return prediction?.margin;
  }).toBe(margin);
}

async function lockPick(page: Page, poolId: string, userId: string, matchId: string) {
  const section = page.getByTestId(`match-section-${matchId}`);
  await section.getByRole('button', { name: /lock pick/i }).click();
  await expect(section.getByText(/pick locked/i)).toBeVisible({ timeout: 15_000 });

  await expect.poll(async () => {
    const prediction = await getPrediction(userId, matchId);
    const status = await getPickStatus(poolId, matchId, userId);
    return prediction?.isLocked === true || status?.lockedAt != null;
  }, { timeout: 15_000 }).toBe(true);
}

test.describe.serial('Milestone 9 — focused pick visibility transitions', () => {
  test.setTimeout(45_000);

  let poolId: string;
  let user1Uid: string;
  let user2: TestAuthUser;
  let page1: Page;
  let page2: Page;

  test.beforeEach(async ({ page, browser }) => {
    page1 = page;
    await page1.goto('/');
    await waitForUserHeader(page1);
    user1Uid = await getCurrentUid(page1);

    user2 = await createTestUser(TEST_USER_2.email, TEST_USER_2.password, TEST_USER_2.displayName);

    const pool = await createTestPool(user1Uid, TEST_USER.displayName, 'Visibility Test Pool', TEST_SEASON_ID);
    poolId = pool.poolId;
    await addPoolMember(poolId, user2.uid, TEST_USER_2.displayName);

    await page1.goto(`/pools/${poolId}/round/1`);
    await expect(page1.getByRole('heading', { name: 'Round 1' })).toBeVisible({ timeout: 10_000 });

    page2 = await openSecondaryUser(browser, user2, poolId);
  });

  test.afterEach(async () => {
    await page2?.context().close();
    await deletePool(poolId);
    await resetTestSeasonState(TEST_SEASON_ID);
  });

  test('peer prediction stays hidden until both viewers have locked', async () => {
    const matchOnPage1 = page1.getByTestId(`match-section-${MATCH_ID}`);
    const matchOnPage2 = page2.getByTestId(`match-section-${MATCH_ID}`);

    // Phase 1 — user1 picks but does NOT lock.
    await pickWinnerAndMargin(page1, user1Uid, MATCH_ID, 'Japan', 7);

    // user1 always sees their own pick details.
    await expect(matchOnPage1.getByTestId(`prediction-detail-${user1Uid}`)).toHaveText('Prediction: Japan by 7');

    // user2 sees user1's status as Picked but the prediction itself is hidden
    // (user1 is unlocked → not visible regardless of user2's lock state).
    await expect(matchOnPage2.getByTestId(`prediction-detail-${user1Uid}`)).toHaveText('Prediction hidden');
    await expect(matchOnPage2.getByTestId(`member-prediction-${user1Uid}`)).toContainText('Picked');

    // Phase 2 — user1 locks. user2 still has no pick.
    await lockPick(page1, poolId, user1Uid, MATCH_ID);

    // Status flips to Locked but prediction remains hidden — user2 hasn't locked yet.
    await expect(matchOnPage2.getByTestId(`member-prediction-${user1Uid}`)).toContainText('Locked');
    await expect(matchOnPage2.getByTestId(`prediction-detail-${user1Uid}`)).toHaveText('Prediction hidden');

    // Phase 3 — user2 picks (still unlocked).
    await pickWinnerAndMargin(page2, user2.uid, MATCH_ID, 'Italy', 5);

    // user1 (locked) viewing user2 (picked-but-unlocked): hidden
    // (visibility requires the *target* to be locked, not just the viewer).
    await expect(matchOnPage1.getByTestId(`member-prediction-${user2.uid}`)).toContainText('Picked');
    await expect(matchOnPage1.getByTestId(`prediction-detail-${user2.uid}`)).toHaveText('Prediction hidden');

    // user2 (unlocked) viewing user1 (locked): hidden
    // (visibility requires the *viewer* to be locked, not just the target).
    await expect(matchOnPage2.getByTestId(`prediction-detail-${user1Uid}`)).toHaveText('Prediction hidden');

    // Phase 4 — user2 locks. Both locked → mutual visibility.
    await lockPick(page2, poolId, user2.uid, MATCH_ID);

    await expect(matchOnPage1.getByTestId(`prediction-detail-${user2.uid}`)).toHaveText('Prediction: Italy by 5');
    await expect(matchOnPage2.getByTestId(`prediction-detail-${user1Uid}`)).toHaveText('Prediction: Japan by 7');
  });
});
