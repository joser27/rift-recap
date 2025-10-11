// app/api/summoner/route.js
import { NextResponse } from 'next/server';
import { getPlayerProfile } from '@/lib/riotApi';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameName = searchParams.get('gameName');
    const tagLine = searchParams.get('tagLine') || 'NA1';

    if (!gameName) {
      return NextResponse.json(
        { error: 'gameName parameter is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching summoner: ${gameName}#${tagLine}`);
    
    const profile = await getPlayerProfile(gameName, tagLine);

    return NextResponse.json({
      success: true,
      data: profile
    });

  } catch (error) {
    console.error('Summoner API Error:', error);
    
    if (error.message === 'Not found') {
      return NextResponse.json(
        { error: 'Summoner not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch summoner', message: error.message },
      { status: 500 }
    );
  }
}