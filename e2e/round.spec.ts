/**
 * Round page tests — match cards, round navigation, fixture data.
 * Requires fixtures to be seeded (done in globalSetup).
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

test.describe('Round view', () => {
  let poolId: string;

  test.beforeAll(async ({ browser }) => {
    // Create a single pool shared across all round tests (read-only usage)
    const page = await browser.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const uid = await getCurrentUid(page);
    await page.close();
    const pool = await createTestPool(uid, TEST_USER.displayName, 'Round Tests Pool', SEASON_ID);
    poolId = pool.poolId;
  });

  test.afterAll(async () => {
    await deletePool(poolId);
  });

  test('Round 1 shows 6 match cards', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');

    // Check for team names that appear in Round 1 fixtures (all 12 teams play)
    await expect(page.getByText('Japan')).toBeVisible();
    await expect(page.getByText('Italy')).toBeVisible();
    await expect(page.getByText('New Zealand')).toBeVisible();
    await expect(page.getByText('France')).toBeVisible();
    await expect(page.getByText('Australia')).toBeVisible();
    await expect(page.getByText('Ireland')).toBeVisible();
    await expect(page.getByText('Fiji')).toBeVisible();
    await expect(page.getByText('Wales')).toBeVisible();
    await expect(page.getByText('South Africa')).toBeVisible();
    await expect(page.getByText('England')).toBeVisible();
    await expect(page.getByText('Argentina')).toBeVisible();
    await expect(page.getByText('Scotland')).toBeVisible();
  });

  test('Round 1 shows team flag emojis', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');

    const content = await page.content();
    // Check for a sample of flag emojis
    expect(content).toContain('🇫🇷');
    expect(content).toContain('🇮🇪');
    expect(content).toContain('🇯🇵');
    expect(content).toContain('🇿🇦');
  });

  test('round navigation tabs are visible with Round 1 active', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');

    // All 6 round tabs visible
    for (let r = 1; r <= 6; r++) {
      await expect(page.getByRole('button', { name: `Round ${r}` })).toBeVisible();
    }

    // Round 1 tab should have the active (blue) class
    const round1Tab = page.getByRole('button', { name: 'Round 1' });
    await expect(round1Tab).toHaveClass(/bg-blue-600/);
  });

  test('clicking Round 2 tab navigates to round 2', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Round 2' }).click();
    await expect(page).toHaveURL(`/pools/${poolId}/round/2`);

    // Round 2 heading visible
    await expect(page.getByRole('heading', { name: /round 2/i })).toBeVisible();

    // Round 2 tab is now active
    const round2Tab = page.getByRole('button', { name: 'Round 2' });
    await expect(round2Tab).toHaveClass(/bg-blue-600/);
  });

  // Check that all 6 rounds have exactly 6 matches (fixture data completeness)
  for (let round = 1; round <= 6; round++) {
    test(`Round ${round} shows 6 matches`, async ({ page }) => {
      await page.goto(`/pools/${poolId}/round/${round}`);
      await page.waitForLoadState('networkidle');

      // "Winning Margin" label appears once per match card
      const marginLabels = page.getByText('Winning Margin');
      await expect(marginLabels).toHaveCount(6, { timeout: 10_000 });
    });
  }

  test('autosave banner is visible', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/autosave enabled/i)).toBeVisible();
  });

  test('"Back to Pool" link navigates to pool detail', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('link', { name: /back to/i }).click();
    await expect(page).toHaveURL(`/pools/${poolId}`);
  });
});
