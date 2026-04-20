/**
 * Auth helpers for Playwright tests.
 * Creates users in the Firebase Auth Emulator via REST API and injects
 * their auth state into browser localStorage so Playwright's storageState
 * can capture and replay the session.
 */

import type { Page } from '@playwright/test';
import {
  AUTH_EMULATOR_URL,
  FAKE_API_KEY,
  FIREBASE_API_KEY,
  PROJECT_ID,
} from './constants';
import { createUserProfile } from './firestore';

export interface TestAuthUser {
  uid: string;
  email: string;
  displayName: string;
  idToken: string;
  refreshToken: string;
}

/**
 * Create a user in the Firebase Auth Emulator via REST.
 * Safe to call multiple times — if the user already exists the existing one is returned.
 */
export async function createTestUser(
  email: string,
  password: string,
  displayName: string,
): Promise<TestAuthUser> {
  // 1. Create the user (may already exist — that's fine)
  await fetch(
    `${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        displayName,
        emailVerified: true,
      }),
    },
  ).catch(() => {
    // Network errors ignored — user may already exist
  });

  // 2. Sign in to get tokens
  const signInRes = await fetch(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FAKE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );

  if (!signInRes.ok) {
    const err = await signInRes.text();
    throw new Error(`Auth Emulator sign-in failed: ${err}`);
  }

  const { idToken, refreshToken, localId: uid } = (await signInRes.json()) as {
    idToken: string;
    refreshToken: string;
    localId: string;
  };

  // 3. Create the user profile in Firestore (mirrors AuthContext.signInWithGoogle)
  await createUserProfile(uid, displayName, email);

  return { uid, email, displayName, idToken, refreshToken };
}

/**
 * Inject Firebase auth state into browser localStorage.
 *
 * Firebase SDK with browserLocalPersistence reads from:
 *   localStorage key: `firebase:authUser:${apiKey}:[DEFAULT]`
 *
 * After calling this + page.reload(), the Firebase SDK will fire
 * onAuthStateChanged with the test user — exactly as if they had
 * previously signed in via Google OAuth.
 *
 * Call page.reload() after this, then waitForSelector to confirm auth.
 */
export async function injectAuthState(
  page: Page,
  user: TestAuthUser,
): Promise<void> {
  const expirationTime = Date.now() + 60 * 60 * 1000; // 1 hour from now

  const authObject = {
    uid: user.uid,
    email: user.email,
    emailVerified: true,
    displayName: user.displayName,
    isAnonymous: false,
    photoURL: '',
    providerData: [
      {
        providerId: 'password',
        uid: user.email,
        displayName: user.displayName,
        email: user.email,
        phoneNumber: null,
        photoURL: '',
      },
    ],
    stsTokenManager: {
      refreshToken: user.refreshToken,
      accessToken: user.idToken,
      expirationTime,
    },
    createdAt: String(Date.now()),
    lastLoginAt: String(Date.now()),
    apiKey: FIREBASE_API_KEY,
    appName: '[DEFAULT]',
  };

  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    {
      key: `firebase:authUser:${FIREBASE_API_KEY}:[DEFAULT]`,
      value: authObject,
    },
  );
}
