import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  addPoolMember,
  createTestPool,
  deletePool,
  finalizeMatchDirectly,
  getPrediction,
  getScoringRun,
  getUserTournamentStats,
} from './helpers/firestore';
import { createTestUser, injectAuthState, type TestAuthUser } from './helpers/auth';
import { TEST_SEASON_ID, TEST_USER, TEST_USER_2, TEST_USER_3 } from './helpers/constants';

const MATCHES = {
  jpnIta: `${TEST_SEASON_ID}-r1-JPN-ITA`,
  nzlFra: `${TEST_SEASON_ID}-r1-NZL-FRA`,
  ausIre: `${TEST_SEASON_ID}-r1-AUS-IRE`,
  fijWal: `${TEST_SEASON_ID}-r1-FIJ-WAL`,
};

async function getCurrentUid(page: Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser'));
    if (!key) throw new Error('No Firebase auth user found in localStorage');
    return JSON.parse(localStorage.getItem(key)!).uid as string;
  });
}

async function openAsUser(browser: Browser, user: TestAuthUser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await injectAuthState(page, user);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(user.displayName, { exact: false })).toBeVisible({ timeout: 10_000 });
  return page;
}

async function submitPick(page: Page, userId: string, matchId: string, winnerLabel: string, margin: number) {
  const section = page.getByTestId(`match-section-${matchId}`);
  await section.locator('button').filter({ hasText: winnerLabel }).first().click();
  await section.locator(`#margin-${matchId}`).fill(String(margin));

  await expect.poll(async () => {
    const prediction = await getPrediction(userId, matchId);
    return prediction?.margin;
  }).toBe(margin);
}

async function lockPick(page: Page, userId: string, matchId: string) {
  const section = page.getByTestId(`match-section-${matchId}`);
  await section.getByRole('button', { name: /lock pick/i }).click();

  await expect.poll(async () => {
    const prediction = await getPrediction(userId, matchId);
    return prediction?.isLocked;
  }).toBe(true);
}

async function finalizeAndWait(matchId: string, homeScore: number, awayScore: number) {
  await finalizeMatchDirectly(TEST_SEASON_ID, matchId, homeScore, awayScore);

  await expect.poll(async () => {
    const scoringRun = await getScoringRun(TEST_SEASON_ID, matchId);
    return scoringRun?.predictionCount;
  }).toBe(3);
}

test.describe.serial('Milestone 9 — manual pool leaderboards and prediction visibility', () => {
  let poolId: string;
  let user1Uid: string;
  let user2: TestAuthUser;
  let user3: TestAuthUser;
  let page2: Page;
  let page3: Page;

  test.beforeEach(async ({ page, browser }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    user1Uid = await getCurrentUid(page);

    user2 = await createTestUser(TEST_USER_2.email, TEST_USER_2.password, TEST_USER_2.displayName);
    user3 = await createTestUser(TEST_USER_3.email, TEST_USER_3.password, TEST_USER_3.displayName);

    const pool = await createTestPool(user1Uid, TEST_USER.displayName, 'Manual Pool Milestone 9', TEST_SEASON_ID);
    poolId = pool.poolId;
    await addPoolMember(poolId, user2.uid, TEST_USER_2.displayName);
    await addPoolMember(poolId, user3.uid, TEST_USER_3.displayName);

    page2 = await openAsUser(browser, user2);
    page3 = await openAsUser(browser, user3);

    await Promise.all([
      page.goto(`/pools/${poolId}/round/1`),
      page2.goto(`/pools/${poolId}/round/1`),
      page3.goto(`/pools/${poolId}/round/1`),
    ]);

    await expect(page.getByRole('heading', { name: 'Round 1' })).toBeVisible({ timeout: 10_000 });
    await expect(page2.getByRole('heading', { name: 'Round 1' })).toBeVisible({ timeout: 10_000 });
    await expect(page3.getByRole('heading', { name: 'Round 1' })).toBeVisible({ timeout: 10_000 });
  });

  test.afterEach(async () => {
    await page2?.context().close();
    await page3?.context().close();
    await deletePool(poolId);
  });

  test('redacts member predictions by lock state and ranks pool members after final scoring', async ({ page }) => {
    await submitPick(page, user1Uid, MATCHES.jpnIta, 'Japan', 7);
    await submitPick(page2, user2.uid, MATCHES.jpnIta, 'Japan', 12);
    await submitPick(page3, user3.uid, MATCHES.jpnIta, 'Italy', 6);

    await lockPick(page2, user2.uid, MATCHES.jpnIta);

    const user1Match = page.getByTestId(`match-section-${MATCHES.jpnIta}`);
    await expect(user1Match.getByTestId(`prediction-detail-${user1Uid}`)).toHaveText('Prediction: Japan by 7');
    await expect(user1Match.getByTestId(`prediction-detail-${user2.uid}`)).toHaveText('Prediction hidden');
    await expect(user1Match.getByTestId(`member-prediction-${user2.uid}`)).toContainText('Locked');

    await lockPick(page, user1Uid, MATCHES.jpnIta);
    await expect(user1Match.getByTestId(`prediction-detail-${user2.uid}`)).toHaveText('Prediction: Japan by 12');
    await expect(user1Match.getByTestId(`prediction-detail-${user3.uid}`)).toHaveText('Prediction hidden');

    await lockPick(page3, user3.uid, MATCHES.jpnIta);

    const remainingPicks = [
      { page, userId: user1Uid, matchId: MATCHES.nzlFra, winner: 'New Zealand', margin: 4 },
      { page, userId: user1Uid, matchId: MATCHES.ausIre, winner: 'Australia', margin: 8 },
      { page, userId: user1Uid, matchId: MATCHES.fijWal, winner: 'Fiji', margin: 10 },
      { page: page2, userId: user2.uid, matchId: MATCHES.nzlFra, winner: 'New Zealand', margin: 5 },
      { page: page2, userId: user2.uid, matchId: MATCHES.ausIre, winner: 'Australia', margin: 11 },
      { page: page2, userId: user2.uid, matchId: MATCHES.fijWal, winner: 'Fiji', margin: 3 },
      { page: page3, userId: user3.uid, matchId: MATCHES.nzlFra, winner: 'New Zealand', margin: 9 },
      { page: page3, userId: user3.uid, matchId: MATCHES.ausIre, winner: 'Ireland', margin: 8 },
      { page: page3, userId: user3.uid, matchId: MATCHES.fijWal, winner: 'Fiji', margin: 13 },
    ];

    for (const pick of remainingPicks) {
      await submitPick(pick.page, pick.userId, pick.matchId, pick.winner, pick.margin);
      await lockPick(pick.page, pick.userId, pick.matchId);
    }

    await finalizeAndWait(MATCHES.jpnIta, 27, 20);
    await finalizeAndWait(MATCHES.nzlFra, 24, 20);
    await finalizeAndWait(MATCHES.ausIre, 14, 22);
    await finalizeAndWait(MATCHES.fijWal, 31, 21);

    await expect.poll(async () => {
      const stats = await getUserTournamentStats(TEST_SEASON_ID, user1Uid);
      return `${stats?.totalPoints}:${stats?.correctWinners}:${stats?.sumErrOnCorrectWinners}:${stats?.exactScores}`;
    }).toBe('60:3:0:3');

    await expect.poll(async () => {
      const stats = await getUserTournamentStats(TEST_SEASON_ID, user2.uid);
      return `${stats?.totalPoints}:${stats?.correctWinners}:${stats?.sumErrOnCorrectWinners}:${stats?.exactScores}`;
    }).toBe('52:3:13:0');

    await expect.poll(async () => {
      const stats = await getUserTournamentStats(TEST_SEASON_ID, user3.uid);
      return `${stats?.totalPoints}:${stats?.correctWinners}:${stats?.sumErrOnCorrectWinners}:${stats?.exactScores}`;
    }).toBe('54:3:8:1');

    await page.goto(`/pools/${poolId}/round/1`);
    const finalMatch = page.getByTestId(`match-section-${MATCHES.jpnIta}`);
    await expect(finalMatch.getByTestId('member-status-final-result')).toContainText('Actual result: Japan 27–20 Italy');
    await expect(finalMatch.getByTestId(`prediction-detail-${user2.uid}`)).toHaveText('Prediction: Japan by 12');
    await expect(finalMatch.getByTestId(`prediction-score-${user2.uid}`)).toContainText('Points 17');
    await expect(finalMatch.getByTestId(`prediction-score-${user2.uid}`)).toContainText('Margin error 5');
    await expect(finalMatch.getByTestId(`prediction-score-${user2.uid}`)).toContainText('Winner correct Yes');
    await expect(finalMatch.getByTestId(`prediction-score-${user3.uid}`)).toContainText('Points 0');
    await expect(finalMatch.getByTestId(`prediction-score-${user3.uid}`)).toContainText('Winner correct No');

    await page.goto(`/pools/${poolId}/leaderboard`);
    await expect(page.getByRole('tab', { name: 'Pool' })).toHaveAttribute('aria-selected', 'true');

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText(TEST_USER.displayName);
    await expect(rows.nth(0)).toContainText('60');
    await expect(rows.nth(0)).toContainText('3');
    await expect(rows.nth(0)).toContainText('0');
    await expect(rows.nth(1)).toContainText(TEST_USER_3.displayName);
    await expect(rows.nth(1)).toContainText('54');
    await expect(rows.nth(1)).toContainText('8');
    await expect(rows.nth(2)).toContainText(TEST_USER_2.displayName);
    await expect(rows.nth(2)).toContainText('52');
    await expect(rows.nth(2)).toContainText('13');
  });
});
