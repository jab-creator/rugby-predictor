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
import { LeaderboardConfig, LeaderboardEntry, PoolMember, Season, UserTournamentStats } from './types';

export type LeaderboardTab = 'pool' | 'overall' | 'country' | 'hemisphere' | 'pundit';

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
  const options: LeaderboardTabOption[] = [{ id: 'pool', label: 'Pool' }];

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

function getLeaderboardTime(entry: Pick<LeaderboardEntry, 'lastLockedPredictionAt'>): number {
  return entry.lastLockedPredictionAt?.toMillis?.() ?? Infinity;
}

function compareLeaderboardEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;
  if (a.correctWinners !== b.correctWinners) return b.correctWinners - a.correctWinners;
  if (a.sumErrOnCorrectWinners !== b.sumErrOnCorrectWinners) {
    return a.sumErrOnCorrectWinners - b.sumErrOnCorrectWinners;
  }
  if (a.exactScores !== b.exactScores) return b.exactScores - a.exactScores;

  return getLeaderboardTime(a) - getLeaderboardTime(b);
}

function entriesAreTied(a: LeaderboardEntry, b: LeaderboardEntry): boolean {
  return (
    a.totalPoints === b.totalPoints &&
    a.correctWinners === b.correctWinners &&
    a.sumErrOnCorrectWinners === b.sumErrOnCorrectWinners &&
    a.exactScores === b.exactScores &&
    getLeaderboardTime(a) === getLeaderboardTime(b)
  );
}

function assignRanks(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const sorted = [...entries].sort(compareLeaderboardEntries);
  let currentRank = 1;

  return sorted.map((entry, index) => {
    if (index > 0 && !entriesAreTied(sorted[index - 1], entry)) {
      currentRank = index + 1;
    }

    return {
      ...entry,
      rank: currentRank,
      position: index + 1,
    };
  });
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

export async function getManualPoolLeaderboardEntries({
  poolId,
  tournamentId,
}: {
  poolId: string;
  tournamentId: string;
}): Promise<LeaderboardEntry[]> {
  const membersSnapshot = await getDocs(collection(db, 'pools', poolId, 'members'));
  const members = membersSnapshot.docs.map((memberDoc) => ({
    id: memberDoc.id,
    member: memberDoc.data() as PoolMember,
  }));

  const statsSnapshots = await Promise.all(
    members.map(({ id }) => getDoc(doc(db, 'user_tournament_stats', `${tournamentId}_${id}`))),
  );

  const entries = members.map(({ id, member }, index): LeaderboardEntry => {
    const stats = statsSnapshots[index].exists()
      ? (statsSnapshots[index].data() as UserTournamentStats)
      : null;

    return {
      userId: id,
      displayName: stats?.displayName ?? member.displayName ?? id,
      photoURL: stats?.photoURL ?? member.photoURL,
      totalPoints: stats?.totalPoints ?? 0,
      correctWinners: stats?.correctWinners ?? 0,
      sumErrOnCorrectWinners: stats?.sumErrOnCorrectWinners ?? 0,
      exactScores: stats?.exactScores ?? 0,
      lastLockedPredictionAt: stats?.lastLockedPredictionAt,
      rank: 0,
      position: 0,
    };
  });

  return assignRanks(entries);
}
