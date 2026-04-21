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
 * Nations Championship 2026 Season Data
 * 12 teams (6 Northern, 6 Southern) across 6 rounds + Finals Weekend
 */
export const NATIONS_CHAMPIONSHIP_2026: SeasonData = {
  id: 'nations-championship-2026',
  name: 'Nations Championship 2026',
  startsAt: new Date('2026-07-04T00:00:00Z'),
  endsAt: new Date('2026-11-29T23:59:59Z'),
};

/**
 * Nations Championship 2026 Fixtures
 *
 * Northern Pool: England, France, Ireland, Italy, Scotland, Wales
 * Southern Pool: South Africa, New Zealand, Australia, Argentina, Fiji, Japan
 *
 * Rounds 1-3 (July): Southern Hemisphere Series — southern teams host
 * Rounds 4-6 (November): Northern Hemisphere Series — northern teams host
 * Finals Weekend (27-29 Nov): placement matches at Twickenham (TBD matchups)
 *
 * All kickoff times are in UTC. Some TBC times are estimated from typical
 * scheduling patterns and may be updated once officially confirmed.
 */
export const NATIONS_CHAMPIONSHIP_2026_FIXTURES: FixtureData[] = [
  // ===== ROUND 1 — Saturday 4 July 2026 (Southern Hemisphere Series) =====
  {
    round: 1,
    kickoffAt: new Date('2026-07-04T05:00:00Z'), // 14:00 JST (UTC+9)
    homeTeamId: 'JPN',
    awayTeamId: 'ITA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 1,
    kickoffAt: new Date('2026-07-04T07:10:00Z'), // 19:10 NZST (UTC+12)
    homeTeamId: 'NZL',
    awayTeamId: 'FRA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 1,
    kickoffAt: new Date('2026-07-04T10:00:00Z'), // 20:00 AEST (UTC+10)
    homeTeamId: 'AUS',
    awayTeamId: 'IRE',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 1,
    kickoffAt: new Date('2026-07-04T13:10:00Z'), // 14:10 BST (UTC+1)
    homeTeamId: 'FIJ',
    awayTeamId: 'WAL',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 1,
    kickoffAt: new Date('2026-07-04T15:40:00Z'), // 17:40 SAST (UTC+2)
    homeTeamId: 'RSA',
    awayTeamId: 'ENG',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 1,
    kickoffAt: new Date('2026-07-04T19:00:00Z'), // 16:00 ART (UTC-3)
    homeTeamId: 'ARG',
    awayTeamId: 'SCO',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },

  // ===== ROUND 2 — Saturday 11 July 2026 =====
  {
    round: 2,
    kickoffAt: new Date('2026-07-11T04:00:00Z'), // 14:00 AEST — Japan "home" in Robina, QLD
    homeTeamId: 'JPN',
    awayTeamId: 'IRE',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 2,
    kickoffAt: new Date('2026-07-11T05:10:00Z'), // 17:10 NZST (UTC+12)
    homeTeamId: 'NZL',
    awayTeamId: 'ITA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 2,
    kickoffAt: new Date('2026-07-11T07:30:00Z'), // 17:30 AEST (UTC+10)
    homeTeamId: 'AUS',
    awayTeamId: 'FRA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 2,
    kickoffAt: new Date('2026-07-11T13:10:00Z'), // 14:10 BST (UTC+1) — Fiji "home" in Liverpool
    homeTeamId: 'FIJ',
    awayTeamId: 'ENG',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 2,
    kickoffAt: new Date('2026-07-11T15:40:00Z'), // 17:40 SAST (UTC+2)
    homeTeamId: 'RSA',
    awayTeamId: 'SCO',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 2,
    kickoffAt: new Date('2026-07-11T19:00:00Z'), // 16:00 ART (UTC-3)
    homeTeamId: 'ARG',
    awayTeamId: 'WAL',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },

  // ===== ROUND 3 — Saturday 18 July 2026 =====
  {
    round: 3,
    kickoffAt: new Date('2026-07-18T05:00:00Z'), // 14:00 JST (UTC+9) — estimated TBC
    homeTeamId: 'JPN',
    awayTeamId: 'FRA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 3,
    kickoffAt: new Date('2026-07-18T07:10:00Z'), // 19:10 NZST (UTC+12)
    homeTeamId: 'NZL',
    awayTeamId: 'IRE',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 3,
    kickoffAt: new Date('2026-07-18T09:45:00Z'), // 17:45 AWST (UTC+8) — Perth
    homeTeamId: 'AUS',
    awayTeamId: 'ITA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 3,
    kickoffAt: new Date('2026-07-18T13:10:00Z'), // 14:10 BST (UTC+1) — Fiji "home" in Edinburgh
    homeTeamId: 'FIJ',
    awayTeamId: 'SCO',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 3,
    kickoffAt: new Date('2026-07-18T15:40:00Z'), // 17:40 SAST (UTC+2)
    homeTeamId: 'RSA',
    awayTeamId: 'WAL',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 3,
    kickoffAt: new Date('2026-07-18T19:00:00Z'), // 16:00 ART (UTC-3)
    homeTeamId: 'ARG',
    awayTeamId: 'ENG',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },

  // ===== ROUND 4 — 6/7/8 November 2026 (Northern Hemisphere Series) =====
  {
    round: 4,
    kickoffAt: new Date('2026-11-06T20:10:00Z'), // Friday 6 Nov, 20:10 GMT
    homeTeamId: 'IRE',
    awayTeamId: 'ARG',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 4,
    kickoffAt: new Date('2026-11-07T14:10:00Z'), // Saturday 7 Nov, 14:10 GMT
    homeTeamId: 'ITA',
    awayTeamId: 'RSA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 4,
    kickoffAt: new Date('2026-11-07T14:10:00Z'), // Saturday 7 Nov, 14:10 GMT
    homeTeamId: 'SCO',
    awayTeamId: 'NZL',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 4,
    kickoffAt: new Date('2026-11-07T16:40:00Z'), // Saturday 7 Nov, 16:40 GMT
    homeTeamId: 'WAL',
    awayTeamId: 'JPN',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 4,
    kickoffAt: new Date('2026-11-07T20:10:00Z'), // Saturday 7 Nov, 20:10 GMT
    homeTeamId: 'FRA',
    awayTeamId: 'FIJ',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 4,
    kickoffAt: new Date('2026-11-08T15:10:00Z'), // Sunday 8 Nov, 15:10 GMT
    homeTeamId: 'ENG',
    awayTeamId: 'AUS',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },

  // ===== ROUND 5 — 13/14/15 November 2026 =====
  {
    round: 5,
    kickoffAt: new Date('2026-11-13T20:10:00Z'), // Friday 13 Nov, 20:10 GMT
    homeTeamId: 'FRA',
    awayTeamId: 'RSA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 5,
    kickoffAt: new Date('2026-11-14T14:10:00Z'), // Saturday 14 Nov, 14:10 GMT
    homeTeamId: 'ITA',
    awayTeamId: 'ARG',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 5,
    kickoffAt: new Date('2026-11-14T14:10:00Z'), // Saturday 14 Nov, 14:10 GMT
    homeTeamId: 'IRE',
    awayTeamId: 'FIJ',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 5,
    kickoffAt: new Date('2026-11-14T16:40:00Z'), // Saturday 14 Nov, 16:40 GMT
    homeTeamId: 'WAL',
    awayTeamId: 'NZL',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 5,
    kickoffAt: new Date('2026-11-14T16:40:00Z'), // Saturday 14 Nov, 16:40 GMT
    homeTeamId: 'ENG',
    awayTeamId: 'JPN',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 5,
    kickoffAt: new Date('2026-11-15T15:10:00Z'), // Sunday 15 Nov, 15:10 GMT
    homeTeamId: 'SCO',
    awayTeamId: 'AUS',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },

  // ===== ROUND 6 — Saturday 21 November 2026 =====
  {
    round: 6,
    kickoffAt: new Date('2026-11-21T14:10:00Z'), // Saturday 21 Nov, 14:10 GMT
    homeTeamId: 'ITA',
    awayTeamId: 'FIJ',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 6,
    kickoffAt: new Date('2026-11-21T14:10:00Z'), // Saturday 21 Nov, 14:10 GMT
    homeTeamId: 'SCO',
    awayTeamId: 'JPN',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 6,
    kickoffAt: new Date('2026-11-21T14:10:00Z'), // Saturday 21 Nov, 14:10 GMT
    homeTeamId: 'ENG',
    awayTeamId: 'NZL',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 6,
    kickoffAt: new Date('2026-11-21T16:40:00Z'), // Saturday 21 Nov, 16:40 GMT
    homeTeamId: 'IRE',
    awayTeamId: 'RSA',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 6,
    kickoffAt: new Date('2026-11-21T20:10:00Z'), // Saturday 21 Nov, 20:10 GMT
    homeTeamId: 'FRA',
    awayTeamId: 'ARG',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  },
  {
    round: 6,
    kickoffAt: new Date('2026-11-21T20:10:00Z'), // Saturday 21 Nov, 20:10 GMT
    homeTeamId: 'WAL',
    awayTeamId: 'AUS',
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
  RSA: 'South Africa',
  NZL: 'New Zealand',
  AUS: 'Australia',
  ARG: 'Argentina',
  FIJ: 'Fiji',
  JPN: 'Japan',
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
  RSA: '🇿🇦',
  NZL: '🇳🇿',
  AUS: '🇦🇺',
  ARG: '🇦🇷',
  FIJ: '🇫🇯',
  JPN: '🇯🇵',
};
