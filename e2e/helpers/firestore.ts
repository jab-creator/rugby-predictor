/**
 * Firestore REST helpers — talk directly to the Firestore Emulator.
 * These bypass the browser entirely, so they can be used in global-setup,
 * auth-setup, beforeEach/afterEach hooks, etc.
 */

import { FIRESTORE_EMULATOR_URL, PROJECT_ID } from './constants';

const BASE = `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

/** Convert a plain JS object → Firestore REST "fields" format */
function toFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        fields[key] = { integerValue: String(val) };
      } else {
        fields[key] = { doubleValue: val };
      }
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (val instanceof Date) {
      fields[key] = { timestampValue: val.toISOString() };
    } else if (typeof val === 'object') {
      fields[key] = { mapValue: { fields: toFields(val as Record<string, unknown>) } };
    }
  }
  return fields;
}

/** Convert Firestore REST fields → plain JS object */
function fromFields(fields: Record<string, unknown>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(fields)) {
    const v = val as Record<string, unknown>;
    if ('stringValue' in v) obj[key] = v.stringValue;
    else if ('integerValue' in v) obj[key] = Number(v.integerValue);
    else if ('doubleValue' in v) obj[key] = v.doubleValue;
    else if ('booleanValue' in v) obj[key] = v.booleanValue;
    else if ('nullValue' in v) obj[key] = null;
    else if ('timestampValue' in v) obj[key] = v.timestampValue;
    else if ('mapValue' in v)
      obj[key] = fromFields((v.mapValue as { fields: Record<string, unknown> }).fields ?? {});
    else obj[key] = v;
  }
  return obj;
}

async function firestoreGet(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE}/${path}`);
  if (res.status === 404) return null;
  const data = (await res.json()) as { fields?: Record<string, unknown> };
  return data.fields ? fromFields(data.fields) : null;
}

async function firestoreSet(path: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore set ${path} failed: ${err}`);
  }
}

async function firestoreDelete(path: string): Promise<void> {
  await fetch(`${BASE}/${path}`, { method: 'DELETE' });
}

async function firestoreList(collectionPath: string): Promise<string[]> {
  const res = await fetch(`${BASE}/${collectionPath}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { documents?: { name: string }[] };
  return (data.documents ?? []).map((d) => {
    const parts = d.name.split('/');
    return parts[parts.length - 1];
  });
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

/** Nuke all Firestore data in the emulator — call in globalSetup only */
export async function clearFirestore(): Promise<void> {
  const url = `${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    console.warn('clearFirestore: unexpected status', res.status);
  }
}

/** Generate a random alphanumeric join code (excludes I, O, 0, 1 like the app does) */
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export interface TestPool {
  poolId: string;
  joinCode: string;
}

/**
 * Create a pool directly in Firestore.
 * Mirrors the shape written by `createPool()` in src/lib/pools.ts.
 */
export async function createTestPool(
  creatorUid: string,
  displayName: string,
  poolName: string = 'E2E Test Pool',
  seasonId: string = 'six-nations-2026',
): Promise<TestPool> {
  const poolId = `e2e-pool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const joinCode = generateJoinCode();
  const now = new Date().toISOString();

  await firestoreSet(`pools/${poolId}`, {
    seasonId,
    name: poolName,
    joinCode,
    createdBy: creatorUid,
    createdAt: now,
    membersCount: 1,
    scoringVersion: 1,
    maxMargin: 50,
  });

  // Add creator as member
  await firestoreSet(`pools/${poolId}/members/${creatorUid}`, {
    displayName,
    photoURL: '',
    joinedAt: now,
  });

  return { poolId, joinCode };
}

/**
 * Add a member to an existing pool directly in Firestore.
 */
export async function addPoolMember(
  poolId: string,
  userId: string,
  displayName: string,
): Promise<void> {
  const now = new Date().toISOString();
  await firestoreSet(`pools/${poolId}/members/${userId}`, {
    displayName,
    photoURL: '',
    joinedAt: now,
  });
  // Update membersCount
  const pool = await firestoreGet(`pools/${poolId}`);
  if (pool) {
    const current = typeof pool.membersCount === 'number' ? pool.membersCount : 1;
    await firestoreSet(`pools/${poolId}`, { ...pool, membersCount: current + 1 });
  }
}

/**
 * Delete a pool and all its subcollections.
 */
export async function deletePool(poolId: string): Promise<void> {
  const subcollections = ['members', 'picks_status', 'picks_detail'];
  for (const sub of subcollections) {
    const ids = await firestoreList(`pools/${poolId}/${sub}`);
    await Promise.all(ids.map((id) => firestoreDelete(`pools/${poolId}/${sub}/${id}`)));
  }
  await firestoreDelete(`pools/${poolId}`);
}

/**
 * Write a user profile document — mirrors what AuthContext.signInWithGoogle does.
 */
export async function createUserProfile(
  uid: string,
  displayName: string,
  email: string,
  photoURL: string = '',
): Promise<void> {
  await firestoreSet(`users/${uid}`, {
    displayName,
    email,
    photoURL,
    lastSignInAt: new Date().toISOString(),
  });
}

/**
 * Write a pick_status document directly.
 * NOTE: security rules require request.auth — this only works when called from
 * an admin context or when the emulator rules allow unauthenticated writes.
 * For tests that need this, prefer making picks via the browser UI instead.
 */
export async function createPickStatus(
  poolId: string,
  matchId: string,
  userId: string,
  isComplete: boolean,
  kickoffAt: Date = new Date('2099-01-05T15:00:00Z'),
): Promise<void> {
  const docId = `${matchId}_${userId}`;
  await firestoreSet(`pools/${poolId}/picks_status/${docId}`, {
    matchId,
    userId,
    isComplete,
    lockedAt: null,
    finalizedAt: null,
    kickoffAt,
    updatedAt: new Date(),
  });
}

/**
 * Read a picks_status document (reads are open — no auth required).
 */
export async function getPickStatus(
  poolId: string,
  matchId: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  return firestoreGet(`pools/${poolId}/picks_status/${matchId}_${userId}`);
}

/**
 * Seed a future-dated test season so pick writes succeed in tests.
 *
 * Security rules require kickoffAt > request.time for picks writes.
 * Six Nations 2026 fixtures are in the past so tests that save picks must
 * use this season instead of 'six-nations-2026'.
 *
 * Seasons have open rules (allow read, write: if true) so no auth needed.
 */
export async function seedTestSeason(seasonId: string = 'six-nations-test'): Promise<void> {
  await firestoreSet(`seasons/${seasonId}`, {
    name: 'Six Nations Test (Future)',
    startsAt: new Date('2099-01-01T00:00:00Z'),
    endsAt: new Date('2099-03-31T23:59:59Z'),
  });

  const fixtures = [
    // Round 1
    { round: 1, home: 'FRA', away: 'IRE', kickoffAt: new Date('2099-01-05T15:00:00Z') },
    { round: 1, home: 'ITA', away: 'SCO', kickoffAt: new Date('2099-01-05T16:30:00Z') },
    { round: 1, home: 'ENG', away: 'WAL', kickoffAt: new Date('2099-01-05T18:00:00Z') },
    // Round 2
    { round: 2, home: 'SCO', away: 'WAL', kickoffAt: new Date('2099-01-12T15:00:00Z') },
    { round: 2, home: 'IRE', away: 'ITA', kickoffAt: new Date('2099-01-12T16:30:00Z') },
    { round: 2, home: 'FRA', away: 'ENG', kickoffAt: new Date('2099-01-12T18:00:00Z') },
    // Round 3
    { round: 3, home: 'WAL', away: 'ENG', kickoffAt: new Date('2099-01-19T15:00:00Z') },
    { round: 3, home: 'ITA', away: 'FRA', kickoffAt: new Date('2099-01-19T16:30:00Z') },
    { round: 3, home: 'SCO', away: 'IRE', kickoffAt: new Date('2099-01-19T18:00:00Z') },
    // Round 4
    { round: 4, home: 'IRE', away: 'WAL', kickoffAt: new Date('2099-01-26T15:00:00Z') },
    { round: 4, home: 'ENG', away: 'SCO', kickoffAt: new Date('2099-01-26T16:30:00Z') },
    { round: 4, home: 'FRA', away: 'ITA', kickoffAt: new Date('2099-01-26T18:00:00Z') },
    // Round 5
    { round: 5, home: 'WAL', away: 'FRA', kickoffAt: new Date('2099-02-02T15:00:00Z') },
    { round: 5, home: 'SCO', away: 'ENG', kickoffAt: new Date('2099-02-02T16:30:00Z') },
    { round: 5, home: 'ITA', away: 'IRE', kickoffAt: new Date('2099-02-02T18:00:00Z') },
  ];

  for (const f of fixtures) {
    const matchId = `${seasonId}-r${f.round}-${f.home}-${f.away}`;
    await firestoreSet(`seasons/${seasonId}/matches/${matchId}`, {
      round: f.round,
      kickoffAt: f.kickoffAt,
      homeTeamId: f.home,
      awayTeamId: f.away,
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      updatedAt: new Date(),
    });
  }
}
