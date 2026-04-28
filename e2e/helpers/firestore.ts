/**
 * Firestore REST helpers — talk directly to the Firestore Emulator.
 * These bypass the browser entirely, so they can be used in global-setup,
 * auth-setup, beforeEach/afterEach hooks, etc.
 */

import { FIRESTORE_EMULATOR_URL, PROJECT_ID } from './constants';

const admin = require('../../functions/node_modules/firebase-admin');

const BASE = `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';

function getAdminDb() {
  const app = admin.apps.length > 0 ? admin.apps[0] : admin.initializeApp({ projectId: PROJECT_ID });
  return admin.firestore(app);
}

function deriveOutcome(homeScore: number, awayScore: number, homeTeamId: string, awayTeamId: string) {
  if (homeScore === awayScore) {
    return { actualWinner: null, actualMargin: 0 };
  }

  return {
    actualWinner: homeScore > awayScore ? homeTeamId : awayTeamId,
    actualMargin: Math.abs(homeScore - awayScore),
  };
}

function getScoringRunDocId(tournamentId: string, matchId: string): string {
  return `${tournamentId}__${matchId}`;
}


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
  seasonId: string = 'nations-championship-2026',
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
 * Also clears any universal predictions for the pool's members in that season so
 * E2E tests remain isolated now that predictions are no longer pool-scoped.
 */
export async function deletePool(poolId: string): Promise<void> {
  const pool = await firestoreGet(`pools/${poolId}`);
  const memberIds = await firestoreList(`pools/${poolId}/members`);
  const seasonId = typeof pool?.seasonId === 'string' ? pool.seasonId : null;

  if (seasonId) {
    const matchIds = await firestoreList(`seasons/${seasonId}/matches`);
    const adminDb = getAdminDb();
    await Promise.all(
      memberIds.flatMap((userId) => [
        ...matchIds.map((matchId) => adminDb.doc(`predictions/${userId}_${matchId}`).delete()),
        adminDb.doc(`user_tournament_stats/${seasonId}_${userId}`).delete(),
      ])
    );
  }

  const subcollections = ['members', 'picks_status', 'picks_detail'];
  for (const sub of subcollections) {
    const ids = await firestoreList(`pools/${poolId}/${sub}`);
    await Promise.all(ids.map((id) => firestoreDelete(`pools/${poolId}/${sub}/${id}`)));
  }
  await firestoreDelete(`pools/${poolId}`);
}

/**
 * Write a user profile document using Admin SDK so tests do not depend on
 * client security rules for users/{userId}.
 */
export async function createUserProfile(
  uid: string,
  displayName: string,
  email: string,
  photoURL: string = '',
): Promise<void> {
  const now = admin.firestore.Timestamp.now();
  await getAdminDb().doc(`users/${uid}`).set({
    uid,
    displayName,
    email,
    photoURL,
    isPundit: false,
    createdAt: now,
    updatedAt: now,
    lastSignInAt: now,
  }, { merge: true });
}

export async function getUserProfileDoc(
  userId: string,
): Promise<Record<string, unknown> | null> {
  const snapshot = await getAdminDb().doc(`users/${userId}`).get();
  return snapshot.exists ? (snapshot.data() as Record<string, unknown>) : null;
}

export async function setUserTournamentStatsDoc(
  tournamentId: string,
  userId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await getAdminDb().doc(`user_tournament_stats/${tournamentId}_${userId}`).set(data, { merge: true });
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
  const snapshot = await getAdminDb().doc(`pools/${poolId}/picks_status/${matchId}_${userId}`).get();
  return snapshot.exists ? (snapshot.data() as Record<string, unknown>) : null;
}

/**
 * Read a universal prediction document.
 */
export async function getPrediction(
  userId: string,
  matchId: string,
): Promise<Record<string, unknown> | null> {
  const snapshot = await getAdminDb().doc(`predictions/${userId}_${matchId}`).get();
  return snapshot.exists ? (snapshot.data() as Record<string, unknown>) : null;
}

/**
 * Read a user_tournament_stats document.
 */
export async function getUserTournamentStats(
  tournamentId: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const snapshot = await getAdminDb().doc(`user_tournament_stats/${tournamentId}_${userId}`).get();
  return snapshot.exists ? (snapshot.data() as Record<string, unknown>) : null;
}

/**
 * Read a top-level scoring run document for a match.
 * Falls back to the legacy matchId-only key so pre-migration docs still read in tests.
 */
export async function getScoringRun(
  tournamentId: string,
  matchId: string,
): Promise<Record<string, unknown> | null> {
  const adminDb = getAdminDb();
  const primarySnapshot = await adminDb.doc(`scoring_runs/${getScoringRunDocId(tournamentId, matchId)}`).get();
  if (primarySnapshot.exists) {
    return primarySnapshot.data() as Record<string, unknown>;
  }

  const legacySnapshot = await adminDb.doc(`scoring_runs/${matchId}`).get();
  return legacySnapshot.exists ? (legacySnapshot.data() as Record<string, unknown>) : null;
}

/**
 * Finalize a match directly in Firestore so the scoring trigger runs.
 */
export async function finalizeMatchDirectly(
  seasonId: string,
  matchId: string,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  const matchRef = getAdminDb().doc(`seasons/${seasonId}/matches/${matchId}`);
  const snapshot = await matchRef.get();
  if (!snapshot.exists) {
    throw new Error(`Match not found: ${seasonId}/${matchId}`);
  }

  const match = snapshot.data() as {
    homeTeamId: string;
    awayTeamId: string;
  };
  const outcome = deriveOutcome(homeScore, awayScore, match.homeTeamId, match.awayTeamId);

  await matchRef.set(
    {
      status: 'final',
      homeScore,
      awayScore,
      actualWinner: outcome.actualWinner,
      actualMargin: outcome.actualMargin,
      updatedAt: new Date(),
    },
    { merge: true },
  );
}


/**
 * Seed a future-dated test season so pick writes succeed in tests.
 *
 * Security rules require kickoffAt > request.time for picks writes.
 * Nations Championship 2026 fixtures may be in the past so tests that save
 * picks must use this season instead of 'nations-championship-2026'.
 *
 * Seasons have open rules (allow read, write: if true) so no auth needed.
 */
export async function seedTestSeason(seasonId: string = 'nations-championship-test'): Promise<void> {
  await firestoreSet(`seasons/${seasonId}`, {
    name: 'Nations Championship Test (Future)',
    startsAt: new Date('2099-07-01T00:00:00Z'),
    endsAt: new Date('2099-11-30T23:59:59Z'),
    leaderboardConfig: {
      enableOverall: true,
      enableCountry: true,
      enableHemisphere: true,
      enablePundit: true,
    },
    countryHemisphereOverrides: {
      JP: 'south',
    },
  });

  const fixtures = [
    // Round 1
    { round: 1, home: 'JPN', away: 'ITA', kickoffAt: new Date('2099-07-05T05:00:00Z') },
    { round: 1, home: 'NZL', away: 'FRA', kickoffAt: new Date('2099-07-05T07:10:00Z') },
    { round: 1, home: 'AUS', away: 'IRE', kickoffAt: new Date('2099-07-05T10:00:00Z') },
    { round: 1, home: 'FIJ', away: 'WAL', kickoffAt: new Date('2099-07-05T13:10:00Z') },
    { round: 1, home: 'RSA', away: 'ENG', kickoffAt: new Date('2099-07-05T15:40:00Z') },
    { round: 1, home: 'ARG', away: 'SCO', kickoffAt: new Date('2099-07-05T19:00:00Z') },
    // Round 2
    { round: 2, home: 'JPN', away: 'IRE', kickoffAt: new Date('2099-07-12T04:00:00Z') },
    { round: 2, home: 'NZL', away: 'ITA', kickoffAt: new Date('2099-07-12T05:10:00Z') },
    { round: 2, home: 'AUS', away: 'FRA', kickoffAt: new Date('2099-07-12T07:30:00Z') },
    { round: 2, home: 'FIJ', away: 'ENG', kickoffAt: new Date('2099-07-12T13:10:00Z') },
    { round: 2, home: 'RSA', away: 'SCO', kickoffAt: new Date('2099-07-12T15:40:00Z') },
    { round: 2, home: 'ARG', away: 'WAL', kickoffAt: new Date('2099-07-12T19:00:00Z') },
    // Round 3
    { round: 3, home: 'JPN', away: 'FRA', kickoffAt: new Date('2099-07-19T05:00:00Z') },
    { round: 3, home: 'NZL', away: 'IRE', kickoffAt: new Date('2099-07-19T07:10:00Z') },
    { round: 3, home: 'AUS', away: 'ITA', kickoffAt: new Date('2099-07-19T09:45:00Z') },
    { round: 3, home: 'FIJ', away: 'SCO', kickoffAt: new Date('2099-07-19T13:10:00Z') },
    { round: 3, home: 'RSA', away: 'WAL', kickoffAt: new Date('2099-07-19T15:40:00Z') },
    { round: 3, home: 'ARG', away: 'ENG', kickoffAt: new Date('2099-07-19T19:00:00Z') },
    // Round 4
    { round: 4, home: 'IRE', away: 'ARG', kickoffAt: new Date('2099-11-07T20:10:00Z') },
    { round: 4, home: 'ITA', away: 'RSA', kickoffAt: new Date('2099-11-08T14:10:00Z') },
    { round: 4, home: 'SCO', away: 'NZL', kickoffAt: new Date('2099-11-08T14:10:00Z') },
    { round: 4, home: 'WAL', away: 'JPN', kickoffAt: new Date('2099-11-08T16:40:00Z') },
    { round: 4, home: 'FRA', away: 'FIJ', kickoffAt: new Date('2099-11-08T20:10:00Z') },
    { round: 4, home: 'ENG', away: 'AUS', kickoffAt: new Date('2099-11-09T15:10:00Z') },
    // Round 5
    { round: 5, home: 'FRA', away: 'RSA', kickoffAt: new Date('2099-11-14T20:10:00Z') },
    { round: 5, home: 'ITA', away: 'ARG', kickoffAt: new Date('2099-11-15T14:10:00Z') },
    { round: 5, home: 'IRE', away: 'FIJ', kickoffAt: new Date('2099-11-15T14:10:00Z') },
    { round: 5, home: 'WAL', away: 'NZL', kickoffAt: new Date('2099-11-15T16:40:00Z') },
    { round: 5, home: 'ENG', away: 'JPN', kickoffAt: new Date('2099-11-15T16:40:00Z') },
    { round: 5, home: 'SCO', away: 'AUS', kickoffAt: new Date('2099-11-16T15:10:00Z') },
    // Round 6
    { round: 6, home: 'ITA', away: 'FIJ', kickoffAt: new Date('2099-11-22T14:10:00Z') },
    { round: 6, home: 'SCO', away: 'JPN', kickoffAt: new Date('2099-11-22T14:10:00Z') },
    { round: 6, home: 'ENG', away: 'NZL', kickoffAt: new Date('2099-11-22T14:10:00Z') },
    { round: 6, home: 'IRE', away: 'RSA', kickoffAt: new Date('2099-11-22T16:40:00Z') },
    { round: 6, home: 'FRA', away: 'ARG', kickoffAt: new Date('2099-11-22T20:10:00Z') },
    { round: 6, home: 'WAL', away: 'AUS', kickoffAt: new Date('2099-11-22T20:10:00Z') },
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
