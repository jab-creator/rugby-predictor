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
import { TeamId, PickStatus, PickDetail } from './types';

/**
 * Save a pick with batched writes to both picks_detail and picks_status
 * Implements dual-doc pattern per DATA_MODEL.md
 */
export async function savePick(
  poolId: string,
  matchId: string,
  userId: string,
  pickedWinnerTeamId: TeamId,
  pickedMargin: number
): Promise<void> {
  if (pickedMargin < 1 || pickedMargin > 99) {
    throw new Error('Margin must be between 1 and 99');
  }

  const batch = writeBatch(db);

  // Document IDs follow pattern: {matchId}_{userId}
  const statusDocId = `${matchId}_${userId}`;
  const detailDocId = `${matchId}_${userId}`;

  const statusRef = doc(db, 'pools', poolId, 'picks_status', statusDocId);
  const detailRef = doc(db, 'pools', poolId, 'picks_detail', detailDocId);

  // Pick is complete if both winner and margin are set
  const isComplete = true;

  // Write picks_status
  const statusData: Omit<PickStatus, 'updatedAt'> & { updatedAt: any } = {
    matchId,
    userId,
    isComplete,
    lockedAt: null, // Locking in Milestone 4
    finalizedAt: null, // Server-only field for post-kickoff
    updatedAt: serverTimestamp(),
  };

  batch.set(statusRef, statusData);

  // Write picks_detail
  const detailData: Omit<PickDetail, 'updatedAt'> & { updatedAt: any } = {
    matchId,
    userId,
    pickedWinnerTeamId,
    pickedMargin,
    updatedAt: serverTimestamp(),
    // Scoring fields (written by server after match final - Milestone 6)
  };

  batch.set(detailRef, detailData);

  await batch.commit();
}

/**
 * Get user's pick detail for a specific match
 */
export async function getUserPick(
  poolId: string,
  matchId: string,
  userId: string
): Promise<PickDetail | null> {
  const detailDocId = `${matchId}_${userId}`;
  const detailRef = doc(db, 'pools', poolId, 'picks_detail', detailDocId);
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

  // Load all picks for the user in this round
  for (const matchId of matchIds) {
    const pick = await getUserPick(poolId, matchId, userId);
    if (pick) {
      picks.set(matchId, pick);
    }
  }

  return picks;
}

/**
 * Get pick statuses for a specific match across all pool members
 */
export async function getMatchStatuses(
  poolId: string,
  matchId: string
): Promise<Map<string, PickStatus>> {
  const statusesRef = collection(db, 'pools', poolId, 'picks_status');
  const q = query(statusesRef, where('matchId', '==', matchId));
  const snapshot = await getDocs(q);

  const statuses = new Map<string, PickStatus>();
  snapshot.forEach((doc) => {
    const status = doc.data() as PickStatus;
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
  // Map of matchId -> Map of userId -> status
  const allStatuses = new Map<string, Map<string, PickStatus>>();

  for (const matchId of matchIds) {
    const matchStatuses = await getMatchStatuses(poolId, matchId);
    allStatuses.set(matchId, matchStatuses);
  }

  return allStatuses;
}

/**
 * Subscribe to real-time pick status updates for a specific match
 * Returns unsubscribe function
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
    snapshot.forEach((doc) => {
      const status = doc.data() as PickStatus;
      statuses.set(status.userId, status);
    });
    onUpdate(statuses);
  });

  return unsubscribe;
}

/**
 * Subscribe to real-time pick status updates for multiple matches
 * Returns unsubscribe function
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

  // Return combined unsubscribe function
  return () => {
    unsubscribes.forEach((unsub) => unsub());
  };
}

/**
 * Clear a pick (set to incomplete)
 */
export async function clearPick(
  poolId: string,
  matchId: string,
  userId: string
): Promise<void> {
  const batch = writeBatch(db);

  const statusDocId = `${matchId}_${userId}`;
  const detailDocId = `${matchId}_${userId}`;

  const statusRef = doc(db, 'pools', poolId, 'picks_status', statusDocId);
  const detailRef = doc(db, 'pools', poolId, 'picks_detail', detailDocId);

  // Update status to incomplete
  batch.set(statusRef, {
    matchId,
    userId,
    isComplete: false,
    lockedAt: null,
    finalizedAt: null,
    updatedAt: serverTimestamp(),
  });

  // Clear detail
  batch.set(detailRef, {
    matchId,
    userId,
    pickedWinnerTeamId: null,
    pickedMargin: null,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}
