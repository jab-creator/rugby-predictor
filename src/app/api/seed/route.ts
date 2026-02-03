import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { seedSixNations2025, seedSixNations2026, seedAllSeasons } from '@/lib/seed';

/**
 * POST /api/seed
 * 
 * Dev-only route to seed Six Nations fixtures into Firestore
 * 
 * Query parameters:
 * - season: '2025', '2026', or 'all' (default: 'all')
 * 
 * Usage:
 * curl -X POST http://localhost:3000/api/seed
 * curl -X POST http://localhost:3000/api/seed?season=2025
 * curl -X POST http://localhost:3000/api/seed?season=2026
 * curl -X POST http://localhost:3000/api/seed?season=all
 * 
 * Or visit in browser:
 * http://localhost:3000/api/seed
 * http://localhost:3000/api/seed?season=2026
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const season = searchParams.get('season') || 'all';
    
    let result;
    
    switch (season) {
      case '2025':
        result = await seedSixNations2025();
        break;
      case '2026':
        result = await seedSixNations2026();
        break;
      case 'all':
        result = await seedAllSeasons();
        break;
      default:
        return NextResponse.json(
          { 
            success: false, 
            message: `Invalid season parameter: ${season}. Use '2025', '2026', or 'all'` 
          },
          { status: 400 }
        );
    }
    
    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/seed
 * 
 * Also support GET for easier browser testing
 */
export async function GET(request: NextRequest) {
  return POST(request);
}
