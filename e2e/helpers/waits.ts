import { expect, type Page } from '@playwright/test';
import { TEST_USER } from './constants';

export async function waitForUserHeader(
  page: Page,
  displayName: string = TEST_USER.displayName,
): Promise<void> {
  await expect(page.getByText(displayName, { exact: false })).toBeVisible({ timeout: 10_000 });
}

export async function waitForPublicHome(page: Page): Promise<void> {
  await expect(page.getByText('Sign in to get started')).toBeVisible({ timeout: 10_000 });
}
