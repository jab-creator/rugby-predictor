/**
 * Locking tests — M4: per-match irreversible locking.
 *
 * Uses the 'nations-championship-test' season (kickoff times in 2099) so security
 * rules allow pick saves and lockPick accepts the lock pre-kickoff.
 *
 * Prerequisites: emulators running (`npm run emulators`), including the
 * Functions emulator on port 5001 (required for lockPick callable and
 * the autoLockMatch HTTP endpoint).
 */

import { test, expect } from '@playwright/test';
import {
  createTestPool,
  deletePool,
  getPickStatus,
  getPrediction,
  getUserTournamentStats,
} from './helpers/firestore';
import {
  TEST_USER,
  TEST_SEASON_ID,
  FUNCTIONS_EMULATOR_URL,
  PROJECT_ID,
} from './helpers/constants';
import { waitForUserHeader } from './helpers/waits';

// Deterministic Round 1 fixture IDs used by the test helpers below.
const R1_NZL_FRA = `${TEST_SEASON_ID}-r1-NZL-FRA`;
const R1_JPN_ITA = `${TEST_SEASON_ID}-r1-JPN-ITA`;

function getTimestampMillis(value: unknown): number | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  return null;
}

async function getCurrentUid(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser'));
    if (!key) throw new Error('No Firebase auth user in localStorage');
    return JSON.parse(localStorage.getItem(key)!).uid as string;
  });
}

async function waitForRoundPage(
  page: import('@playwright/test').Page,
  round: number = 1,
): Promise<void> {
  await expect(page.getByRole('heading', { name: `Round ${round}` })).toBeVisible({ timeout: 15_000 });
}

function getFranceMatchCard(page: import('@playwright/test').Page) {
  return page
    .getByRole('button', { name: /France/i })
    .first()
    .locator('xpath=ancestor::div[contains(@class, "transition-colors")]');
}

function getFranceMarginInput(page: import('@playwright/test').Page) {
  return getFranceMatchCard(page).getByLabel('Winning Margin');
}

/** Select France + enter margin 7 for the NZL/FRA card, then wait for the persisted prediction. */
async function makeCompletePick(page: import('@playwright/test').Page): Promise<void> {
  const userId = await getCurrentUid(page);
  const poolId = page.url().match(/\/pools\/([^/]+)/)?.[1] ?? null;

  await getFranceMatchCard(page).getByRole('button', { name: /France/i }).click();
  await getFranceMarginInput(page).fill('7');

  await expect
    .poll(async () => {
      const prediction = await getPrediction(userId, R1_NZL_FRA);
      const status = poolId ? await getPickStatus(poolId, R1_NZL_FRA, userId) : null;
      return prediction?.isComplete === true && status?.isComplete === true;
    }, {
      timeout: 8_000,
    })
    .toBe(true);
}

// ---------------------------------------------------------------------------
// Lock button visibility
// ---------------------------------------------------------------------------

test.describe('Lock button visibility', () => {
  let poolId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForUserHeader(page);
    const uid = await getCurrentUid(page);
    ({ poolId } = await createTestPool(uid, TEST_USER.displayName, 'Lock Visibility Pool', TEST_SEASON_ID));
    await page.goto(`/pools/${poolId}/round/1`);
    await waitForRoundPage(page);
  });

  test.afterEach(async () => {
    await deletePool(poolId);
  });

  test('lock button is not shown before a complete pick is saved', async ({ page }) => {
    await expect(page.getByRole('button', { name: /lock pick/i })).not.toBeVisible();
  });

  test('lock button appears once a complete pick is saved', async ({ page }) => {
    await makeCompletePick(page);
    await expect(page.getByRole('button', { name: /lock pick/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('lock button disappears after locking', async ({ page }) => {
    await makeCompletePick(page);
    await page.getByRole('button', { name: /lock pick/i }).first().click();
    await expect(page.getByText(/pick locked/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /lock pick/i })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Locked state UI
// ---------------------------------------------------------------------------

test.describe('Locked state UI', () => {
  let poolId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/');
    await waitForUserHeader(page);
    const uid = await getCurrentUid(page);
    ({ poolId } = await createTestPool(uid, TEST_USER.displayName, 'Locked UI Pool', TEST_SEASON_ID));
    await page.goto(`/pools/${poolId}/round/1`);
    await waitForRoundPage(page);
    await makeCompletePick(page);
    await page.getByRole('button', { name: /lock pick/i }).first().click();
    await expect(page.getByText(/pick locked/i).first()).toBeVisible({ timeout: 15_000 });
    await page.close();
  });

  test.afterAll(async () => {
    await deletePool(poolId);
  });

  test('shows "Pick locked" banner', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await waitForRoundPage(page);
    await expect(page.getByText(/pick locked/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('shows "Pick is final and cannot be changed"', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await waitForRoundPage(page);
    await expect(page.getByText(/pick is final/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('France button is disabled', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await waitForRoundPage(page);
    await expect(page.getByRole('button', { name: /France/i }).first()).toBeDisabled({ timeout: 8_000 });
  });

  test('margin input is disabled', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await waitForRoundPage(page);
    await expect(getFranceMarginInput(page)).toBeDisabled({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// Lock persistence
// ---------------------------------------------------------------------------

test.describe('Lock persistence', () => {
  let poolId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/');
    await waitForUserHeader(page);
    const uid = await getCurrentUid(page);
    ({ poolId } = await createTestPool(uid, TEST_USER.displayName, 'Lock Persist Pool', TEST_SEASON_ID));
    await page.goto(`/pools/${poolId}/round/1`);
    await waitForRoundPage(page);
    await makeCompletePick(page);
    await page.getByRole('button', { name: /lock pick/i }).first().click();
    await expect(page.getByText(/pick locked/i).first()).toBeVisible({ timeout: 15_000 });
    await page.close();
  });

  test.afterAll(async () => {
    await deletePool(poolId);
  });

  test('locked pick remains locked after page reload', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await waitForRoundPage(page);
    await expect(page.getByText(/pick locked/i).first()).toBeVisible({ timeout: 8_000 });

    await page.reload();
    await waitForRoundPage(page);
    await expect(page.getByText(/pick locked/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('locked pick remains locked after navigating to another round and back', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await waitForRoundPage(page);

    await page.getByRole('button', { name: 'Round 2' }).click();
    await expect(page).toHaveURL(`/pools/${poolId}/round/2`);

    await page.getByRole('button', { name: 'Round 1' }).click();
    await expect(page).toHaveURL(`/pools/${poolId}/round/1`);
    await waitForRoundPage(page);

    await expect(page.getByText(/pick locked/i).first()).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// Bulk "Lock all completed" button
// ---------------------------------------------------------------------------

test.describe('Bulk lock button', () => {
  let poolId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForUserHeader(page);
    const uid = await getCurrentUid(page);
    ({ poolId } = await createTestPool(uid, TEST_USER.displayName, 'Bulk Lock Pool', TEST_SEASON_ID));
    await page.goto(`/pools/${poolId}/round/1`);
    await waitForRoundPage(page);
  });

  test.afterEach(async () => {
    await deletePool(poolId);
  });

  test('bulk lock button is not shown before any picks', async ({ page }) => {
    await expect(page.getByRole('button', { name: /lock all completed/i })).not.toBeVisible();
  });

  test('bulk lock button shows (1) after one complete pick', async ({ page }) => {
    await makeCompletePick(page);
    await expect(
      page.getByRole('button', { name: /lock all completed \(1\)/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test('clicking bulk lock locks all picks and button disappears', async ({ page }) => {
    await makeCompletePick(page);
    await page.getByRole('button', { name: /lock all completed/i }).click();

    // Button disappears once all picks are locked (count drops to 0)
    await expect(
      page.getByRole('button', { name: /lock all completed/i })
    ).not.toBeVisible({ timeout: 15_000 });

    // First match card now shows the locked state
    await expect(page.getByText(/pick locked/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// lastLockedPredictionAt tracking
// ---------------------------------------------------------------------------

test.describe('lastLockedPredictionAt tracking', () => {
  let poolId: string;
  let userId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForUserHeader(page);
    userId = await getCurrentUid(page);
    ({ poolId } = await createTestPool(userId, TEST_USER.displayName, 'Lock Timestamp Pool', TEST_SEASON_ID));
    await page.goto(`/pools/${poolId}/round/1`);
    await waitForRoundPage(page);
  });

  test.afterEach(async () => {
    await deletePool(poolId);
  });

  test('updates only on real lock events, not autosave edits', async ({ page }) => {
    await makeCompletePick(page);

    expect(await getUserTournamentStats(TEST_SEASON_ID, userId)).toBeNull();

    await page.getByRole('button', { name: /lock pick/i }).first().click();
    await expect(page.getByText(/pick locked/i).first()).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => {
        const prediction = await getPrediction(userId, R1_NZL_FRA);
        const stats = await getUserTournamentStats(TEST_SEASON_ID, userId);
        const predictionLockedAtMillis = getTimestampMillis(prediction?.lockedAt);
        const statsLockedAtMillis = getTimestampMillis(stats?.lastLockedPredictionAt);

        return predictionLockedAtMillis != null && predictionLockedAtMillis === statsLockedAtMillis
          ? predictionLockedAtMillis
          : null;
      }, {
        timeout: 8_000,
      })
      .not.toBeNull();

    const lockedStats = await getUserTournamentStats(TEST_SEASON_ID, userId);
    const lockedAtMillis = getTimestampMillis(lockedStats?.lastLockedPredictionAt);
    expect(lockedAtMillis).not.toBeNull();

    await page.getByRole('button', { name: /Japan/i }).first().click();
    await page.locator(`#margin-${R1_JPN_ITA}`).fill('3');

    await expect
      .poll(async () => {
        const prediction = await getPrediction(userId, R1_JPN_ITA);
        return prediction?.margin;
      }, {
        timeout: 8_000,
      })
      .toBe(3);

    const statsAfterAutosave = await getUserTournamentStats(TEST_SEASON_ID, userId);
    expect(getTimestampMillis(statsAfterAutosave?.lastLockedPredictionAt)).toBe(lockedAtMillis);
  });
});

// ---------------------------------------------------------------------------
// autoLockMatch HTTP endpoint (emulator direct call)
// ---------------------------------------------------------------------------

test.describe('autoLockMatch endpoint', () => {
  let poolId: string;
  let userId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForUserHeader(page);
    userId = await getCurrentUid(page);
    ({ poolId } = await createTestPool(userId, TEST_USER.displayName, 'AutoLock Pool', TEST_SEASON_ID));
    await page.goto(`/pools/${poolId}/round/1`);
    await waitForRoundPage(page);
    // Pre-save a complete pick so autoLockMatch has something to lock
    await makeCompletePick(page);
  });

  test.afterEach(async () => {
    await deletePool(poolId);
  });

  test('returns { ok: true, locked: 1 } for a pool with one complete pick', async ({ request }) => {
    const res = await request.post(
      `${FUNCTIONS_EMULATOR_URL}/${PROJECT_ID}/us-central1/autoLockMatch`,
      { data: { matchId: R1_NZL_FRA, seasonId: TEST_SEASON_ID } }
    );
    expect(res.ok()).toBe(true);
    const body = await res.json() as { ok: boolean; locked: number };
    expect(body.ok).toBe(true);
    expect(body.locked).toBeGreaterThanOrEqual(1);
  });

  test('sets lockedAt on both compatibility status docs and universal predictions', async ({ request }) => {
    await request.post(
      `${FUNCTIONS_EMULATOR_URL}/${PROJECT_ID}/us-central1/autoLockMatch`,
      { data: { matchId: R1_NZL_FRA, seasonId: TEST_SEASON_ID } }
    );

    const status = await getPickStatus(poolId, R1_NZL_FRA, userId);
    expect(status).not.toBeNull();
    expect(status!.lockedAt).not.toBeNull();

    const prediction = await getPrediction(userId, R1_NZL_FRA);
    expect(prediction).not.toBeNull();
    expect(prediction?.isLocked).toBe(true);
    expect(prediction?.lockedAt).not.toBeNull();
  });

  test('after autoLockMatch the pick shows as locked in the UI', async ({ page, request }) => {
    await request.post(
      `${FUNCTIONS_EMULATOR_URL}/${PROJECT_ID}/us-central1/autoLockMatch`,
      { data: { matchId: R1_NZL_FRA, seasonId: TEST_SEASON_ID } }
    );

    // The real-time subscription should update without a reload, but a reload
    // is the most reliable way to verify persistence.
    await page.reload();
    await waitForRoundPage(page);
    await expect(page.getByText(/pick locked/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('is idempotent — calling twice does not error', async ({ request }) => {
    const call = () =>
      request.post(
        `${FUNCTIONS_EMULATOR_URL}/${PROJECT_ID}/us-central1/autoLockMatch`,
        { data: { matchId: R1_NZL_FRA, seasonId: TEST_SEASON_ID } }
      );

    const first = await call();
    expect(first.ok()).toBe(true);
    expect((await first.json() as { locked: number }).locked).toBe(1);

    const second = await call();
    expect(second.ok()).toBe(true);
    // Already locked — nothing left to lock
    expect((await second.json() as { locked: number }).locked).toBe(0);
  });
});
