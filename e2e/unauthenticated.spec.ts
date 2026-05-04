/**
 * Unauthenticated tests — runs WITHOUT auth storageState.
 * Verifies the logged-out experience and that protected routes redirect correctly.
 */

import { test, expect } from '@playwright/test';
import { waitForPublicHome } from './helpers/waits';

test.describe('Unauthenticated — home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPublicHome(page);
  });

  test('shows the Nations Championship Predictor heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Nations Championship Predictor/i })).toBeVisible();
  });

  test('shows "Sign in to get started" prompt', async ({ page }) => {
    await expect(page.getByText('Sign in to get started')).toBeVisible();
  });

  test('header shows a Sign In button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('authenticated CTAs are not shown', async ({ page }) => {
    await expect(page.getByRole('button', { name: /view my pools/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /create pool/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /join pool/i })).not.toBeVisible();
  });
});

test.describe('Unauthenticated — protected routes redirect to home', () => {
  test('/pools redirects to /', async ({ page }) => {
    await page.goto('/pools');
    await expect(page).toHaveURL(/\//);
    await expect(page.getByText('Sign in to get started')).toBeVisible();
  });

  test('/pools/create redirects to /', async ({ page }) => {
    await page.goto('/pools/create');
    await expect(page).toHaveURL(/\//);
  });

  test('/pools/join redirects to /', async ({ page }) => {
    await page.goto('/pools/join');
    await expect(page).toHaveURL(/\//);
  });
});
