import { NextResponse } from 'next/server';
import { seedSixNations2025 } from '@/lib/seed';

/**
 * POST /api/seed
 * 
 * Dev-only route to seed Six Nations 2025 fixtures into Firestore
 * 
 * Usage:
 * curl -X POST http://localhost:3000/api/seed
 * 
 * Or visit http://localhost:3000/api/seed in browser
 */
export async function POST() {
  try {
    const result = await seedSixNations2025();
    
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
export async function GET() {
  return POST();
}
