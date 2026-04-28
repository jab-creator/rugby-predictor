import { User } from 'firebase/auth';
import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { Hemisphere, UserProfile } from './types';

const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;

export interface SaveUserProfileInput {
  countryCode?: string | null;
  hemisphere?: Hemisphere | null;
}

interface SetUserPunditStatusData {
  email?: string;
  userId?: string;
  isPundit: boolean;
}

export interface SetUserPunditStatusResult {
  userId: string;
  email: string | null;
  displayName: string;
  isPundit: boolean;
  syncedStats: number;
}

interface BackfillUserTournamentStatsProfilesData {
  email?: string;
  userId?: string;
}

export interface BackfillUserTournamentStatsProfilesResult {
  syncedUsers: number;
  syncedStats: number;
}

export function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidCountryCode(value: string): boolean {
  return COUNTRY_CODE_REGEX.test(normalizeCountryCode(value));
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, 'users', userId));
  return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
}

export async function syncSignedInUserProfile(user: User): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  const existingSnapshot = await getDoc(userRef);
  const existingProfile = existingSnapshot.exists() ? (existingSnapshot.data() as Partial<UserProfile>) : null;

  await setDoc(
    userRef,
    {
      uid: user.uid,
      email: user.email ?? existingProfile?.email ?? '',
      displayName: user.displayName ?? existingProfile?.displayName ?? user.uid,
      photoURL: user.photoURL ?? existingProfile?.photoURL ?? '',
      isPundit: existingProfile?.isPundit ?? false,
      createdAt: existingProfile?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastSignInAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveUserProfileAttributes(
  userId: string,
  input: SaveUserProfileInput,
): Promise<void> {
  const normalizedCountryCode = input.countryCode != null
    ? normalizeCountryCode(input.countryCode)
    : '';

  if (normalizedCountryCode !== '' && !isValidCountryCode(normalizedCountryCode)) {
    throw new Error('Country code must be exactly two letters');
  }

  await setDoc(
    doc(db, 'users', userId),
    {
      updatedAt: serverTimestamp(),
      countryCode: normalizedCountryCode === '' ? deleteField() : normalizedCountryCode,
      hemisphere: input.hemisphere ?? deleteField(),
    },
    { merge: true },
  );
}

export async function setUserPunditStatus(input: SetUserPunditStatusData): Promise<SetUserPunditStatusResult> {
  const fn = httpsCallable<SetUserPunditStatusData, SetUserPunditStatusResult>(functions, 'setUserPunditStatus');
  const response = await fn(input);
  return response.data;
}

export async function backfillUserTournamentStatsProfiles(
  input: BackfillUserTournamentStatsProfilesData = {},
): Promise<BackfillUserTournamentStatsProfilesResult> {
  const fn = httpsCallable<
    BackfillUserTournamentStatsProfilesData,
    BackfillUserTournamentStatsProfilesResult
  >(functions, 'backfillUserTournamentStatsProfiles');
  const response = await fn(input);
  return response.data;
}
