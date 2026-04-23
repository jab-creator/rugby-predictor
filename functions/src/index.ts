import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

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

async function getPoolIdsForSeason(seasonId: string): Promise<string[]> {
  const snap = await db.collection('pools').where('seasonId', '==', seasonId).get();
  return snap.docs.map((docSnap) => docSnap.id);
}

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

/**
 * Lock all complete, unlocked universal predictions for a given match.
 * Legacy pool status docs are mirrored for UI compatibility during migration.
 */
async function lockPicksForMatch(
  seasonId: string,
  matchId: string,
  poolIds: string[],
  kickoffAt: admin.firestore.Timestamp,
  now: admin.firestore.Timestamp
): Promise<{ locked: number }> {
  const writes: BatchWrite[] = [];
  const lockedPredictionIds = new Set<string>();

  const unlockedPredictionsSnap = await db
    .collection('predictions')
    .where('matchId', '==', matchId)
    .where('isComplete', '==', true)
    .where('isLocked', '==', false)
    .get();

  unlockedPredictionsSnap.docs.forEach((predictionDoc) => {
    lockedPredictionIds.add(predictionDoc.id);
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

  return { lockedAt: (lockedAtToReturn ?? now).toDate().toISOString() };
});

// ---------- onMatchWrite: schedule a Cloud Task for kickoff ----------

export const onMatchWrite = functions.firestore
  .document('seasons/{seasonId}/matches/{matchId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return;

    const { seasonId, matchId } = context.params;
    const data = change.after.data()!;
    const kickoffAt = data.kickoffAt as admin.firestore.Timestamp;
    const now = Timestamp.now();

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
  const poolIds = await getPoolIdsForSeason(seasonId);
  const { locked } = await lockPicksForMatch(seasonId, matchId, poolIds, kickoffAt, now);

  functions.logger.info(`autoLockMatch: locked ${locked} predictions for match ${matchId}`);
  res.json({ ok: true, locked });
});

export const health = functions.https.onRequest((_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});
