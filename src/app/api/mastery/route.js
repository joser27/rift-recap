// src/app/api/mastery/route.js
import { NextResponse } from 'next/server';
import { getChampionMasteryTop, getChampionMasteryTopByPuuid, getSummonerByPuuid, PLATFORMS } from '@/lib/riotApi';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    let summonerId = searchParams.get('summonerId');
    const puuid = searchParams.get('puuid');
    const count = Number(searchParams.get('count') || 5);
    const platform = (searchParams.get('platform') || 'NA1').toUpperCase();

    const plat = PLATFORMS[platform] || PLATFORMS.NA1;

    let mastery;
    if (puuid) {
      try {
        mastery = await getChampionMasteryTopByPuuid(puuid, count, plat);
      } catch (e) {
        // Fallback to summonerId route
      }
    }
    if (!mastery) {
      if (!summonerId) {
        if (!puuid) return NextResponse.json({ error: 'summonerId or puuid is required' }, { status: 400 });
        const summoner = await getSummonerByPuuid(puuid, plat);
        summonerId = summoner?.id;
        if (!summonerId) return NextResponse.json({ error: 'Failed to resolve summonerId from puuid' }, { status: 404 });
      }
      mastery = await getChampionMasteryTop(summonerId, count, plat);
    }
    return NextResponse.json({ success: true, mastery });

  } catch (error) {
    console.error('Mastery API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch mastery', message: error.message }, { status: 500 });
  }
}


