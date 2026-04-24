import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { AggregateStatsState, applyScoreToAggregateStats, scorePrediction } from './scoring';

export interface MatchScoringDoc {
  round: number;
  kickoffAt: admin.firestore.Timestamp;
  homeTeamId: string;
  awayTeamId: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  actualWinner?: string | null;
  actualMargin?: number | null;
  updatedAt?: admin.firestore.Timestamp;
}

interface PredictionDoc {
  userId: string;
  matchId: string;
  tournamentId: string;
  winner: string | null;
  margin: number | null;
  isComplete: boolean;
  isLocked: boolean;
  lockedAt: admin.firestore.Timestamp | null;
}

interface UserProfileDoc {
  displayName?: string | null;
  photoURL?: string | null;
  countryCode?: string | null;
  hemisphere?: 'north' | 'south' | null;
  isPundit?: boolean | null;
}

interface UserTournamentStatsDoc {
  id: string;
  userId: string;
  tournamentId: string;
  totalPoints: number;
  correctWinners: number;
  sumErrOnCorrectWinners: number;
  exactScores: number;
  scoredMatchCount: number;
  lastScoredMatchId?: string;
  pointsByRound?: Record<string, number>;
  lastLockedPredictionAt?: admin.firestore.Timestamp;
  displayName: string;
  photoURL?: string;
  countryCode?: string;
  hemisphere?: 'north' | 'south';
  isPundit: boolean;
  updatedAt: admin.firestore.Timestamp;
}

export interface ScoreMatchResult {
  scored: boolean;
  skipped: boolean;
  reason?: string;
  predictionsScored?: number;
}

function getUserTournamentStatsDocId(tournamentId: string, userId: string): string {
  return `${tournamentId}_${userId}`;
}

export function getScoringRunDocId(tournamentId: string, matchId: string): string {
  return `${tournamentId}__${matchId}`;
}

export function getLegacyScoringRunDocId(matchId: string): string {
  return matchId;
}

function timestampToMillis(value: unknown): number | undefined {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis: unknown }).toMillis === 'function'
  ) {
    return ((value as { toMillis: () => number }).toMillis());
  }

  return undefined;
}

function aggregateStatsFromDoc(doc: Partial<UserTournamentStatsDoc> | null): AggregateStatsState {
  const pointsByRound =
    doc?.pointsByRound && typeof doc.pointsByRound === 'object'
      ? Object.entries(doc.pointsByRound).reduce<Record<string, number>>((acc, [key, value]) => {
          if (typeof value === 'number') {
            acc[key] = value;
          }
          return acc;
        }, {})
      : {};

  return {
    totalPoints: typeof doc?.totalPoints === 'number' ? doc.totalPoints : 0,
    correctWinners: typeof doc?.correctWinners === 'number' ? doc.correctWinners : 0,
    sumErrOnCorrectWinners: typeof doc?.sumErrOnCorrectWinners === 'number' ? doc.sumErrOnCorrectWinners : 0,
    exactScores: typeof doc?.exactScores === 'number' ? doc.exactScores : 0,
    scoredMatchCount: typeof doc?.scoredMatchCount === 'number' ? doc.scoredMatchCount : 0,
    lastScoredMatchId: doc?.lastScoredMatchId,
    pointsByRound,
    lastLockedPredictionAtMillis: timestampToMillis(doc?.lastLockedPredictionAt),
  };
}

function buildUserTournamentStatsDoc(params: {
  tournamentId: string;
  userId: string;
  aggregate: AggregateStatsState;
  lockedAt: admin.firestore.Timestamp | null;
  existing?: Partial<UserTournamentStatsDoc> | null;
  profile?: UserProfileDoc | null;
  now: admin.firestore.Timestamp;
}): UserTournamentStatsDoc {
  const { tournamentId, userId, aggregate, lockedAt, existing, profile, now } = params;

  const nextLockedAtMillis = aggregate.lastLockedPredictionAtMillis;
  const existingLockedAtMillis = timestampToMillis(existing?.lastLockedPredictionAt);

  return {
    id: getUserTournamentStatsDocId(tournamentId, userId),
    userId,
    tournamentId,
    totalPoints: aggregate.totalPoints,
    correctWinners: aggregate.correctWinners,
    sumErrOnCorrectWinners: aggregate.sumErrOnCorrectWinners,
    exactScores: aggregate.exactScores,
    scoredMatchCount: aggregate.scoredMatchCount,
    ...(aggregate.lastScoredMatchId ? { lastScoredMatchId: aggregate.lastScoredMatchId } : {}),
    ...(aggregate.pointsByRound ? { pointsByRound: aggregate.pointsByRound } : {}),
    ...((nextLockedAtMillis == null && existingLockedAtMillis == null)
      ? {}
      : {
          lastLockedPredictionAt: Timestamp.fromMillis(
            Math.max(existingLockedAtMillis ?? 0, nextLockedAtMillis ?? 0),
          ),
        }),
    displayName:
      profile?.displayName ??
      existing?.displayName ??
      userId,
    ...(profile?.photoURL != null
      ? { photoURL: profile.photoURL }
      : existing?.photoURL != null
        ? { photoURL: existing.photoURL }
        : {}),
    ...(profile?.countryCode != null
      ? { countryCode: profile.countryCode }
      : existing?.countryCode != null
        ? { countryCode: existing.countryCode }
        : {}),
    ...(profile?.hemisphere != null
      ? { hemisphere: profile.hemisphere }
      : existing?.hemisphere != null
        ? { hemisphere: existing.hemisphere }
        : {}),
    isPundit: profile?.isPundit ?? existing?.isPundit ?? false,
    updatedAt: now,
  };
}

export function deriveMatchOutcome(match: Pick<MatchScoringDoc, 'homeScore' | 'awayScore' | 'homeTeamId' | 'awayTeamId'>): {
  actualWinner: string | null;
  actualMargin: number;
} {
  if (typeof match.homeScore !== 'number' || typeof match.awayScore !== 'number') {
    throw new Error('Match scores must be present to derive outcome');
  }

  if (match.homeScore === match.awayScore) {
    return {
      actualWinner: null,
      actualMargin: 0,
    };
  }

  return {
    actualWinner: match.homeScore > match.awayScore ? match.homeTeamId : match.awayTeamId,
    actualMargin: Math.abs(match.homeScore - match.awayScore),
  };
}

export async function upsertLastLockedPredictionAt(params: {
  db: admin.firestore.Firestore;
  tournamentId: string;
  userId: string;
  lockedAt: admin.firestore.Timestamp;
}): Promise<void> {
  const { db, tournamentId, userId, lockedAt } = params;
  const statsRef = db.collection('user_tournament_stats').doc(getUserTournamentStatsDocId(tournamentId, userId));

  await db.runTransaction(async (tx) => {
    const [statsSnap, userSnap] = await Promise.all([
      tx.get(statsRef),
      tx.get(db.collection('users').doc(userId)),
    ]);

    const existing = statsSnap.exists ? (statsSnap.data() as Partial<UserTournamentStatsDoc>) : null;
    const existingLockedAtMillis = timestampToMillis(existing?.lastLockedPredictionAt);

    if (existingLockedAtMillis != null && existingLockedAtMillis >= lockedAt.toMillis()) {
      return;
    }

    const profile = userSnap.exists ? (userSnap.data() as UserProfileDoc) : null;

    tx.set(
      statsRef,
      {
        id: getUserTournamentStatsDocId(tournamentId, userId),
        userId,
        tournamentId,
        totalPoints: typeof existing?.totalPoints === 'number' ? existing.totalPoints : 0,
        correctWinners: typeof existing?.correctWinners === 'number' ? existing.correctWinners : 0,
        sumErrOnCorrectWinners:
          typeof existing?.sumErrOnCorrectWinners === 'number' ? existing.sumErrOnCorrectWinners : 0,
        exactScores: typeof existing?.exactScores === 'number' ? existing.exactScores : 0,
        scoredMatchCount: typeof existing?.scoredMatchCount === 'number' ? existing.scoredMatchCount : 0,
        ...(existing?.lastScoredMatchId ? { lastScoredMatchId: existing.lastScoredMatchId } : {}),
        ...(existing?.pointsByRound ? { pointsByRound: existing.pointsByRound } : {}),
        lastLockedPredictionAt: lockedAt,
        displayName: profile?.displayName ?? existing?.displayName ?? userId,
        ...(profile?.photoURL != null
          ? { photoURL: profile.photoURL }
          : existing?.photoURL != null
            ? { photoURL: existing.photoURL }
            : {}),
        ...(profile?.countryCode != null
          ? { countryCode: profile.countryCode }
          : existing?.countryCode != null
            ? { countryCode: existing.countryCode }
            : {}),
        ...(profile?.hemisphere != null
          ? { hemisphere: profile.hemisphere }
          : existing?.hemisphere != null
            ? { hemisphere: existing.hemisphere }
            : {}),
        isPundit: profile?.isPundit ?? existing?.isPundit ?? false,
        updatedAt: lockedAt,
      },
      { merge: true },
    );
  });
}

export async function scoreFinalizedMatch(params: {
  db: admin.firestore.Firestore;
  seasonId: string;
  matchId: string;
  match: MatchScoringDoc;
  now?: admin.firestore.Timestamp;
}): Promise<ScoreMatchResult> {
  const { db, seasonId, matchId, match } = params;
  const now = params.now ?? Timestamp.now();

  if (match.status !== 'final') {
    return { scored: false, skipped: true, reason: 'match-not-final' };
  }

  if (typeof match.homeScore !== 'number' || typeof match.awayScore !== 'number') {
    return { scored: false, skipped: true, reason: 'missing-scores' };
  }

  const scoringRunRef = db.collection('scoring_runs').doc(getScoringRunDocId(seasonId, matchId));
  const legacyScoringRunRef = db.collection('scoring_runs').doc(getLegacyScoringRunDocId(matchId));
  const predictionQuery = db.collection('predictions').where('matchId', '==', matchId);
  const actualOutcome = deriveMatchOutcome(match);

  return db.runTransaction(async (tx) => {
    const [scoringRunSnap, legacyScoringRunSnap] = await Promise.all([
      tx.get(scoringRunRef),
      tx.get(legacyScoringRunRef),
    ]);
    if (scoringRunSnap.exists || legacyScoringRunSnap.exists) {
      return { scored: false, skipped: true, reason: 'already-scored' };
    }

    const predictionSnap = await tx.get(predictionQuery);
    const scoredPredictions = predictionSnap.docs
      .map((docSnap) => {
        const prediction = docSnap.data() as PredictionDoc;
        const score = scorePrediction(
          { pickedWinnerTeamId: prediction.winner, pickedMargin: prediction.margin },
          { homeScore: match.homeScore as number, awayScore: match.awayScore as number },
          { homeTeamId: match.homeTeamId, awayTeamId: match.awayTeamId },
        );

        if (!score) {
          return null;
        }

        return {
          docSnap,
          prediction,
          score,
        };
      })
      .filter((value): value is {
        docSnap: admin.firestore.QueryDocumentSnapshot;
        prediction: PredictionDoc;
        score: NonNullable<ReturnType<typeof scorePrediction>>;
      } => value !== null);

    const userIds = [...new Set(scoredPredictions.map(({ prediction }) => prediction.userId))];

    const statsEntries = await Promise.all(
      userIds.map(async (userId) => {
        const [statsSnap, userSnap] = await Promise.all([
          tx.get(db.collection('user_tournament_stats').doc(getUserTournamentStatsDocId(seasonId, userId))),
          tx.get(db.collection('users').doc(userId)),
        ]);

        return {
          userId,
          existing: statsSnap.exists ? (statsSnap.data() as Partial<UserTournamentStatsDoc>) : null,
          profile: userSnap.exists ? (userSnap.data() as UserProfileDoc) : null,
        };
      }),
    );

    const statsByUser = new Map(
      statsEntries.map((entry) => [entry.userId, entry]),
    );

    for (const { docSnap, prediction, score } of scoredPredictions) {
      tx.set(
        docSnap.ref,
        {
          winnerCorrect: score.winnerCorrect,
          err: score.err,
          marginBonus: score.marginBonus,
          totalPoints: score.totalPoints,
          updatedAt: now,
        },
        { merge: true },
      );

      const entry = statsByUser.get(prediction.userId);
      const aggregate = applyScoreToAggregateStats(
        aggregateStatsFromDoc(entry?.existing ?? null),
        score,
        match.round,
        matchId,
        prediction.lockedAt?.toMillis(),
      );

      const nextStats = buildUserTournamentStatsDoc({
        tournamentId: seasonId,
        userId: prediction.userId,
        aggregate,
        lockedAt: prediction.lockedAt,
        existing: entry?.existing ?? null,
        profile: entry?.profile ?? null,
        now,
      });

      tx.set(
        db.collection('user_tournament_stats').doc(getUserTournamentStatsDocId(seasonId, prediction.userId)),
        nextStats,
        { merge: true },
      );

      if (entry) {
        entry.existing = nextStats;
      }
    }

    tx.create(scoringRunRef, {
      matchId,
      tournamentId: seasonId,
      scoredAt: now,
      predictionCount: scoredPredictions.length,
      actualWinner: actualOutcome.actualWinner,
      actualMargin: actualOutcome.actualMargin,
      result: {
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      },
    });

    return {
      scored: true,
      skipped: false,
      predictionsScored: scoredPredictions.length,
    };
  });
}
