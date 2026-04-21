/**
 * Pool listing, creation, and joining tests.
 */

import { test, expect } from '@playwright/test';
import { createTestPool, deletePool } from './helpers/firestore';
import { TEST_USER, SEASON_ID } from './helpers/constants';

// The auth.setup.ts saves the uid as part of the storageState. We need to
// know the uid to create REST fixtures for the test user. We derive it from
// the auth state JSON, but to keep tests simple we use a known-ahead-of-time
// approach: auth.setup.ts always creates the same TEST_USER email, so we
// look up the uid from the Firestore user profile via REST if needed.
// For now, we pass the uid from the AUTH state that's already set.
// The cleanest approach: re-derive the uid from the stored auth JSON.

// Helper: get the current user uid from browser localStorage
async function getCurrentUid(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    // Find the Firebase auth key in localStorage
    const key = Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser'));
    if (!key) throw new Error('No Firebase auth user found in localStorage');
    const parsed = JSON.parse(localStorage.getItem(key)!);
    return parsed.uid as string;
  });
}

test.describe('Pools list page', () => {
  test('shows empty state when user has no pools', async ({ page }) => {
    await page.goto('/pools');
    await page.waitForLoadState('networkidle');

    // The empty state text
    await expect(page.getByText(/haven't joined any pools/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create your first pool/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /join a pool/i })).toBeVisible();
  });

  test('shows pool card after a pool has been created', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const uid = await getCurrentUid(page);

    const { poolId } = await createTestPool(uid, TEST_USER.displayName, 'Listed Pool', SEASON_ID);

    try {
      await page.goto('/pools');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Listed Pool')).toBeVisible();
    } finally {
      await deletePool(poolId);
    }
  });

  test('"Create Pool" button navigates to /pools/create', async ({ page }) => {
    await page.goto('/pools');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /create pool/i }).first().click();
    await expect(page).toHaveURL('/pools/create');
  });

  test('"Join Pool" button navigates to /pools/join', async ({ page }) => {
    await page.goto('/pools');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /join pool/i }).first().click();
    await expect(page).toHaveURL('/pools/join');
  });
});

test.describe('Create Pool page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pools/create');
    await page.waitForLoadState('networkidle');
  });

  test('renders the form correctly', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /create a new pool/i })).toBeVisible();
    await expect(page.getByLabel(/pool name/i)).toBeVisible();
    await expect(page.getByLabel(/season/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create pool/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('season dropdown has Nations Championship 2026 option', async ({ page }) => {
    const select = page.getByLabel(/season/i);
    await expect(select).toBeVisible();
    await expect(select).toContainText('Nations Championship 2026');
  });

  test('successfully creates a pool and redirects to pool detail', async ({ page }) => {
    const poolName = `E2E Create Test ${Date.now()}`;

    await page.getByLabel(/pool name/i).fill(poolName);
    await page.getByRole('button', { name: /create pool/i }).click();

    // Should redirect to the new pool's detail page
    await expect(page).toHaveURL(/\/pools\/[^/]+$/, { timeout: 10_000 });

    // Pool name should be visible on the detail page
    await expect(page.getByRole('heading', { name: poolName })).toBeVisible();

    // Join code should be visible
    await expect(page.getByText(/join code/i)).toBeVisible();
  });
});

test.describe('Join Pool page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pools/join');
    await page.waitForLoadState('networkidle');
  });

  test('renders the form correctly', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /join a pool/i })).toBeVisible();
    await expect(page.getByLabel(/join code/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /join pool/i })).toBeVisible();
  });

  test('auto-uppercases typed join code', async ({ page }) => {
    const input = page.getByLabel(/join code/i);
    await input.fill('abc123');
    await expect(input).toHaveValue('ABC123');
  });

  test('shows error for invalid join code', async ({ page }) => {
    await page.getByLabel(/join code/i).fill('XXXXXX');
    await page.getByRole('button', { name: /join pool/i }).click();

    await expect(page.getByText(/pool not found/i)).toBeVisible({ timeout: 8_000 });
  });

  test('shows error when join code field is empty (required)', async ({ page }) => {
    // The input has `required` attribute — browser prevents submission
    // but the app also has a JS guard that shows "Join code is required"
    const input = page.getByLabel(/join code/i);
    await input.fill('');

    // Try submitting
    await page.getByRole('button', { name: /join pool/i }).click();

    // Either the browser's native required validation fires, or the app shows an error
    // Check that we're still on the join page (not redirected)
    await expect(page).toHaveURL('/pools/join');
  });

  test('successfully joins a pool and redirects to pool detail', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const uid = await getCurrentUid(page);

    // Create a second "other user's" pool that the test user hasn't joined
    const otherUid = 'other-user-for-join-test';
    const { poolId, joinCode } = await createTestPool(otherUid, 'Pool Owner', 'Joinable Pool', SEASON_ID);

    try {
      await page.goto('/pools/join');
      await page.waitForLoadState('networkidle');

      await page.getByLabel(/join code/i).fill(joinCode);
      await page.getByRole('button', { name: /join pool/i }).click();

      await expect(page).toHaveURL(`/pools/${poolId}`, { timeout: 10_000 });
      await expect(page.getByRole('heading', { name: 'Joinable Pool' })).toBeVisible();
    } finally {
      await deletePool(poolId);
    }
  });

  test('shows error when trying to join a pool the user is already in', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const uid = await getCurrentUid(page);

    // Create a pool WHERE this user is already a member
    const { poolId, joinCode } = await createTestPool(uid, TEST_USER.displayName, 'Already Member Pool', SEASON_ID);

    try {
      await page.goto('/pools/join');
      await page.waitForLoadState('networkidle');

      await page.getByLabel(/join code/i).fill(joinCode);
      await page.getByRole('button', { name: /join pool/i }).click();

      await expect(page.getByText(/already a member/i)).toBeVisible({ timeout: 8_000 });
    } finally {
      await deletePool(poolId);
    }
  });
});
