import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, 'e2e/.auth/user.json');

export default defineConfig({
  // ─── Global setup ─────────────────────────────────────────────────────────
  // Runs once before all projects: wipes Firestore + seeds fixtures
  globalSetup: './e2e/global-setup.ts',

  testDir: './e2e',

  // ─── Defaults ─────────────────────────────────────────────────────────────
  fullyParallel: false, // Keep sequential to avoid Firestore race conditions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker to share emulator state safely

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  // ─── Projects ─────────────────────────────────────────────────────────────
  projects: [
    // 1. Auth setup — creates the test user and saves auth storage state
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    // 2. Unauthenticated tests — deliberately no storageState
    {
      name: 'unauthenticated',
      testMatch: '**/unauthenticated.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    // 3. All authenticated tests — depend on setup to have run first
    {
      name: 'authenticated',
      testMatch: [
        '**/home.spec.ts',
        '**/pools.spec.ts',
        '**/pool-detail.spec.ts',
        '**/round.spec.ts',
        '**/autosave.spec.ts',
        '**/multi-user.spec.ts',
        '**/locking.spec.ts',
        '**/scoring.spec.ts',
        '**/profile.spec.ts',
        '**/admin.spec.ts',
      ],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
    },
  ],

  // ─── Dev server ───────────────────────────────────────────────────────────
  // Starts Next.js dev server if not already running.
  // NOTE: Firebase Emulators must be started separately:
  //   npm run emulators
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  outputDir: 'test-results',
});
