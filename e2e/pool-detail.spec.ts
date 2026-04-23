/**
 * Pool detail page tests.
 */

import { test, expect } from '@playwright/test';
import { createTestPool, deletePool } from './helpers/firestore';
import { TEST_USER, SEASON_ID } from './helpers/constants';

async function getCurrentUid(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser'));
    if (!key) throw new Error('No Firebase auth user found in localStorage');
    return JSON.parse(localStorage.getItem(key)!).uid as string;
  });
}

test.describe('Pool detail page', () => {
  let poolId: string;
  let joinCode: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const uid = await getCurrentUid(page);
    const pool = await createTestPool(uid, TEST_USER.displayName, 'Detail Test Pool', SEASON_ID);
    poolId = pool.poolId;
    joinCode = pool.joinCode;
  });

  test.afterEach(async () => {
    await deletePool(poolId);
  });

  test('shows pool name, join code, season and member count', async ({ page }) => {
    await page.goto(`/pools/${poolId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Detail Test Pool' })).toBeVisible();
    await expect(page.getByText(joinCode)).toBeVisible();
    await expect(page.getByText(/nations-championship-2026/i)).toBeVisible();
    await expect(page.getByText(/members.*1/i)).toBeVisible();
  });

  test('copy button changes to "✓ Copied" then reverts', async ({ page }) => {
    await page.goto(`/pools/${poolId}`);
    await page.waitForLoadState('networkidle');

    const copyBtn = page.getByRole('button', { name: /copy/i });
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    await expect(copyBtn).toHaveText(/copied/i, { timeout: 2_000 });

    // After ~2 seconds it reverts
    await expect(copyBtn).toHaveText(/^copy$/i, { timeout: 4_000 });
  });

  test('shows 5 round buttons', async ({ page }) => {
    await page.goto(`/pools/${poolId}`);
    await page.waitForLoadState('networkidle');

    for (let r = 1; r <= 5; r++) {
      await expect(page.getByRole('button', { name: new RegExp(`round\\s*${r}`, 'i') })).toBeVisible();
    }
  });

  test('clicking round button navigates to round view', async ({ page }) => {
    await page.goto(`/pools/${poolId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /round\s*1/i }).click();
    await expect(page).toHaveURL(`/pools/${poolId}/round/1`);
  });

  test('members section shows the creator with crown', async ({ page }) => {
    await page.goto(`/pools/${poolId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(TEST_USER.displayName)).toBeVisible();
    await expect(page.getByText('👑')).toBeVisible();
  });

  test('"Back to Pools" link navigates to /pools', async ({ page }) => {
    await page.goto(`/pools/${poolId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('link', { name: /back to pools/i }).click();
    await expect(page).toHaveURL('/pools');
  });

  test('non-existent pool shows an error state', async ({ page }) => {
    await page.goto('/pools/definitely-does-not-exist-abc');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/pool not found|failed to load/i)).toBeVisible({ timeout: 8_000 });
  });
});
