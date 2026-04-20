/**
 * Locking tests — M4: per-match irreversible locking.
 *
 * Uses the 'six-nations-test' season (kickoff times in 2099) so security
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
} from './helpers/firestore';
import {
  TEST_USER,
  TEST_SEASON_ID,
  FUNCTIONS_EMULATOR_URL,
  PROJECT_ID,
} from './helpers/constants';

// Deterministic match ID for Round 1, France vs Ireland (first match by kickoff)
const R1_FRA_IRE = `${TEST_SEASON_ID}-r1-FRA-IRE`;

async function getCurrentUid(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser'));
    if (!key) throw new Error('No Firebase auth user in localStorage');
    return JSON.parse(localStorage.getItem(key)!).uid as string;
  });
}

/** Select France + enter margin 7 for the first match card, wait for autosave. */
async function makeCompletePick(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: /France/i }).first().click();
  await page.getByLabel('Winning Margin').first().fill('7');
  await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 8_000 });
}

// ---------------------------------------------------------------------------
// Lock button visibility
// ---------------------------------------------------------------------------

test.describe('Lock button visibility', () => {
  let poolId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const uid = await getCurrentUid(page);
    ({ poolId } = await createTestPool(uid, TEST_USER.displayName, 'Lock Visibility Pool', TEST_SEASON_ID));
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');
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
    await page.waitForLoadState('networkidle');
    const uid = await getCurrentUid(page);
    ({ poolId } = await createTestPool(uid, TEST_USER.displayName, 'Locked UI Pool', TEST_SEASON_ID));
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');
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
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/pick locked/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('shows "Pick is final and cannot be changed"', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/pick is final/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('France button is disabled', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /France/i }).first()).toBeDisabled({ timeout: 8_000 });
  });

  test('margin input is disabled', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByLabel('Winning Margin').first()).toBeDisabled({ timeout: 8_000 });
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
    await page.waitForLoadState('networkidle');
    const uid = await getCurrentUid(page);
    ({ poolId } = await createTestPool(uid, TEST_USER.displayName, 'Lock Persist Pool', TEST_SEASON_ID));
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');
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
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/pick locked/i).first()).toBeVisible({ timeout: 8_000 });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/pick locked/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('locked pick remains locked after navigating to another round and back', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Round 2' }).click();
    await expect(page).toHaveURL(`/pools/${poolId}/round/2`);

    await page.getByRole('button', { name: 'Round 1' }).click();
    await expect(page).toHaveURL(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');

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
    await page.waitForLoadState('networkidle');
    const uid = await getCurrentUid(page);
    ({ poolId } = await createTestPool(uid, TEST_USER.displayName, 'Bulk Lock Pool', TEST_SEASON_ID));
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');
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
// autoLockMatch HTTP endpoint (emulator direct call)
// ---------------------------------------------------------------------------

test.describe('autoLockMatch endpoint', () => {
  let poolId: string;
  let userId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    userId = await getCurrentUid(page);
    ({ poolId } = await createTestPool(userId, TEST_USER.displayName, 'AutoLock Pool', TEST_SEASON_ID));
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');
    // Pre-save a complete pick so autoLockMatch has something to lock
    await makeCompletePick(page);
  });

  test.afterEach(async () => {
    await deletePool(poolId);
  });

  test('returns { ok: true, locked: 1 } for a pool with one complete pick', async ({ request }) => {
    const res = await request.post(
      `${FUNCTIONS_EMULATOR_URL}/${PROJECT_ID}/us-central1/autoLockMatch`,
      { data: { matchId: R1_FRA_IRE, seasonId: TEST_SEASON_ID } }
    );
    expect(res.ok()).toBe(true);
    const body = await res.json() as { ok: boolean; locked: number };
    expect(body.ok).toBe(true);
    expect(body.locked).toBeGreaterThanOrEqual(1);
  });

  test('sets lockedAt in Firestore after the call', async ({ request }) => {
    await request.post(
      `${FUNCTIONS_EMULATOR_URL}/${PROJECT_ID}/us-central1/autoLockMatch`,
      { data: { matchId: R1_FRA_IRE, seasonId: TEST_SEASON_ID } }
    );

    const status = await getPickStatus(poolId, R1_FRA_IRE, userId);
    expect(status).not.toBeNull();
    expect(status!.lockedAt).not.toBeNull();
  });

  test('after autoLockMatch the pick shows as locked in the UI', async ({ page, request }) => {
    await request.post(
      `${FUNCTIONS_EMULATOR_URL}/${PROJECT_ID}/us-central1/autoLockMatch`,
      { data: { matchId: R1_FRA_IRE, seasonId: TEST_SEASON_ID } }
    );

    // The real-time subscription should update without a reload, but a reload
    // is the most reliable way to verify persistence.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/pick locked/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('is idempotent — calling twice does not error', async ({ request }) => {
    const call = () =>
      request.post(
        `${FUNCTIONS_EMULATOR_URL}/${PROJECT_ID}/us-central1/autoLockMatch`,
        { data: { matchId: R1_FRA_IRE, seasonId: TEST_SEASON_ID } }
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
