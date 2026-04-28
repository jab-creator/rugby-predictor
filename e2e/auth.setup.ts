/**
 * Playwright auth setup — runs once in the 'setup' project before 'authenticated' tests.
 *
 * Strategy:
 *  1. Create test user in Firebase Auth Emulator via REST
 *  2. Navigate to the app and inject the auth token into localStorage
 *     (works because firebase.ts forces browserLocalPersistence in emulator mode)
 *  3. Reload page so Firebase SDK reads localStorage and fires onAuthStateChanged
 *  4. Verify auth by waiting for user name in header
 *  5. Save storageState → e2e/.auth/user.json (replayed in all authenticated tests)
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { createTestUser } from './helpers/auth';
import { injectAuthState } from './helpers/auth';
import { TEST_USER, AUTH_FILE } from './helpers/constants';

const authFile = path.join(process.cwd(), AUTH_FILE);

setup('create authenticated session', async ({ page }) => {
  console.log('[auth.setup] Creating test user in Auth Emulator...');
  const user = await createTestUser(TEST_USER.email, TEST_USER.password, TEST_USER.displayName);
  console.log(`[auth.setup] Test user: uid=${user.uid}, email=${user.email}`);

  // Navigate to app first so we can manipulate its localStorage
  await page.goto('/');
  await expect(page.getByRole('link', { name: /nations championship/i })).toBeVisible();

  console.log('[auth.setup] Injecting auth state into localStorage...');
  await injectAuthState(page, user);

  // Reload so Firebase SDK picks up the localStorage auth token
  await page.reload();

  // Verify that the Firebase SDK recognised the stored auth and the UI updated
  // The Header component shows user.displayName when authenticated
  await expect(
    page.getByText(TEST_USER.displayName, { exact: false }),
  ).toBeVisible({ timeout: 10_000 });

  console.log('[auth.setup] Auth confirmed. Saving storage state...');
  await page.context().storageState({ path: authFile });
  console.log(`[auth.setup] Saved → ${AUTH_FILE}`);
});
