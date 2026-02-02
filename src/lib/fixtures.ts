import { Timestamp } from 'firebase/firestore';
import { TeamId, MatchStatus } from './types';

export interface FixtureData {
  round: number;
  kickoffAt: Date;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
}

export interface SeasonData {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Six Nations 2025 Season Data
 */
export const SIX_NATIONS_2025: SeasonData = {
  id: 'six-nations-2025',
  name: 'Six Nations 2025',
  startsAt: new Date('2025-02-01T00:00:00Z'),
  endsAt: new Date('2025-03-15T23:59:59Z'),
};

/**
 * Six Nations 2025 Fixtures
 * Each team plays every other team once (5 rounds, 3 matches per round)
 */
export const SIX_NATIONS_2025_FIXTURES: FixtureData[] = [
  // ROUND 1 - February 1, 2025
  {
    round: 1,
    kickoffAt: new Date('2025-02-01T14:15:00Z'), // 2:15 PM UTC
    homeTeamId: 'FRA',
    awayTeamId: 'WAL',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 1,
    kickoffAt: new Date('2025-02-01T16:45:00Z'), // 4:45 PM UTC
    homeTeamId: 'ITA',
    awayTeamId: 'SCO',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 1,
    kickoffAt: new Date('2025-02-01T17:00:00Z'), // 5:00 PM UTC
    homeTeamId: 'IRE',
    awayTeamId: 'ENG',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },

  // ROUND 2 - February 8, 2025
  {
    round: 2,
    kickoffAt: new Date('2025-02-08T14:15:00Z'),
    homeTeamId: 'SCO',
    awayTeamId: 'FRA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 2,
    kickoffAt: new Date('2025-02-08T16:45:00Z'),
    homeTeamId: 'ENG',
    awayTeamId: 'WAL',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 2,
    kickoffAt: new Date('2025-02-08T17:00:00Z'),
    homeTeamId: 'ITA',
    awayTeamId: 'IRE',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },

  // ROUND 3 - February 22, 2025
  {
    round: 3,
    kickoffAt: new Date('2025-02-22T14:15:00Z'),
    homeTeamId: 'IRE',
    awayTeamId: 'FRA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 3,
    kickoffAt: new Date('2025-02-22T16:45:00Z'),
    homeTeamId: 'SCO',
    awayTeamId: 'WAL',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 3,
    kickoffAt: new Date('2025-02-22T17:00:00Z'),
    homeTeamId: 'ENG',
    awayTeamId: 'ITA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },

  // ROUND 4 - March 8, 2025
  {
    round: 4,
    kickoffAt: new Date('2025-03-08T14:15:00Z'),
    homeTeamId: 'WAL',
    awayTeamId: 'ITA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 4,
    kickoffAt: new Date('2025-03-08T16:45:00Z'),
    homeTeamId: 'IRE',
    awayTeamId: 'SCO',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 4,
    kickoffAt: new Date('2025-03-08T17:00:00Z'),
    homeTeamId: 'FRA',
    awayTeamId: 'ENG',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },

  // ROUND 5 - March 15, 2025 (Super Saturday)
  {
    round: 5,
    kickoffAt: new Date('2025-03-15T12:15:00Z'),
    homeTeamId: 'ITA',
    awayTeamId: 'FRA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 5,
    kickoffAt: new Date('2025-03-15T14:45:00Z'),
    homeTeamId: 'WAL',
    awayTeamId: 'IRE',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 5,
    kickoffAt: new Date('2025-03-15T17:00:00Z'),
    homeTeamId: 'ENG',
    awayTeamId: 'SCO',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
];

/**
 * Team display names
 */
export const TEAM_NAMES: Record<TeamId, string> = {
  ENG: 'England',
  FRA: 'France',
  IRE: 'Ireland',
  ITA: 'Italy',
  SCO: 'Scotland',
  WAL: 'Wales',
};

/**
 * Team flag emojis
 */
export const TEAM_FLAGS: Record<TeamId, string> = {
  ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  FRA: '🇫🇷',
  IRE: '🇮🇪',
  ITA: '🇮🇹',
  SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  WAL: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
};
