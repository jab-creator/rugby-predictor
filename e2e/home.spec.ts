/**
 * Home page tests — authenticated.
 */

import { test, expect } from '@playwright/test';
import { TEST_USER } from './helpers/constants';
import { waitForUserHeader } from './helpers/waits';

test.describe('Authenticated home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForUserHeader(page);
  });

  test('shows the three CTA buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /view my pools/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create pool/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /join pool/i })).toBeVisible();
  });

  test('does NOT show the sign-in prompt', async ({ page }) => {
    await expect(page.getByText('Sign in to get started')).not.toBeVisible();
  });

  test('header shows the user display name', async ({ page }) => {
    await expect(page.getByText(TEST_USER.displayName, { exact: false })).toBeVisible();
  });

  test('"View My Pools" navigates to /pools', async ({ page }) => {
    await page.getByRole('button', { name: /view my pools/i }).click();
    await expect(page).toHaveURL('/pools');
  });

  test('"Create Pool" navigates to /pools/create', async ({ page }) => {
    await page.getByRole('button', { name: /create pool/i }).click();
    await expect(page).toHaveURL('/pools/create');
  });

  test('"Join Pool" navigates to /pools/join', async ({ page }) => {
    await page.getByRole('button', { name: /join pool/i }).click();
    await expect(page).toHaveURL('/pools/join');
  });
});

test.describe('Header navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForUserHeader(page);
  });

  test('"My Pools" header link navigates to /pools', async ({ page }) => {
    await page.getByRole('link', { name: /my pools/i }).click();
    await expect(page).toHaveURL('/pools');
  });

  test('Sign Out button signs out and returns to unauthenticated home', async ({ page }) => {
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Sign in to get started')).toBeVisible({ timeout: 8_000 });
  });
});
