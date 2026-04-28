import {
  QueryConstraint,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { LeaderboardConfig, LeaderboardEntry, Season, UserTournamentStats } from './types';

export type LeaderboardTab = 'overall' | 'country' | 'hemisphere' | 'pundit';

export interface LeaderboardTabOption {
  id: LeaderboardTab;
  label: string;
}

export interface LeaderboardQuerySpec {
  field: 'countryCode' | 'resolvedHemisphere' | 'isPundit' | null;
  value: string | boolean | null;
}

const LEADERBOARD_ORDER: QueryConstraint[] = [
  orderBy('totalPoints', 'desc'),
  orderBy('correctWinners', 'desc'),
  orderBy('sumErrOnCorrectWinners', 'asc'),
  orderBy('exactScores', 'desc'),
  orderBy('lastLockedPredictionAt', 'asc'),
  limit(200),
];

export function getLeaderboardTabs(config?: LeaderboardConfig | null): LeaderboardTabOption[] {
  const options: LeaderboardTabOption[] = [];

  if (config?.enableOverall ?? true) {
    options.push({ id: 'overall', label: 'Overall' });
  }
  if (config?.enableCountry ?? true) {
    options.push({ id: 'country', label: 'Country' });
  }
  if (config?.enableHemisphere ?? true) {
    options.push({ id: 'hemisphere', label: 'Hemisphere' });
  }
  if (config?.enablePundit ?? true) {
    options.push({ id: 'pundit', label: 'Pundits' });
  }

  return options;
}

export function buildLeaderboardQuerySpec(
  tab: LeaderboardTab,
  selectedCountryCode: string,
  selectedHemisphere: 'north' | 'south',
): LeaderboardQuerySpec {
  if (tab === 'country') {
    return { field: 'countryCode', value: selectedCountryCode || null };
  }
  if (tab === 'hemisphere') {
    return { field: 'resolvedHemisphere', value: selectedHemisphere };
  }
  if (tab === 'pundit') {
    return { field: 'isPundit', value: true };
  }

  return { field: null, value: null };
}

function getRank(entries: UserTournamentStats[], index: number): number {
  if (index === 0) return 1;

  const prev = entries[index - 1];
  const current = entries[index];
  const tie =
    prev.totalPoints === current.totalPoints &&
    prev.correctWinners === current.correctWinners &&
    prev.sumErrOnCorrectWinners === current.sumErrOnCorrectWinners &&
    prev.exactScores === current.exactScores &&
    (prev.lastLockedPredictionAt?.toMillis?.() ?? 0) === (current.lastLockedPredictionAt?.toMillis?.() ?? 0);

  return tie ? getRank(entries, index - 1) : index + 1;
}

export async function getTournamentLeaderboardConfig(tournamentId: string): Promise<LeaderboardConfig | null> {
  const seasonDoc = await getDoc(doc(db, 'seasons', tournamentId));
  if (!seasonDoc.exists()) {
    return null;
  }

  const season = seasonDoc.data() as Season;
  return season.leaderboardConfig ?? null;
}

export async function getLeaderboardEntries({
  tournamentId,
  tab,
  countryCode,
  hemisphere,
}: {
  tournamentId: string;
  tab: LeaderboardTab;
  countryCode?: string;
  hemisphere?: 'north' | 'south';
}): Promise<LeaderboardEntry[]> {
  const statsCollection = collection(db, 'user_tournament_stats');
  const constraints: QueryConstraint[] = [where('tournamentId', '==', tournamentId)];

  const spec = buildLeaderboardQuerySpec(tab, countryCode ?? '', hemisphere ?? 'north');
  if (spec.field != null && spec.value != null) {
    constraints.push(where(spec.field, '==', spec.value));
  }

  const snapshot = await getDocs(query(statsCollection, ...constraints, ...LEADERBOARD_ORDER));
  const rows = snapshot.docs.map((docSnap) => docSnap.data() as UserTournamentStats);

  return rows.map((row, index) => ({
    userId: row.userId,
    displayName: row.displayName,
    photoURL: row.photoURL,
    totalPoints: row.totalPoints,
    correctWinners: row.correctWinners,
    sumErrOnCorrectWinners: row.sumErrOnCorrectWinners,
    exactScores: row.exactScores,
    lastLockedPredictionAt: row.lastLockedPredictionAt,
    rank: getRank(rows, index),
    position: index + 1,
  }));
}
