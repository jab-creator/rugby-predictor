import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

interface FinalizeMatchData {
  seasonId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
}

export interface FinalizeMatchResult {
  seasonId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  actualWinner: string | null;
  actualMargin: number;
  scored: boolean;
  skipped: boolean;
}

export async function finalizeMatchResult(
  seasonId: string,
  matchId: string,
  homeScore: number,
  awayScore: number,
): Promise<FinalizeMatchResult> {
  const fn = httpsCallable<FinalizeMatchData, FinalizeMatchResult>(functions, 'finalizeMatch');
  const response = await fn({ seasonId, matchId, homeScore, awayScore });
  return response.data;
}
