import {
  collection,
  doc,
  writeBatch,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Prediction, TeamId, PickStatus, PickDetail } from './types';

const getPredictionDocId = (userId: string, matchId: string): string => `${userId}_${matchId}`;
const getLegacyPickDocId = (matchId: string, userId: string): string => `${matchId}_${userId}`;

function predictionToPickDetail(prediction: Prediction): PickDetail {
  return {
    matchId: prediction.matchId,
    userId: prediction.userId,
    pickedWinnerTeamId: prediction.winner,
    pickedMargin: prediction.margin,
    kickoffAt: prediction.kickoffAt,
    updatedAt: prediction.updatedAt,
    winnerCorrect: prediction.winnerCorrect,
    err: prediction.err,
    marginBonus: prediction.marginBonus,
    totalPoints: prediction.totalPoints,
  };
}

/**
 * Save a pick to the universal predictions collection.
 * Legacy pool pick docs are still mirrored for UI compatibility during migration.
 */
export async function savePick(
  poolId: string,
  matchId: string,
  userId: string,
  tournamentId: string,
  pickedWinnerTeamId: TeamId,
  pickedMargin: number,
  kickoffAt: Timestamp
): Promise<void> {
  if (pickedMargin < 1 || pickedMargin > 99) {
    throw new Error('Margin must be between 1 and 99');
  }

  const batch = writeBatch(db);

  const predictionRef = doc(db, 'predictions', getPredictionDocId(userId, matchId));
  const legacyDocId = getLegacyPickDocId(matchId, userId);
  const statusRef = doc(db, 'pools', poolId, 'picks_status', legacyDocId);
  const detailRef = doc(db, 'pools', poolId, 'picks_detail', legacyDocId);
  const predictionSnap = await getDoc(predictionRef);

  batch.set(
    predictionRef,
    {
      userId,
      matchId,
      tournamentId,
      winner: pickedWinnerTeamId,
      margin: pickedMargin,
      kickoffAt,
      isComplete: true,
      isLocked: false,
      lockedAt: null,
      ...(predictionSnap.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(statusRef, {
    matchId,
    userId,
    isComplete: true,
    lockedAt: null,
    finalizedAt: null,
    kickoffAt,
    updatedAt: serverTimestamp(),
  });

  batch.set(detailRef, {
    matchId,
    userId,
    pickedWinnerTeamId,
    pickedMargin,
    kickoffAt,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Get user's pick detail for a specific match.
 * Prefers universal predictions, with fallback to legacy pool docs during migration.
 */
export async function getUserPick(
  poolId: string,
  matchId: string,
  userId: string
): Promise<PickDetail | null> {
  const predictionRef = doc(db, 'predictions', getPredictionDocId(userId, matchId));
  const predictionSnap = await getDoc(predictionRef);

  if (predictionSnap.exists()) {
    return predictionToPickDetail(predictionSnap.data() as Prediction);
  }

  const detailRef = doc(db, 'pools', poolId, 'picks_detail', getLegacyPickDocId(matchId, userId));
  const detailSnap = await getDoc(detailRef);

  if (!detailSnap.exists()) {
    return null;
  }

  return detailSnap.data() as PickDetail;
}

/**
 * Get all user's pick details for a specific round
 */
export async function getUserPicksForRound(
  poolId: string,
  matchIds: string[],
  userId: string
): Promise<Map<string, PickDetail>> {
  const picks = new Map<string, PickDetail>();

  for (const matchId of matchIds) {
    const pick = await getUserPick(poolId, matchId, userId);
    if (pick) {
      picks.set(matchId, pick);
    }
  }

  return picks;
}

/**
 * Get pick statuses for a specific match across all pool members.
 * Uses legacy pool status docs as a temporary compatibility layer.
 */
export async function getMatchStatuses(
  poolId: string,
  matchId: string
): Promise<Map<string, PickStatus>> {
  const statusesRef = collection(db, 'pools', poolId, 'picks_status');
  const q = query(statusesRef, where('matchId', '==', matchId));
  const snapshot = await getDocs(q);

  const statuses = new Map<string, PickStatus>();
  snapshot.forEach((statusDoc) => {
    const status = statusDoc.data() as PickStatus;
    statuses.set(status.userId, status);
  });

  return statuses;
}

/**
 * Get all pick statuses for multiple matches (used for round view)
 */
export async function getMatchesStatuses(
  poolId: string,
  matchIds: string[]
): Promise<Map<string, Map<string, PickStatus>>> {
  const allStatuses = new Map<string, Map<string, PickStatus>>();

  for (const matchId of matchIds) {
    const matchStatuses = await getMatchStatuses(poolId, matchId);
    allStatuses.set(matchId, matchStatuses);
  }

  return allStatuses;
}

/**
 * Subscribe to real-time pick status updates for a specific match.
 * Uses legacy pool status docs as a temporary compatibility layer.
 */
export function subscribeToMatchStatuses(
  poolId: string,
  matchId: string,
  onUpdate: (statuses: Map<string, PickStatus>) => void
): () => void {
  const statusesRef = collection(db, 'pools', poolId, 'picks_status');
  const q = query(statusesRef, where('matchId', '==', matchId));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const statuses = new Map<string, PickStatus>();
    snapshot.forEach((statusDoc) => {
      const status = statusDoc.data() as PickStatus;
      statuses.set(status.userId, status);
    });
    onUpdate(statuses);
  });

  return unsubscribe;
}

/**
 * Subscribe to real-time pick status updates for multiple matches
 */
export function subscribeToMatchesStatuses(
  poolId: string,
  matchIds: string[],
  onUpdate: (matchId: string, statuses: Map<string, PickStatus>) => void
): () => void {
  const unsubscribes: Array<() => void> = [];

  for (const matchId of matchIds) {
    const unsubscribe = subscribeToMatchStatuses(poolId, matchId, (statuses) => {
      onUpdate(matchId, statuses);
    });
    unsubscribes.push(unsubscribe);
  }

  return () => {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
}

/**
 * Clear a pick (set to incomplete).
 * Also clears the universal prediction record during migration.
 */
export async function clearPick(
  poolId: string,
  matchId: string,
  userId: string,
  tournamentId: string,
  kickoffAt: Timestamp
): Promise<void> {
  const batch = writeBatch(db);
  const predictionRef = doc(db, 'predictions', getPredictionDocId(userId, matchId));
  const predictionSnap = await getDoc(predictionRef);
  const legacyDocId = getLegacyPickDocId(matchId, userId);
  const statusRef = doc(db, 'pools', poolId, 'picks_status', legacyDocId);
  const detailRef = doc(db, 'pools', poolId, 'picks_detail', legacyDocId);

  batch.set(
    predictionRef,
    {
      userId,
      matchId,
      tournamentId,
      winner: null,
      margin: null,
      kickoffAt,
      isComplete: false,
      isLocked: false,
      lockedAt: null,
      ...(predictionSnap.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(statusRef, {
    matchId,
    userId,
    isComplete: false,
    lockedAt: null,
    finalizedAt: null,
    kickoffAt,
    updatedAt: serverTimestamp(),
  });

  batch.set(detailRef, {
    matchId,
    userId,
    pickedWinnerTeamId: null,
    pickedMargin: null,
    kickoffAt,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}
