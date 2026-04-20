export const PROJECT_ID = 'demo-six-nations-predictor';
export const AUTH_EMULATOR_URL = 'http://localhost:9099';
export const FIRESTORE_EMULATOR_URL = 'http://localhost:8080';
export const FUNCTIONS_EMULATOR_URL = 'http://localhost:5001';
export const APP_URL = 'http://localhost:3000';

// The Auth Emulator accepts any value for the API key
export const FAKE_API_KEY = 'fake-api-key';

// This must match NEXT_PUBLIC_FIREBASE_API_KEY in .env.local
// For the emulator, this is typically the same fake key
export const FIREBASE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? FAKE_API_KEY;

// Real Six Nations 2026 season — used for read-only tests (round view etc.)
export const SEASON_ID = 'six-nations-2026';

// Future-dated test season — used for any test that writes picks.
// Security rules require kickoffAt > request.time, so tests that save picks
// must use fixtures whose kickoff times are in the far future.
export const TEST_SEASON_ID = 'six-nations-test';

export const TEST_USER = {
  email: 'playwright-test@example.com',
  password: 'playwright-test-password-123',
  displayName: 'Test User',
  photoURL: '',
};

export const TEST_USER_2 = {
  email: 'playwright-test-2@example.com',
  password: 'playwright-test-password-456',
  displayName: 'Second User',
  photoURL: '',
};

// Path to saved auth storage state
export const AUTH_FILE = 'e2e/.auth/user.json';
export const AUTH_FILE_2 = 'e2e/.auth/user2.json';
