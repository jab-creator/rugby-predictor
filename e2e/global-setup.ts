/**
 * Playwright globalSetup — runs once before all test projects.
 *
 * 1. Wipes all Firestore data in the emulator (clean slate each run)
 * 2. Seeds Six Nations 2026 season + 15 match fixtures via the app's /api/seed route
 *
 * Requires emulators to be running: `npm run emulators`
 * Requires Next.js dev server to be running: `npm run dev`
 */

import { clearFirestore } from './helpers/firestore';
import { APP_URL } from './helpers/constants';

export default async function globalSetup(): Promise<void> {
  console.log('\n[globalSetup] Clearing Firestore emulator data...');
  await clearFirestore();
  console.log('[globalSetup] Firestore cleared.');

  console.log('[globalSetup] Seeding Six Nations 2026 fixtures...');
  const res = await fetch(`${APP_URL}/api/seed`);

  if (!res.ok) {
    throw new Error(`[globalSetup] /api/seed failed with status ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { success: boolean; message: string };
  console.log(`[globalSetup] Seed result: ${data.message}`);

  if (!data.success) {
    throw new Error(`[globalSetup] Seeding failed: ${data.message}`);
  }

  console.log('[globalSetup] Done.\n');
}
