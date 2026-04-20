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

  test('Round 1 shows 3 match cards', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');

    // Each match is wrapped in a container with border — count them
    // We check for team names that appear in Round 1 fixtures
    await expect(page.getByText('France')).toBeVisible();
    await expect(page.getByText('Ireland')).toBeVisible();
    await expect(page.getByText('Italy')).toBeVisible();
    await expect(page.getByText('Scotland')).toBeVisible();
    await expect(page.getByText('England')).toBeVisible();
    await expect(page.getByText('Wales')).toBeVisible();
  });

  test('Round 1 shows team flag emojis', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');

    // Check for any flag emoji (each team has one)
    const content = await page.content();
    // France 🇫🇷, Ireland 🇮🇪, Italy 🇮🇹, Scotland 🏴󠁧󠁢󠁳󠁣󠁴󠁿, England 🏴󠁧󠁢󠁥󠁮󠁧󠁿, Wales 🏴󠁧󠁢󠁷󠁬󠁳󠁿
    expect(content).toContain('🇫🇷');
    expect(content).toContain('🇮🇪');
  });

  test('round navigation tabs are visible with Round 1 active', async ({ page }) => {
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');

    // All 5 round tabs visible
    for (let r = 1; r <= 5; r++) {
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

  // Check that all 5 rounds have exactly 3 matches (fixture data completeness)
  for (let round = 1; round <= 5; round++) {
    test(`Round ${round} shows 3 matches`, async ({ page }) => {
      await page.goto(`/pools/${poolId}/round/${round}`);
      await page.waitForLoadState('networkidle');

      // "Winning Margin" label appears once per match card
      const marginLabels = page.getByText('Winning Margin');
      await expect(marginLabels).toHaveCount(3, { timeout: 10_000 });
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
