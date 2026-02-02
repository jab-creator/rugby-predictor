import { 
  collection, 
  doc, 
  setDoc, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  SIX_NATIONS_2025, 
  SIX_NATIONS_2025_FIXTURES,
  SeasonData,
  FixtureData 
} from './fixtures';
import { Season, Match } from './types';

/**
 * Seed a season into Firestore
 */
async function seedSeason(seasonData: SeasonData): Promise<void> {
  const seasonRef = doc(db, 'seasons', seasonData.id);
  
  const season: Omit<Season, 'startsAt' | 'endsAt'> & { startsAt: Timestamp; endsAt: Timestamp } = {
    name: seasonData.name,
    startsAt: Timestamp.fromDate(seasonData.startsAt),
    endsAt: Timestamp.fromDate(seasonData.endsAt),
  };
  
  await setDoc(seasonRef, season);
  console.log(`✓ Seeded season: ${seasonData.name}`);
}

/**
 * Seed fixtures for a season into Firestore
 */
async function seedFixtures(seasonId: string, fixtures: FixtureData[]): Promise<void> {
  const matchesRef = collection(db, 'seasons', seasonId, 'matches');
  
  for (const fixture of fixtures) {
    const matchId = `${seasonId}-r${fixture.round}-${fixture.homeTeamId}-${fixture.awayTeamId}`;
    const matchRef = doc(matchesRef, matchId);
    
    const match: Omit<Match, 'kickoffAt' | 'updatedAt'> & { 
      kickoffAt: Timestamp; 
      updatedAt: Timestamp;
    } = {
      round: fixture.round,
      kickoffAt: Timestamp.fromDate(fixture.kickoffAt),
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      status: fixture.status,
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      updatedAt: Timestamp.now(),
    };
    
    await setDoc(matchRef, match);
  }
  
  console.log(`✓ Seeded ${fixtures.length} fixtures for ${seasonId}`);
}

/**
 * Check if a season has already been seeded
 */
async function isSeasonSeeded(seasonId: string): Promise<boolean> {
  const matchesRef = collection(db, 'seasons', seasonId, 'matches');
  const snapshot = await getDocs(matchesRef);
  return !snapshot.empty;
}

/**
 * Seed Six Nations 2025 into Firestore
 */
export async function seedSixNations2025(): Promise<{ success: boolean; message: string }> {
  try {
    // Check if already seeded
    const alreadySeeded = await isSeasonSeeded(SIX_NATIONS_2025.id);
    
    if (alreadySeeded) {
      return {
        success: false,
        message: 'Six Nations 2025 already seeded. Delete existing fixtures to re-seed.',
      };
    }
    
    // Seed season
    await seedSeason(SIX_NATIONS_2025);
    
    // Seed fixtures
    await seedFixtures(SIX_NATIONS_2025.id, SIX_NATIONS_2025_FIXTURES);
    
    return {
      success: true,
      message: `Successfully seeded Six Nations 2025 with ${SIX_NATIONS_2025_FIXTURES.length} fixtures`,
    };
  } catch (error) {
    console.error('Error seeding Six Nations 2025:', error);
    return {
      success: false,
      message: `Failed to seed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
