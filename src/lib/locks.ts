import { httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { functions } from './firebase';
import { PickStatus } from './types';

interface LockPickData {
  poolId: string;
  matchId: string;
}

interface LockPickResult {
  lockedAt: string;
}

export async function lockPick(poolId: string, matchId: string): Promise<void> {
  const fn = httpsCallable<LockPickData, LockPickResult>(functions, 'lockPick');
  await fn({ poolId, matchId });
}

/**
 * Lock all complete, unlocked picks for the given match IDs.
 * Skips matches where kickoffAt <= now (server will reject them anyway).
 */
export async function lockAllCompletedPicks(
  poolId: string,
  eligibleMatchIds: string[],
  onProgress?: (matchId: string, success: boolean) => void
): Promise<{ locked: number; failed: number }> {
  let locked = 0;
  let failed = 0;

  for (const matchId of eligibleMatchIds) {
    try {
      await lockPick(poolId, matchId);
      locked++;
      onProgress?.(matchId, true);
    } catch (err) {
      failed++;
      onProgress?.(matchId, false);
      console.error(`Failed to lock pick for match ${matchId}:`, err);
    }
  }

  return { locked, failed };
}

/**
 * Given a user's pick statuses for a round, return match IDs that can be locked:
 * isComplete == true, lockedAt == null, kickoffAt > now
 */
export function getLockableMatchIds(
  matchStatuses: Map<string, Map<string, PickStatus>>,
  userId: string
): string[] {
  const now = Date.now();
  const result: string[] = [];

  for (const [matchId, statuses] of matchStatuses) {
    const userStatus = statuses.get(userId);
    if (
      userStatus?.isComplete &&
      userStatus.lockedAt === null &&
      userStatus.kickoffAt.toMillis() > now
    ) {
      result.push(matchId);
    }
  }

  return result;
}
