// Proxies champion square icons through our domain to avoid ORB/CORS issues
// Usage: /api/champion-icon?id=67
import { NextResponse } from 'next/server';

const CDRAGON_PRIMARY = (id) => `https://cdn.communitydragon.org/latest/champion/${id}/square`;
const CDRAGON_FALLBACK = (id) => `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png`;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing required query param: id' }, { status: 400 });
    }

    const candidates = [CDRAGON_PRIMARY(id), CDRAGON_FALLBACK(id)];

    for (const url of candidates) {
      try {
        const upstreamRes = await fetch(url, { cache: 'no-store' });
        if (upstreamRes.ok) {
          const contentType = upstreamRes.headers.get('content-type') || 'image/png';
          const buf = await upstreamRes.arrayBuffer();
          return new Response(buf, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              // Cache on the edge; safe to revalidate occasionally
              'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
              'X-Upstream-URL': url,
            },
          });
        }
      } catch (e) {
        // Try next candidate
      }
    }

    return NextResponse.json({ error: 'Icon not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to proxy icon', message: error.message }, { status: 500 });
  }
}


