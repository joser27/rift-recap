// lib/riotApi.js
// Rate limiting helper
import pLimit from 'p-limit';
const limit = pLimit(20); // Max 20 concurrent requests

export const REGIONS = {
  AMERICAS: 'americas',
  ASIA: 'asia',
  EUROPE: 'europe',
  SEA: 'sea'
};

export const PLATFORMS = {
  NA1: 'na1',
  EUW1: 'euw1',
  EUN1: 'eun1',
  KR: 'kr',
  BR1: 'br1',
  LA1: 'la1', // LAN
  LA2: 'la2', // LAS
  OC1: 'oc1',
  RU: 'ru',
  TR1: 'tr1',
  JP1: 'jp1',
  PH2: 'ph2',
  SG2: 'sg2',
  TH2: 'th2',
  TW2: 'tw2',
  VN2: 'vn2',
  PBE1: 'pbe1'
};

// Helper function to make Riot API calls with retry logic
async function riotRequest(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'X-Riot-Token': process.env.RIOT_API_KEY
        }
      });

      if (res.ok) {
        return await res.json();
      }

      if (res.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = res.headers.get('Retry-After') || 2;
        console.log(`Rate limited, waiting ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (res.status === 404) {
        throw new Error('Not found');
      }

      throw new Error(`API error: ${res.status}`);
    } catch (error) {
      if (i === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Get PUUID from Riot ID
export async function getAccountByRiotId(gameName, tagLine = 'NA1', region = REGIONS.AMERICAS) {
  const url = `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return await riotRequest(url);
}

// Get summoner data by PUUID
export async function getSummonerByPuuid(puuid, platform = PLATFORMS.NA1) {
  const url = `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  const result = await riotRequest(url);
  console.log('Raw summoner API response:', JSON.stringify(result, null, 2));
  return result;
}

// Get ranked data for a summoner (by encrypted summoner ID)
export async function getRankedStats(summonerId, platform = PLATFORMS.NA1) {
  const url = `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`;
  return await riotRequest(url);
}

// Get ranked data by PUUID (newer endpoint, not all regions support it yet)
export async function getRankedStatsByPuuid(puuid, platform = PLATFORMS.NA1) {
  // Note: This endpoint might not be available in all regions
  const url = `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
  return await riotRequest(url);
}

// Get top champion mastery for a summoner (by summonerId, not PUUID)
export async function getChampionMasteryTop(summonerId, count = 5, platform = PLATFORMS.NA1) {
  const url = `https://${platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-summoner/${encodeURIComponent(summonerId)}/top?count=${count}`;
  return await riotRequest(url);
}

// Some regions/contexts support fetching mastery by PUUID directly
export async function getChampionMasteryTopByPuuid(puuid, count = 5, platform = PLATFORMS.NA1) {
  const url = `https://${platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}/top?count=${count}`;
  return await riotRequest(url);
}

// Get match IDs for a PUUID (with pagination support)
export async function getMatchIds(puuid, count = 20, start = 0, region = REGIONS.AMERICAS) {
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=${start}&count=${count}`;
  return await riotRequest(url);
}

// Get single match detail
export async function getMatchDetail(matchId, region = REGIONS.AMERICAS) {
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
  return await riotRequest(url);
}

// Get multiple matches in parallel (respecting rate limits)
export async function getMatchesParallel(matchIds, region = REGIONS.AMERICAS) {
  console.log(`Fetching ${matchIds.length} matches in parallel...`);
  const startTime = Date.now();
  
  const matches = await Promise.all(
    matchIds.map(matchId => 
      limit(() => getMatchDetail(matchId, region))
    )
  );
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Fetched ${matches.length} matches in ${duration}s`);
  
  return matches;
}

// Get full player profile
export async function getPlayerProfile(gameName, tagLine = 'NA1') {
  console.log(`Fetching profile for ${gameName}#${tagLine}...`);
  
  // Get account
  const account = await getAccountByRiotId(gameName, tagLine);
  const { puuid } = account;
  
  // Get summoner data
  const summoner = await getSummonerByPuuid(puuid);
  console.log('Summoner object:', summoner);
  
  // Get ranked stats (try, but don't fail if unavailable)
  let rankedStats = null;
  try {
    // Try PUUID-based endpoint first (newer, more reliable)
    console.log(`Fetching ranked stats for PUUID...`);
    try {
      rankedStats = await getRankedStatsByPuuid(puuid);
      console.log(`✅ Ranked stats fetched via PUUID:`, rankedStats);
    } catch (puuidError) {
      // If PUUID endpoint fails, try encrypted summoner ID (if available)
      const summonerId = summoner.id || summoner.summonerId;
      if (summonerId) {
        console.log(`Trying with summoner ID: ${summonerId}...`);
        rankedStats = await getRankedStats(summonerId);
        console.log(`✅ Ranked stats fetched via ID:`, rankedStats);
      } else {
        throw new Error('No summoner ID or PUUID endpoint available');
      }
    }
  } catch (e) {
    console.log('❌ No ranked data available or error fetching:', e.message);
  }
  
  // Get match IDs (start with 20)
  const matchIds = await getMatchIds(puuid, 20, 0);
  
  // Get match details in parallel
  const matches = await getMatchesParallel(matchIds);
  
  return {
    account,
    summoner,
    rankedStats,
    matches
  };
}

// Fetch additional matches for an existing profile (pagination)
export async function getAdditionalMatches(puuid, start = 20, count = 20, region = REGIONS.AMERICAS) {
  console.log(`Fetching ${count} additional matches starting from index ${start}...`);
  
  // Get match IDs
  const matchIds = await getMatchIds(puuid, count, start, region);
  
  if (matchIds.length === 0) {
    console.log('No more matches available');
    return [];
  }
  
  // Get match details in parallel
  const matches = await getMatchesParallel(matchIds, region);
  
  return matches;
}