// app/api/match/route.js
import { NextResponse } from 'next/server';
import { getAdditionalMatches } from '@/lib/riotApi';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const puuid = searchParams.get('puuid');
    const start = parseInt(searchParams.get('start') || '20', 10);
    const count = parseInt(searchParams.get('count') || '20', 10);

    if (!puuid) {
      return NextResponse.json(
        { error: 'puuid parameter is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching matches for PUUID starting at ${start}, count ${count}`);
    
    const matches = await getAdditionalMatches(puuid, start, count);

    return NextResponse.json({
      success: true,
      data: {
        matches,
        hasMore: matches.length === count // If we got fewer than requested, no more available
      }
    });

  } catch (error) {
    console.error('Match API Error:', error);

    return NextResponse.json(
      { error: 'Failed to fetch matches', message: error.message },
      { status: 500 }
    );
  }
}

