import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { PoolMatchPredictionsView } from './types';

interface GetPoolMatchPredictionsData {
  poolId: string;
  matchId: string;
}

export async function getPoolMatchPredictions(
  poolId: string,
  matchId: string,
): Promise<PoolMatchPredictionsView> {
  const fn = httpsCallable<GetPoolMatchPredictionsData, PoolMatchPredictionsView>(
    functions,
    'getPoolMatchPredictions',
  );
  const response = await fn({ poolId, matchId });
  return response.data;
}
