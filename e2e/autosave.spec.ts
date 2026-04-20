/**
 * MatchCard autosave tests — the most nuanced spec.
 * Tests winner selection, margin input, autosave debounce,
 * and pick persistence across reloads.
 *
 * Rules:
 * - Never use page.waitForTimeout() for the debounce — use waitForSelector instead.
 * - Each test creates its own pool for isolation.
 */

import { test, expect } from '@playwright/test';
import { createTestPool, deletePool } from './helpers/firestore';
import { TEST_USER, TEST_SEASON_ID } from './helpers/constants';

async function getCurrentUid(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser'));
    if (!key) throw new Error('No Firebase auth user found in localStorage');
    return JSON.parse(localStorage.getItem(key)!).uid as string;
  });
}

test.describe('MatchCard — winner selection', () => {
  let poolId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const uid = await getCurrentUid(page);
    const pool = await createTestPool(uid, TEST_USER.displayName, 'Autosave Pool', TEST_SEASON_ID);
    poolId = pool.poolId;
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await deletePool(poolId);
  });

  test('shows "Select winner and margin" before any picks', async ({ page }) => {
    await expect(page.getByText('Select winner and margin').first()).toBeVisible();
  });

  test('clicking France highlights it with a checkmark', async ({ page }) => {
    // Click the France team button
    await page.getByRole('button', { name: /France/i }).first().click();

    // The checkmark ✓ should appear next to France
    // The selected button gets border-blue-500 class
    const franceBtn = page.getByRole('button', { name: /France/i }).first();
    await expect(franceBtn).toHaveClass(/border-blue-500/);

    // Checkmark visible
    await expect(franceBtn.getByText('✓')).toBeVisible();
  });

  test('clicking selected winner deselects it', async ({ page }) => {
    const franceBtn = page.getByRole('button', { name: /France/i }).first();
    await franceBtn.click(); // select
    await expect(franceBtn).toHaveClass(/border-blue-500/);

    await franceBtn.click(); // deselect
    await expect(franceBtn).not.toHaveClass(/border-blue-500/);
  });

  test('selecting second team deselects first', async ({ page }) => {
    // In Round 1, first match is France vs Ireland
    const franceBtn = page.getByRole('button', { name: /France/i }).first();
    const irelandBtn = page.getByRole('button', { name: /Ireland/i }).first();

    await franceBtn.click();
    await expect(franceBtn).toHaveClass(/border-blue-500/);

    await irelandBtn.click();
    await expect(irelandBtn).toHaveClass(/border-blue-500/);
    await expect(franceBtn).not.toHaveClass(/border-blue-500/);
  });
});

test.describe('MatchCard — margin input', () => {
  let poolId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const uid = await getCurrentUid(page);
    const pool = await createTestPool(uid, TEST_USER.displayName, 'Margin Pool', TEST_SEASON_ID);
    poolId = pool.poolId;
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await deletePool(poolId);
  });

  test('margin input accepts a valid value (7)', async ({ page }) => {
    const marginInput = page.getByLabel('Winning Margin').first();
    await marginInput.fill('7');
    await expect(marginInput).toHaveValue('7');
  });

  test('margin input rejects 0 (value stays empty)', async ({ page }) => {
    const marginInput = page.getByLabel('Winning Margin').first();
    await marginInput.fill('0');
    // handleMarginChange returns early for values outside 1-99
    await expect(marginInput).toHaveValue('');
  });

  test('margin input rejects 100', async ({ page }) => {
    const marginInput = page.getByLabel('Winning Margin').first();
    await marginInput.fill('100');
    await expect(marginInput).toHaveValue('');
  });

  test('margin input accepts boundary value 1', async ({ page }) => {
    const marginInput = page.getByLabel('Winning Margin').first();
    await marginInput.fill('1');
    await expect(marginInput).toHaveValue('1');
  });

  test('margin input accepts boundary value 99', async ({ page }) => {
    const marginInput = page.getByLabel('Winning Margin').first();
    await marginInput.fill('99');
    await expect(marginInput).toHaveValue('99');
  });

  test('shows "Pick Complete" after selecting winner and entering margin', async ({ page }) => {
    await page.getByRole('button', { name: /France/i }).first().click();
    await page.getByLabel('Winning Margin').first().fill('7');

    // Pick is complete but hasn't autosaved yet (debounce)
    await expect(page.getByText(/pick complete/i).first()).toBeVisible({ timeout: 3_000 });
  });
});

test.describe('MatchCard — autosave', () => {
  let poolId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const uid = await getCurrentUid(page);
    const pool = await createTestPool(uid, TEST_USER.displayName, 'Autosave Debounce Pool', TEST_SEASON_ID);
    poolId = pool.poolId;
    await page.goto(`/pools/${poolId}/round/1`);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await deletePool(poolId);
  });

  test('autosave fires and shows "Saved" after picking winner and margin', async ({ page }) => {
    // Make a complete pick
    await page.getByRole('button', { name: /France/i }).first().click();
    await page.getByLabel('Winning Margin').first().fill('15');

    // Wait for "Saving..." to appear (debounce fires after 500ms)
    await expect(page.getByText(/saving/i).first()).toBeVisible({ timeout: 4_000 });

    // Then wait for "Saved" confirmation
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('picks persist after page reload', async ({ page }) => {
    // Make and save a pick
    await page.getByRole('button', { name: /France/i }).first().click();
    await page.getByLabel('Winning Margin').first().fill('12');

    // Wait for save confirmation
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 8_000 });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // France should still be selected (blue border)
    const franceBtn = page.getByRole('button', { name: /France/i }).first();
    await expect(franceBtn).toHaveClass(/border-blue-500/, { timeout: 8_000 });

    // Margin should be restored
    const marginInput = page.getByLabel('Winning Margin').first();
    await expect(marginInput).toHaveValue('12', { timeout: 8_000 });
  });

  test('picks persist after navigating away and back', async ({ page }) => {
    // Make and save a pick
    await page.getByRole('button', { name: /France/i }).first().click();
    await page.getByLabel('Winning Margin').first().fill('8');

    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 8_000 });

    // Navigate to round 2 and back
    await page.getByRole('button', { name: 'Round 2' }).click();
    await expect(page).toHaveURL(`/pools/${poolId}/round/2`);

    await page.getByRole('button', { name: 'Round 1' }).click();
    await expect(page).toHaveURL(`/pools/${poolId}/round/1`);

    await page.waitForLoadState('networkidle');

    // Pick should be restored from Firestore
    const franceBtn = page.getByRole('button', { name: /France/i }).first();
    await expect(franceBtn).toHaveClass(/border-blue-500/, { timeout: 8_000 });
  });
});
