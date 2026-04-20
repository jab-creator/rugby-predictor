import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// ---------- Internal shared logic ----------

async function getPoolIdsForSeason(seasonId: string): Promise<string[]> {
  const snap = await db.collection('pools').where('seasonId', '==', seasonId).get();
  return snap.docs.map(d => d.id);
}

/**
 * Lock all complete, unlocked picks for a given match across the supplied pools.
 * Incomplete picks are left untouched per spec.
 */
async function lockPicksForMatch(
  matchId: string,
  poolIds: string[],
  now: admin.firestore.Timestamp
): Promise<{ locked: number }> {
  const statusRefs: admin.firestore.DocumentReference[] = [];

  for (const poolId of poolIds) {
    const snap = await db
      .collection('pools')
      .doc(poolId)
      .collection('picks_status')
      .where('matchId', '==', matchId)
      .where('isComplete', '==', true)
      .where('lockedAt', '==', null)
      .get();
    snap.docs.forEach(d => statusRefs.push(d.ref));
  }

  // Firestore batch limit is 500 writes
  const BATCH_SIZE = 500;
  for (let i = 0; i < statusRefs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    statusRefs.slice(i, i + BATCH_SIZE).forEach(ref =>
      batch.update(ref, { lockedAt: now })
    );
    await batch.commit();
  }

  return { locked: statusRefs.length };
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

  // Verify pool membership
  const memberSnap = await db
    .collection('pools').doc(poolId)
    .collection('members').doc(userId)
    .get();
  if (!memberSnap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Not a pool member');
  }

  // Look up pool → seasonId → match → kickoffAt
  const poolSnap = await db.collection('pools').doc(poolId).get();
  if (!poolSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Pool not found');
  }
  const { seasonId } = poolSnap.data()!;

  const matchSnap = await db
    .collection('seasons').doc(seasonId)
    .collection('matches').doc(matchId)
    .get();
  if (!matchSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Match not found');
  }

  const now = admin.firestore.Timestamp.now();
  const kickoffAt: admin.firestore.Timestamp = matchSnap.data()!.kickoffAt;

  if (kickoffAt.toMillis() <= now.toMillis()) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Match has already kicked off'
    );
  }

  // Transaction: verify pick is complete + set lockedAt atomically
  const statusDocId = `${matchId}_${userId}`;
  const statusRef = db
    .collection('pools').doc(poolId)
    .collection('picks_status').doc(statusDocId);

  await db.runTransaction(async tx => {
    const statusSnap = await tx.get(statusRef);
    if (!statusSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'No pick found for this match');
    }
    const status = statusSnap.data()!;
    if (!status.isComplete) {
      throw new functions.https.HttpsError('failed-precondition', 'Pick is not complete');
    }
    if (status.lockedAt !== null) {
      return; // Already locked — idempotent
    }
    tx.update(statusRef, { lockedAt: now });
  });

  return { lockedAt: now.toDate().toISOString() };
});

// ---------- onMatchWrite: schedule a Cloud Task for kickoff ----------

export const onMatchWrite = functions.firestore
  .document('seasons/{seasonId}/matches/{matchId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return; // Document deleted

    const { seasonId, matchId } = context.params;
    const data = change.after.data()!;
    const kickoffAt: admin.firestore.Timestamp = data.kickoffAt;
    const now = admin.firestore.Timestamp.now();

    if (kickoffAt.toMillis() <= now.toMillis()) return; // Already past kickoff

    if (process.env.FUNCTIONS_EMULATOR) {
      // Cloud Tasks not available in emulator — call autoLockMatch directly to test:
      //   POST http://localhost:5001/<project>/us-central1/autoLockMatch
      //   Body: { matchId, seasonId }
      functions.logger.info(
        `[emulator] onMatchWrite: match ${matchId} kickoff ${kickoffAt.toDate().toISOString()}. ` +
        `To test auto-lock, POST { matchId: "${matchId}", seasonId: "${seasonId}" } to autoLockMatch.`
      );
      return;
    }

    // Production: enqueue / replace a Cloud Task named autolock-{matchId}
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
//
// In production: Cloud Tasks delivers this with X-CloudTasks-QueueName header.
// In emulator:   POST directly for testing — no auth required.

export const autoLockMatch = functions.https.onRequest(async (req, res) => {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

  if (!isEmulator) {
    if (!req.headers['x-cloudtasks-queuename']) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
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

  const now = admin.firestore.Timestamp.now();
  const poolIds = await getPoolIdsForSeason(seasonId);
  const { locked } = await lockPicksForMatch(matchId, poolIds, now);

  functions.logger.info(`autoLockMatch: locked ${locked} picks for match ${matchId}`);
  res.json({ ok: true, locked });
});

export const health = functions.https.onRequest((_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});
