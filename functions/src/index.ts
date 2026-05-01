import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  deriveMatchOutcome,
  getLegacyScoringRunDocId,
  getScoringRunDocId,
  scoreFinalizedMatch,
  syncUserProfileToTournamentStats,
  upsertLastLockedPredictionAt,
  type MatchScoringDoc,
  type UserProfileDoc,
} from './scoring-engine';

admin.initializeApp();
const db = admin.firestore();

const getPredictionDocId = (userId: string, matchId: string): string => `${userId}_${matchId}`;
const getLegacyPickDocId = (matchId: string, userId: string): string => `${matchId}_${userId}`;

interface LegacyStatus {
  matchId: string;
  userId: string;
  isComplete: boolean;
  lockedAt: admin.firestore.Timestamp | null;
  updatedAt?: admin.firestore.Timestamp;
  kickoffAt?: admin.firestore.Timestamp;
}

interface LegacyDetail {
  pickedWinnerTeamId: string | null;
  pickedMargin: number | null;
  updatedAt?: admin.firestore.Timestamp;
}

interface PredictionDoc {
  userId: string;
  matchId: string;
  tournamentId: string;
  winner: string | null;
  margin: number | null;
  kickoffAt: admin.firestore.Timestamp;
  isComplete: boolean;
  isLocked: boolean;
  lockedAt: admin.firestore.Timestamp | null;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

type BatchWrite =
  | {
      type: 'set';
      ref: admin.firestore.DocumentReference;
      data: admin.firestore.DocumentData;
      merge?: boolean;
    }
  | {
      type: 'update';
      ref: admin.firestore.DocumentReference;
      data: admin.firestore.UpdateData<admin.firestore.DocumentData>;
    };

function buildPredictionFromLegacy(params: {
  userId: string;
  matchId: string;
  tournamentId: string;
  kickoffAt: admin.firestore.Timestamp;
  legacyStatus: LegacyStatus;
  legacyDetail: LegacyDetail;
  lockedAt: admin.firestore.Timestamp | null;
  createdAt?: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}): PredictionDoc {
  const {
    userId,
    matchId,
    tournamentId,
    kickoffAt,
    legacyStatus,
    legacyDetail,
    lockedAt,
    createdAt,
    updatedAt,
  } = params;

  return {
    userId,
    matchId,
    tournamentId,
    winner: legacyDetail.pickedWinnerTeamId,
    margin: legacyDetail.pickedMargin,
    kickoffAt: legacyStatus.kickoffAt ?? kickoffAt,
    isComplete: legacyStatus.isComplete,
    isLocked: lockedAt !== null,
    lockedAt,
    createdAt: createdAt ?? legacyDetail.updatedAt ?? legacyStatus.updatedAt ?? updatedAt,
    updatedAt,
  };
}

async function commitBatchWrites(writes: BatchWrite[]): Promise<void> {
  const BATCH_SIZE = 500;

  for (let index = 0; index < writes.length; index += BATCH_SIZE) {
    const batch = db.batch();

    writes.slice(index, index + BATCH_SIZE).forEach((write) => {
      if (write.type === 'set') {
        if (write.merge) {
          batch.set(write.ref, write.data, { merge: true });
        } else {
          batch.set(write.ref, write.data);
        }
        return;
      }

      batch.update(write.ref, write.data);
    });

    await batch.commit();
  }
}

function parseConfiguredValues(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

function getConfiguredAdminUids(): Set<string> {
  return parseConfiguredValues(process.env.ADMIN_UIDS);
}

function getConfiguredAdminEmails(): Set<string> {
  const emails = parseConfiguredValues(process.env.ADMIN_EMAILS);

  if (emails.size === 0 && process.env.FUNCTIONS_EMULATOR === 'true') {
    emails.add('playwright-test@example.com');
  }

  return new Set(Array.from(emails).map((email) => email.toLowerCase()));
}

function isAdminCaller(context: functions.https.CallableContext): boolean {
  const uid = context.auth?.uid;
  const email = typeof context.auth?.token.email === 'string'
    ? context.auth.token.email.toLowerCase()
    : null;

  return context.auth?.token.admin === true ||
    (uid != null && getConfiguredAdminUids().has(uid)) ||
    (email != null && getConfiguredAdminEmails().has(email));
}

function assertAdminCaller(context: functions.https.CallableContext): void {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  if (!isAdminCaller(context)) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }
}

function relevantUserProfileFields(profile: UserProfileDoc | null | undefined) {
  return {
    displayName: profile?.displayName ?? null,
    photoURL: profile?.photoURL ?? null,
    countryCode: profile?.countryCode ?? null,
    isPundit: profile?.isPundit ?? false,
  };
}

async function resolveTargetUser(params: { userId?: string; email?: string }) {
  const trimmedUserId = params.userId?.trim();
  const trimmedEmail = params.email?.trim().toLowerCase();

  if (!trimmedUserId && !trimmedEmail) {
    throw new functions.https.HttpsError('invalid-argument', 'Provide a target userId or email');
  }

  if (trimmedUserId) {
    const profile = await loadUserProfile(trimmedUserId);
    if (profile) {
      return {
        userId: trimmedUserId,
        email: typeof profile.email === 'string' ? profile.email : null,
        displayName: profile.displayName ?? trimmedUserId,
        photoURL: profile.photoURL ?? null,
      };
    }

    const userRecord = await admin.auth().getUser(trimmedUserId);
    return {
      userId: userRecord.uid,
      email: userRecord.email ?? null,
      displayName: userRecord.displayName ?? userRecord.uid,
      photoURL: userRecord.photoURL ?? null,
    };
  }

  const userSnapshot = await db.collection('users').where('email', '==', trimmedEmail).limit(1).get();
  if (!userSnapshot.empty) {
    const profile = userSnapshot.docs[0].data() as UserProfileDoc;
    return {
      userId: userSnapshot.docs[0].id,
      email: typeof profile.email === 'string' ? profile.email : trimmedEmail ?? null,
      displayName: profile.displayName ?? userSnapshot.docs[0].id,
      photoURL: profile.photoURL ?? null,
    };
  }

  const userRecord = await admin.auth().getUserByEmail(trimmedEmail as string);
  return {
    userId: userRecord.uid,
    email: userRecord.email ?? trimmedEmail ?? null,
    displayName: userRecord.displayName ?? userRecord.uid,
    photoURL: userRecord.photoURL ?? null,
  };
}

async function loadUserProfile(userId: string): Promise<UserProfileDoc | null> {
  const snapshot = await db.collection('users').doc(userId).get();
  return snapshot.exists ? (snapshot.data() as UserProfileDoc) : null;
}

/**
 * Lock all complete, unlocked universal predictions for a given match.
 * Legacy pool status docs are mirrored for UI compatibility during migration.
 */
async function lockPicksForMatch(
  seasonId: string,
  matchId: string,
  kickoffAt: admin.firestore.Timestamp,
  now: admin.firestore.Timestamp
): Promise<{ locked: number }> {
  const writes: BatchWrite[] = [];
  const lockedPredictionIds = new Set<string>();
  const lockedUserIds = new Set<string>();

  const unlockedPredictionsSnap = await db
    .collection('predictions')
    .where('matchId', '==', matchId)
    .where('isComplete', '==', true)
    .where('isLocked', '==', false)
    .get();

  unlockedPredictionsSnap.docs.forEach((predictionDoc) => {
    const prediction = predictionDoc.data() as PredictionDoc;
    lockedPredictionIds.add(predictionDoc.id);
    lockedUserIds.add(prediction.userId);
    writes.push({
      type: 'set',
      ref: predictionDoc.ref,
      data: {
        isLocked: true,
        lockedAt: now,
        updatedAt: now,
      },
      merge: true,
    });
  });

  const statusSnap = await db
    .collectionGroup('picks_status')
    .where('matchId', '==', matchId)
    .where('isComplete', '==', true)
    .where('lockedAt', '==', null)
    .get();

  for (const statusDoc of statusSnap.docs) {
    const legacyStatus = statusDoc.data() as LegacyStatus;
    const predictionId = getPredictionDocId(legacyStatus.userId, matchId);
    const predictionRef = db.collection('predictions').doc(predictionId);
    const poolRef = statusDoc.ref.parent.parent;

    if (!poolRef) {
      continue;
    }

    if (!lockedPredictionIds.has(predictionId)) {
      const predictionSnap = await predictionRef.get();

      if (predictionSnap.exists) {
        const prediction = predictionSnap.data() as Partial<PredictionDoc>;

        if (prediction.lockedAt != null || prediction.isLocked === true) {
          writes.push({
            type: 'update',
            ref: statusDoc.ref,
            data: { lockedAt: prediction.lockedAt ?? now },
          });
          continue;
        }

        if (prediction.isComplete === true) {
          lockedPredictionIds.add(predictionId);
          lockedUserIds.add(legacyStatus.userId);
          writes.push({
            type: 'set',
            ref: predictionRef,
            data: {
              isLocked: true,
              lockedAt: now,
              updatedAt: now,
            },
            merge: true,
          });
        }
      } else {
        const legacyDetailRef = poolRef
          .collection('picks_detail')
          .doc(getLegacyPickDocId(matchId, legacyStatus.userId));
        const legacyDetailSnap = await legacyDetailRef.get();

        if (legacyDetailSnap.exists) {
          const legacyDetail = legacyDetailSnap.data() as LegacyDetail;

          if (legacyDetail.pickedWinnerTeamId != null && legacyDetail.pickedMargin != null) {
            lockedPredictionIds.add(predictionId);
            lockedUserIds.add(legacyStatus.userId);
            writes.push({
              type: 'set',
              ref: predictionRef,
              data: buildPredictionFromLegacy({
                userId: legacyStatus.userId,
                matchId,
                tournamentId: seasonId,
                kickoffAt,
                legacyStatus,
                legacyDetail,
                lockedAt: now,
                updatedAt: now,
              }),
            });
          }
        }
      }
    }

    writes.push({
      type: 'update',
      ref: statusDoc.ref,
      data: { lockedAt: now },
    });
  }

  await commitBatchWrites(writes);
  await Promise.all(
    [...lockedUserIds].map((userId) =>
      upsertLastLockedPredictionAt({
        db,
        tournamentId: seasonId,
        userId,
        lockedAt: now,
      })
    )
  );

  return { locked: lockedPredictionIds.size };
}

// ---------- lockPick: user-initiated callable ----------

export const lockPick = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userId = context.auth.uid;
  const { poolId, matchId } = data as { poolId: string; matchId: string };

  if (!poolId || !matchId) {
    throw new functions.https.HttpsError('invalid-argument', 'poolId and matchId required');
  }

  const memberSnap = await db
    .collection('pools').doc(poolId)
    .collection('members').doc(userId)
    .get();
  if (!memberSnap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Not a pool member');
  }

  const poolSnap = await db.collection('pools').doc(poolId).get();
  if (!poolSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Pool not found');
  }
  const { seasonId } = poolSnap.data() as { seasonId: string };

  const matchRef = db.collection('seasons').doc(seasonId).collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Match not found');
  }

  const now = Timestamp.now();
  const kickoffAt = matchSnap.data()!.kickoffAt as admin.firestore.Timestamp;

  if (kickoffAt.toMillis() <= now.toMillis()) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Match has already kicked off'
    );
  }

  const predictionRef = db.collection('predictions').doc(getPredictionDocId(userId, matchId));
  const legacyDocId = getLegacyPickDocId(matchId, userId);
  const legacyStatusRef = db
    .collection('pools').doc(poolId)
    .collection('picks_status').doc(legacyDocId);
  const legacyDetailRef = db
    .collection('pools').doc(poolId)
    .collection('picks_detail').doc(legacyDocId);

  let lockedAtToReturn: admin.firestore.Timestamp | null = null;

  await db.runTransaction(async (tx) => {
    const predictionSnap = await tx.get(predictionRef);
    const legacyStatusSnap = await tx.get(legacyStatusRef);
    const legacyDetailSnap = await tx.get(legacyDetailRef);

    const prediction = predictionSnap.exists
      ? predictionSnap.data() as Partial<PredictionDoc>
      : null;
    const legacyStatus = legacyStatusSnap.exists
      ? legacyStatusSnap.data() as LegacyStatus
      : null;
    const legacyDetail = legacyDetailSnap.exists
      ? legacyDetailSnap.data() as LegacyDetail
      : null;

    if (prediction?.lockedAt != null || prediction?.isLocked === true) {
      lockedAtToReturn = prediction.lockedAt ?? legacyStatus?.lockedAt ?? now;

      if (legacyStatusSnap.exists && legacyStatus?.lockedAt == null && lockedAtToReturn != null) {
        tx.update(legacyStatusRef, { lockedAt: lockedAtToReturn });
      }
      return;
    }

    if (prediction?.isComplete === true) {
      tx.set(predictionRef, {
        isLocked: true,
        lockedAt: now,
        updatedAt: now,
      }, { merge: true });

      if (legacyStatusSnap.exists) {
        tx.set(legacyStatusRef, { lockedAt: now }, { merge: true });
      }

      lockedAtToReturn = now;
      return;
    }

    const legacyPickIsComplete =
      legacyStatus?.isComplete === true &&
      legacyDetail?.pickedWinnerTeamId != null &&
      legacyDetail?.pickedMargin != null;

    if (legacyStatus?.lockedAt != null) {
      if (!legacyPickIsComplete) {
        throw new functions.https.HttpsError('failed-precondition', 'Pick is not complete');
      }

      lockedAtToReturn = legacyStatus.lockedAt;
      tx.set(
        predictionRef,
        buildPredictionFromLegacy({
          userId,
          matchId,
          tournamentId: seasonId,
          kickoffAt,
          legacyStatus,
          legacyDetail: legacyDetail as LegacyDetail,
          lockedAt: legacyStatus.lockedAt,
          createdAt: prediction?.createdAt,
          updatedAt: legacyStatus.lockedAt,
        }),
        { merge: true }
      );
      return;
    }

    if (legacyPickIsComplete) {
      tx.set(
        predictionRef,
        buildPredictionFromLegacy({
          userId,
          matchId,
          tournamentId: seasonId,
          kickoffAt,
          legacyStatus: legacyStatus as LegacyStatus,
          legacyDetail: legacyDetail as LegacyDetail,
          lockedAt: now,
          createdAt: prediction?.createdAt,
          updatedAt: now,
        }),
        { merge: true }
      );
      tx.update(legacyStatusRef, { lockedAt: now });
      lockedAtToReturn = now;
      return;
    }

    if (predictionSnap.exists || legacyStatusSnap.exists || legacyDetailSnap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Pick is not complete');
    }

    throw new functions.https.HttpsError('not-found', 'No pick found for this match');
  });

  const lockedAt = lockedAtToReturn ?? now;

  try {
    await upsertLastLockedPredictionAt({
      db,
      tournamentId: seasonId,
      userId,
      lockedAt,
    });
  } catch (error) {
    functions.logger.error('lockPick: failed to upsert lastLockedPredictionAt', {
      poolId,
      seasonId,
      matchId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { lockedAt: lockedAt.toDate().toISOString() };
});


// ---------- onUserProfileWrite: sync denormalized tournament stats ----------

export const onUserProfileWrite = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) {
      return;
    }

    const before = change.before.exists ? (change.before.data() as UserProfileDoc) : null;
    const after = change.after.data() as UserProfileDoc;

    if (
      JSON.stringify(relevantUserProfileFields(before)) ===
      JSON.stringify(relevantUserProfileFields(after))
    ) {
      return;
    }

    await syncUserProfileToTournamentStats({
      db,
      userId: context.params.userId,
      profile: after,
      now: after.updatedAt ?? Timestamp.now(),
    });
  });

// ---------- setUserPunditStatus: minimal admin-only pundit flag path ----------

export const setUserPunditStatus = functions.https.onCall(async (data, context) => {
  assertAdminCaller(context);

  const { userId, email, isPundit } = data as {
    userId?: string;
    email?: string;
    isPundit?: boolean;
  };

  if (typeof isPundit !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'isPundit must be a boolean');
  }

  const target = await resolveTargetUser({ userId, email });
  const existingProfile = await loadUserProfile(target.userId);
  const now = Timestamp.now();

  const nextProfile: UserProfileDoc = {
    uid: target.userId,
    ...(target.email ? { email: target.email } : existingProfile?.email ? { email: existingProfile.email } : {}),
    displayName: existingProfile?.displayName ?? target.displayName,
    ...(existingProfile?.photoURL != null
      ? { photoURL: existingProfile.photoURL }
      : target.photoURL != null
        ? { photoURL: target.photoURL }
        : {}),
    ...(existingProfile?.countryCode != null ? { countryCode: existingProfile.countryCode } : {}),
    ...(existingProfile?.hemisphere != null ? { hemisphere: existingProfile.hemisphere } : {}),
    isPundit,
    createdAt: existingProfile?.createdAt ?? now,
    updatedAt: now,
    ...(existingProfile?.lastSignInAt != null ? { lastSignInAt: existingProfile.lastSignInAt } : {}),
  };

  await db.collection('users').doc(target.userId).set(nextProfile, { merge: true });
  const syncedStats = await syncUserProfileToTournamentStats({
    db,
    userId: target.userId,
    profile: nextProfile,
    now,
  });

  return {
    userId: target.userId,
    email: target.email,
    displayName: nextProfile.displayName ?? target.displayName,
    isPundit,
    syncedStats,
  };
});

// ---------- backfillUserTournamentStatsProfiles: admin profile denormalization backfill ----------

export const backfillUserTournamentStatsProfiles = functions.https.onCall(async (data, context) => {
  assertAdminCaller(context);

  const { userId, email } = (data ?? {}) as {
    userId?: string;
    email?: string;
  };
  const now = Timestamp.now();

  if (userId || email) {
    const target = await resolveTargetUser({ userId, email });
    const profile = await loadUserProfile(target.userId);

    if (!profile) {
      return { syncedUsers: 0, syncedStats: 0 };
    }

    return {
      syncedUsers: 1,
      syncedStats: await syncUserProfileToTournamentStats({
        db,
        userId: target.userId,
        profile,
        now,
      }),
    };
  }

  const statsSnapshot = await db.collection('user_tournament_stats').get();
  const userIds = [...new Set(
    statsSnapshot.docs
      .map((doc) => (doc.data() as { userId?: string }).userId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  )];

  let syncedUsers = 0;
  let syncedStats = 0;

  for (const targetUserId of userIds) {
    const profile = await loadUserProfile(targetUserId);
    if (!profile) {
      continue;
    }

    syncedUsers += 1;
    syncedStats += await syncUserProfileToTournamentStats({
      db,
      userId: targetUserId,
      profile,
      now,
    });
  }

  return { syncedUsers, syncedStats };
});

// ---------- finalizeMatch: callable admin/dev result entry ----------

export const finalizeMatch = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { seasonId, matchId, homeScore, awayScore } = data as {
    seasonId?: string;
    matchId?: string;
    homeScore?: number;
    awayScore?: number;
  };

  if (!seasonId || !matchId) {
    throw new functions.https.HttpsError('invalid-argument', 'seasonId and matchId required');
  }

  if (
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    (homeScore as number) < 0 ||
    (awayScore as number) < 0
  ) {
    throw new functions.https.HttpsError('invalid-argument', 'Scores must be non-negative integers');
  }

  const matchRef = db.collection('seasons').doc(seasonId).collection('matches').doc(matchId);
  const scoringRunRef = db.collection('scoring_runs').doc(getScoringRunDocId(seasonId, matchId));
  const legacyScoringRunRef = db.collection('scoring_runs').doc(getLegacyScoringRunDocId(matchId));
  const now = Timestamp.now();

  const finalizedMatch = await db.runTransaction(async (tx) => {
    const matchSnap = await tx.get(matchRef);
    if (!matchSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Match not found');
    }

    const existingMatch = matchSnap.data() as MatchScoringDoc;
    const [existingScoringRun, existingLegacyScoringRun] = await Promise.all([
      tx.get(scoringRunRef),
      tx.get(legacyScoringRunRef),
    ]);
    const outcome = deriveMatchOutcome({
      homeTeamId: existingMatch.homeTeamId,
      awayTeamId: existingMatch.awayTeamId,
      homeScore: homeScore as number,
      awayScore: awayScore as number,
    });

    const requestedFinalMatch: MatchScoringDoc = {
      ...existingMatch,
      status: 'final',
      homeScore: homeScore as number,
      awayScore: awayScore as number,
      actualWinner: outcome.actualWinner,
      actualMargin: outcome.actualMargin,
      updatedAt: now,
    };

    const sameFinalResult =
      existingMatch.status === 'final' &&
      existingMatch.homeScore === homeScore &&
      existingMatch.awayScore === awayScore;

    if (existingScoringRun.exists || existingLegacyScoringRun.exists) {
      if (!sameFinalResult) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Match has already been scored. Correction flow is not implemented yet.'
        );
      }

      return requestedFinalMatch;
    }

    tx.set(matchRef, requestedFinalMatch, { merge: true });
    return requestedFinalMatch;
  });

  const scoringResult = await scoreFinalizedMatch({
    db,
    seasonId,
    matchId,
    match: finalizedMatch,
    now,
  });

  return {
    seasonId,
    matchId,
    homeScore,
    awayScore,
    actualWinner: finalizedMatch.actualWinner ?? null,
    actualMargin: finalizedMatch.actualMargin ?? 0,
    scored: scoringResult.scored,
    skipped: scoringResult.skipped,
  };
});

// ---------- onMatchWrite: score finalized matches and schedule kickoff auto-lock ----------

export const onMatchWrite = functions.firestore
  .document('seasons/{seasonId}/matches/{matchId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return;

    const { seasonId, matchId } = context.params;
    const data = change.after.data() as MatchScoringDoc;
    const now = Timestamp.now();

    if (data.status === 'final') {
      const scoringResult = await scoreFinalizedMatch({
        db,
        seasonId,
        matchId,
        match: data,
        now,
      });

      if (scoringResult.scored) {
        functions.logger.info(
          `Scored ${scoringResult.predictionsScored ?? 0} predictions for finalized match ${matchId}`
        );
      }
      return;
    }

    const kickoffAt = data.kickoffAt as admin.firestore.Timestamp;
    if (kickoffAt.toMillis() <= now.toMillis()) return;

    if (process.env.FUNCTIONS_EMULATOR) {
      functions.logger.info(
        `[emulator] onMatchWrite: match ${matchId} kickoff ${kickoffAt.toDate().toISOString()}. ` +
        `To test auto-lock, POST { matchId: "${matchId}", seasonId: "${seasonId}" } to autoLockMatch.`
      );
      return;
    }

    const { CloudTasksClient } = await import('@google-cloud/tasks');
    const client = new CloudTasksClient();

    const project = process.env.GCLOUD_PROJECT!;
    const location = process.env.TASKS_LOCATION ?? 'us-central1';
    const queue = 'pick-autolock';
    const parent = client.queuePath(project, location, queue);
    const taskName = client.taskPath(project, location, queue, `autolock-${matchId}`);
    const url = `https://${location}-${project}.cloudfunctions.net/autoLockMatch`;

    try {
      await client.deleteTask({ name: taskName });
    } catch {
      // Task doesn't exist yet — fine
    }

    await client.createTask({
      parent,
      task: {
        name: taskName,
        httpRequest: {
          httpMethod: 'POST' as const,
          url,
          headers: { 'Content-Type': 'application/json' },
          body: Buffer.from(JSON.stringify({ matchId, seasonId })).toString('base64'),
        },
        scheduleTime: { seconds: kickoffAt.seconds, nanos: kickoffAt.nanoseconds },
      },
    });

    functions.logger.info(
      `Scheduled autoLockMatch for match ${matchId} at ${kickoffAt.toDate().toISOString()}`
    );
  });

// ---------- autoLockMatch: Cloud Tasks HTTP target ----------

export const autoLockMatch = functions.https.onRequest(async (req, res) => {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

  if (!isEmulator && !req.headers['x-cloudtasks-queuename']) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { matchId, seasonId } = req.body as { matchId?: string; seasonId?: string };
  if (!matchId || !seasonId) {
    res.status(400).json({ error: 'matchId and seasonId required' });
    return;
  }

  const matchSnap = await db.collection('seasons').doc(seasonId).collection('matches').doc(matchId).get();
  if (!matchSnap.exists) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  const now = Timestamp.now();
  const kickoffAt = matchSnap.data()!.kickoffAt as admin.firestore.Timestamp;
  const { locked } = await lockPicksForMatch(seasonId, matchId, kickoffAt, now);

  functions.logger.info(`autoLockMatch: locked ${locked} predictions for match ${matchId}`);
  res.json({ ok: true, locked });
});

export const health = functions.https.onRequest((_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});
