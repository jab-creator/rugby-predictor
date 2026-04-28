import { Timestamp } from 'firebase/firestore';

// Team IDs for Nations Championship (Northern + Southern Hemisphere)
export type TeamId =
  | 'ENG' | 'FRA' | 'IRE' | 'ITA' | 'SCO' | 'WAL'
  | 'RSA' | 'NZL' | 'AUS' | 'ARG' | 'FIJ' | 'JPN';

// Match status
export type MatchStatus = 'scheduled' | 'live' | 'final';

export type Hemisphere = 'north' | 'south';

// Scoring version
export type ScoringVersion = 'v1';

// ==================== SEASON & MATCHES ====================

export interface Season {
  name: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
}

export interface Match {
  round: number; // 1-6
  kickoffAt: Timestamp;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  actualWinner?: TeamId | null;
  actualMargin?: number | null;
  updatedAt: Timestamp;
}

// ==================== POOLS ====================

export interface Pool {
  seasonId: string;
  name: string;
  joinCode: string;
  createdBy: string; // userId
  createdAt: Timestamp;
  membersCount: number;
  scoringVersion: ScoringVersion;
  maxMargin: number; // 99
}

export interface PoolMember {
  displayName: string;
  photoURL?: string;
  joinedAt: Timestamp;
}

// ==================== PICKS ====================

export interface PickStatus {
  matchId: string;
  userId: string;
  isComplete: boolean;
  lockedAt: Timestamp | null;
  finalizedAt: Timestamp | null;
  kickoffAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PickDetail {
  matchId: string;
  userId: string;
  pickedWinnerTeamId: TeamId | null;
  pickedMargin: number | null; // 1-99
  kickoffAt: Timestamp;
  updatedAt: Timestamp;
  // Scoring fields (written by server after match final)
  winnerCorrect?: boolean;
  err?: number;
  marginBonus?: number;
  closestBonus?: number;
  totalPoints?: number;
}

export interface Prediction {
  userId: string;
  matchId: string;
  tournamentId: string;
  winner: TeamId | null;
  margin: number | null; // 1-99
  kickoffAt: Timestamp;
  isComplete: boolean;
  isLocked: boolean;
  lockedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Scoring fields (written by server after match final)
  winnerCorrect?: boolean;
  err?: number;
  marginBonus?: number;
  totalPoints?: number;
}

// ==================== USER PROFILES ====================

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  countryCode?: string;
  hemisphere?: Hemisphere;
  isPundit: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastSignInAt?: Timestamp;
}



// ==================== USER TOURNAMENT STATS ====================

export interface UserTournamentStats {
  id: string;                    // "{tournamentId}_{userId}"
  userId: string;
  tournamentId: string;

  // Aggregate scoring
  totalPoints: number;
  correctWinners: number;
  sumErrOnCorrectWinners: number; // cumulative err across correct-winner predictions
  exactScores: number;            // count of predictions where err == 0

  // Rebuild safety
  scoredMatchCount: number;
  lastScoredMatchId?: string;
  pointsByRound?: Record<string, number>;

  // Tiebreaker
  lastLockedPredictionAt?: Timestamp;

  // Denormalized user attributes for leaderboard filtering
  displayName: string;
  photoURL?: string;
  countryCode?: string;
  hemisphere?: Hemisphere;
  isPundit: boolean;

  updatedAt: Timestamp;
}

// ==================== LEADERBOARDS ====================

export interface LeaderboardMeta {
  id: string;                    // tournament-scoped: "{tournamentId}__{type}"
  tournamentId: string;
  type: 'global' | 'country' | 'hemisphere' | 'pundit_status';
  name: string;

  filterKey?: string;
  filterValue?: string;

  totalUsers: number;

  // Summary stats for cross-group comparison
  avgPoints: number;
  medianPoints: number;
  top10AvgPoints?: number;
  winnerPoints?: number;
  percentileBuckets?: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };

  lastUpdatedAt: Timestamp;
}

export interface Leaderboard {
  totalPoints: number;
  lastUpdatedAt: Timestamp;
}

export interface RoundScore {
  roundPoints: number;
  lastUpdatedAt: Timestamp;
}

// ==================== SCORING RUNS ====================

export interface ScoringRun {
  scoredAt: Timestamp;
  tournamentId: string;
  matchId: string;
  predictionCount: number;
  actualWinner: TeamId | null;
  actualMargin: number;
  result: {
    homeScore: number;
    awayScore: number;
  };
}

// ==================== CLIENT-SIDE HELPERS ====================

// Combined view of a pick with status and detail
export interface PickView {
  matchId: string;
  userId: string;
  status: PickStatus;
  detail?: PickDetail; // May be hidden based on visibility rules
}

// Pick visibility status for UI
export type PickVisibility = 'no-pick' | 'picked' | 'locked' | 'final';

// Leaderboard entry with user info and tiebreaker fields
export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  photoURL?: string;

  // Scoring (copied from UserTournamentStats — universal)
  totalPoints: number;
  correctWinners: number;
  sumErrOnCorrectWinners: number;
  exactScores: number;
  lastLockedPredictionAt?: Timestamp;

  // Rank within this leaderboard (tie-aware)
  rank: number;
  position: number;        // sequential row number (always unique)

  // Normalized context for cross-leaderboard comparison
  percentile?: number;     // 0–100 within this leaderboard
}
