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
 * Six Nations 2026 Season Data
 */
export const SIX_NATIONS_2026: SeasonData = {
  id: 'six-nations-2026',
  name: 'Six Nations 2026',
  startsAt: new Date('2026-02-05T00:00:00Z'),
  endsAt: new Date('2026-03-14T23:59:59Z'),
};

/**
 * Six Nations 2026 Fixtures
 * Each team plays every other team once (5 rounds, 3 matches per round)
 */
export const SIX_NATIONS_2026_FIXTURES: FixtureData[] = [
  // ROUND 1
  {
    round: 1,
    kickoffAt: new Date('2026-02-05T20:10:00Z'), // Thursday 5 Feb, 8:10 PM GMT
    homeTeamId: 'FRA',
    awayTeamId: 'IRE',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 1,
    kickoffAt: new Date('2026-02-07T14:10:00Z'), // Saturday 7 Feb, 2:10 PM GMT
    homeTeamId: 'ITA',
    awayTeamId: 'SCO',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 1,
    kickoffAt: new Date('2026-02-07T16:40:00Z'), // Saturday 7 Feb, 4:40 PM GMT
    homeTeamId: 'ENG',
    awayTeamId: 'WAL',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },

  // ROUND 2
  {
    round: 2,
    kickoffAt: new Date('2026-02-14T14:10:00Z'), // Saturday 14 Feb, 2:10 PM GMT
    homeTeamId: 'IRE',
    awayTeamId: 'ITA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 2,
    kickoffAt: new Date('2026-02-14T16:40:00Z'), // Saturday 14 Feb, 4:40 PM GMT
    homeTeamId: 'SCO',
    awayTeamId: 'ENG',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 2,
    kickoffAt: new Date('2026-02-15T15:10:00Z'), // Sunday 15 Feb, 3:10 PM GMT
    homeTeamId: 'WAL',
    awayTeamId: 'FRA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },

  // ROUND 3
  {
    round: 3,
    kickoffAt: new Date('2026-02-21T14:10:00Z'), // Saturday 21 Feb, 2:10 PM GMT
    homeTeamId: 'ENG',
    awayTeamId: 'IRE',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 3,
    kickoffAt: new Date('2026-02-21T16:40:00Z'), // Saturday 21 Feb, 4:40 PM GMT
    homeTeamId: 'WAL',
    awayTeamId: 'SCO',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 3,
    kickoffAt: new Date('2026-02-22T15:10:00Z'), // Sunday 22 Feb, 3:10 PM GMT
    homeTeamId: 'FRA',
    awayTeamId: 'ITA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },

  // ROUND 4
  {
    round: 4,
    kickoffAt: new Date('2026-03-06T20:10:00Z'), // Friday 6 Mar, 8:10 PM GMT
    homeTeamId: 'IRE',
    awayTeamId: 'WAL',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 4,
    kickoffAt: new Date('2026-03-07T14:10:00Z'), // Saturday 7 Mar, 2:10 PM GMT
    homeTeamId: 'SCO',
    awayTeamId: 'FRA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 4,
    kickoffAt: new Date('2026-03-07T16:40:00Z'), // Saturday 7 Mar, 4:40 PM GMT
    homeTeamId: 'ITA',
    awayTeamId: 'ENG',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },

  // ROUND 5
  {
    round: 5,
    kickoffAt: new Date('2026-03-14T14:10:00Z'), // Saturday 14 Mar, 2:10 PM GMT
    homeTeamId: 'IRE',
    awayTeamId: 'SCO',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 5,
    kickoffAt: new Date('2026-03-14T16:40:00Z'), // Saturday 14 Mar, 4:40 PM GMT
    homeTeamId: 'WAL',
    awayTeamId: 'ITA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 5,
    kickoffAt: new Date('2026-03-14T20:10:00Z'), // Saturday 14 Mar, 8:10 PM GMT
    homeTeamId: 'FRA',
    awayTeamId: 'ENG',
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
