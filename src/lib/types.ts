import { Timestamp } from 'firebase/firestore';

// Team IDs for Six Nations
export type TeamId = 'ENG' | 'FRA' | 'IRE' | 'ITA' | 'SCO' | 'WAL';

// Match status
export type MatchStatus = 'scheduled' | 'live' | 'final';

// Scoring version
export type ScoringVersion = 'v1';

// ==================== SEASON & MATCHES ====================

export interface Season {
  name: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
}

export interface Match {
  round: number; // 1-5
  kickoffAt: Timestamp;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
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
  updatedAt: Timestamp;
}

export interface PickDetail {
  matchId: string;
  userId: string;
  pickedWinnerTeamId: TeamId | null;
  pickedMargin: number | null; // 1-99
  updatedAt: Timestamp;
  // Scoring fields (written by server after match final)
  winnerCorrect?: boolean;
  err?: number;
  marginBonus?: number;
  closestBonus?: number;
  totalPoints?: number;
}

// ==================== LEADERBOARDS ====================

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
  scoringVersion: ScoringVersion;
  seasonId: string;
  round: number;
  matchId: string;
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

// Leaderboard entry with user info
export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  photoURL?: string;
  totalPoints: number;
}
