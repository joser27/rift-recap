// Proxies item icons through our domain to avoid ORB/CORS issues
// Usage: /api/item-icon?id=3031
import { NextResponse } from 'next/server';

// Data Dragon version (update when new League patch releases)
const DD_VERSION = '15.20.1'; // Current as of Oct 2025

// Multiple CDN paths to try (Data Dragon is most reliable)
const DATA_DRAGON = (id) => `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/item/${id}.png`;
const CDRAGON_CDN = (id) => `https://cdn.communitydragon.org/${DD_VERSION}/item/${id}`;
const CDRAGON_RAW = (id) => `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/${id}.png`;

// Placeholder transparent 1x1 PNG for missing items
const PLACEHOLDER_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing required query param: id' }, { status: 400 });
    }

    // Try multiple CDN paths
    const candidates = [
      DATA_DRAGON(id),     // Try Data Dragon first (most reliable)
      CDRAGON_CDN(id),     // Then Community Dragon CDN
      CDRAGON_RAW(id),     // Then raw GitHub
    ];

    for (const url of candidates) {
      try {
        console.log(`🔍 Trying item ${id} at: ${url}`);
        const upstreamRes = await fetch(url, { cache: 'no-store' });
        console.log(`📊 Response: ${upstreamRes.status} ${upstreamRes.statusText}`);
        
        if (upstreamRes.ok) {
          const contentType = upstreamRes.headers.get('content-type') || 'image/png';
          const buf = await upstreamRes.arrayBuffer();
          console.log(`✅ Item ${id} found! Size: ${buf.byteLength} bytes, URL: ${url}`);
          return new Response(buf, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              // Cache on the edge for 24 hours
              'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
              'X-Upstream-URL': url,
              'X-Content-Length': buf.byteLength.toString(),
              'Access-Control-Allow-Origin': '*',
            },
          });
        } else {
          console.log(`❌ Item ${id} returned ${upstreamRes.status} at: ${url}`);
        }
      } catch (e) {
        // Try next candidate
        console.log(`❌ Item ${id} fetch error at ${url}:`, e.message);
      }
    }

    console.log(`⚠️  Item ${id} not found, returning placeholder`);

    // Return transparent placeholder instead of 404
    return new Response(PLACEHOLDER_PNG, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
        'X-Placeholder': 'true',
      },
    });
  } catch (error) {
    // Return placeholder on error
    return new Response(PLACEHOLDER_PNG, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
}

