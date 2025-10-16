// Proxies ranked tier emblems from Community Dragon
// Usage: /api/ranked-emblem?tier=GOLD&division=II
import { NextResponse } from 'next/server';

// Community Dragon has ranked emblems
const CDRAGON_EMBLEM = (tier) => 
  `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/${tier.toLowerCase()}.png`;

// Placeholder transparent 1x1 PNG
const PLACEHOLDER_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get('tier');
    
    if (!tier) {
      return NextResponse.json({ error: 'Missing required query param: tier' }, { status: 400 });
    }

    // Map tier names to emblem filenames
    const tierMap = {
      'IRON': 'iron',
      'BRONZE': 'bronze',
      'SILVER': 'silver',
      'GOLD': 'gold',
      'PLATINUM': 'platinum',
      'EMERALD': 'emerald',
      'DIAMOND': 'diamond',
      'MASTER': 'master',
      'GRANDMASTER': 'grandmaster',
      'CHALLENGER': 'challenger',
      'UNRANKED': 'unranked',
    };

    const tierLower = tierMap[tier.toUpperCase()] || 'unranked';
    const url = CDRAGON_EMBLEM(tierLower);

    try {
      console.log(`Fetching ranked emblem for ${tier}: ${url}`);
      const upstreamRes = await fetch(url, { cache: 'no-store' });
      
      if (upstreamRes.ok) {
        const contentType = upstreamRes.headers.get('content-type') || 'image/png';
        const buf = await upstreamRes.arrayBuffer();
        console.log(`✅ Ranked emblem ${tier} found`);
        return new Response(buf, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
            'X-Tier': tierLower,
          },
        });
      }
    } catch (e) {
      console.error(`Failed to fetch ranked emblem for ${tier}:`, e.message);
    }

    // Return placeholder for unranked/error
    return new Response(PLACEHOLDER_PNG, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
        'X-Placeholder': 'true',
      },
    });
  } catch (error) {
    return new Response(PLACEHOLDER_PNG, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
}

