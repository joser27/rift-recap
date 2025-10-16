// Proxies summoner spell icons through our domain to avoid ORB/CORS issues
// Usage: /api/summoner-spell?id=4 (Flash)
import { NextResponse } from 'next/server';

// Map summoner spell IDs to their image names
const SPELL_MAP = {
  1: 'summonerboost',      // Cleanse
  3: 'summonerexhaust',    // Exhaust
  4: 'summonerflash',      // Flash
  6: 'summonerhaste',      // Ghost
  7: 'summonerheal',       // Heal
  11: 'summonersmite',     // Smite
  12: 'summonerteleport',  // Teleport
  13: 'summonermana',      // Clarity
  14: 'summonerdot',       // Ignite
  21: 'summonerbarrier',   // Barrier
  30: 'summonerpororecall',// To the King! (ARAM)
  31: 'summonerporopounce', // Poro Toss (ARAM)
  32: 'summonersnowball',  // Mark/Dash (ARAM/Snowball)
  39: 'summonerultimatespellbook', // URF Placeholder
  54: 'summonerclarity',   // Clarity (alternative)
  55: 'summonerheal',      // Heal (alternative)
  2201: 'summonerheal',    // Arena Heal
  2202: 'summonerexhaust', // Arena Exhaust
};

// Data Dragon version (update when new League patch releases)
const DD_VERSION = '15.20.1'; // Current as of Oct 2025

// Data Dragon spell icon mapping (spellId -> Data Dragon name)
const DD_SPELL_NAMES = {
  1: 'SummonerBoost',     // Cleanse
  3: 'SummonerExhaust',
  4: 'SummonerFlash',
  6: 'SummonerHaste',     // Ghost
  7: 'SummonerHeal',
  11: 'SummonerSmite',
  12: 'SummonerTeleport',
  14: 'SummonerDot',      // Ignite
  21: 'SummonerBarrier',
  32: 'SummonerSnowball', // Mark/Dash (ARAM)
};

const DATA_DRAGON = (spellId) => {
  const name = DD_SPELL_NAMES[parseInt(spellId)];
  return name ? `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/spell/${name}.png` : null;
};

const CDRAGON_BASE = (spellName) => 
  `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/${spellName}.png`;

// Placeholder transparent 1x1 PNG for missing/unknown spells
const PLACEHOLDER_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing required query param: id' }, { status: 400 });
    }

    // Try Data Dragon first
    const ddUrl = DATA_DRAGON(id);
    if (ddUrl) {
      try {
        console.log(`Trying Data Dragon for spell ${id}: ${ddUrl}`);
        const upstreamRes = await fetch(ddUrl, { cache: 'no-store' });
        if (upstreamRes.ok) {
          const contentType = upstreamRes.headers.get('content-type') || 'image/png';
          const buf = await upstreamRes.arrayBuffer();
          console.log(`✅ Spell ${id} found via Data Dragon`);
          return new Response(buf, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
              'X-Source': 'DataDragon',
            },
          });
        }
      } catch (e) {
        console.log(`❌ Data Dragon failed for spell ${id}`);
      }
    }

    // Fallback to Community Dragon
    const spellName = SPELL_MAP[parseInt(id)];
    if (spellName) {
      try {
        const url = CDRAGON_BASE(spellName);
        console.log(`Trying Community Dragon for spell ${id}: ${url}`);
        const upstreamRes = await fetch(url, { cache: 'no-store' });
        if (upstreamRes.ok) {
          const contentType = upstreamRes.headers.get('content-type') || 'image/png';
          const buf = await upstreamRes.arrayBuffer();
          console.log(`✅ Spell ${id} (${spellName}) found via Community Dragon`);
          return new Response(buf, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
              'X-Spell-Name': spellName,
            },
          });
        }
      } catch (e) {
        console.log(`❌ Community Dragon failed for spell ${id}`);
      }
    }

    // Return placeholder if fetch fails
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

