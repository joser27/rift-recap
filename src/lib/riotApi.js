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
  KR: 'kr'
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
  return await riotRequest(url);
}

// Get match IDs for a PUUID
export async function getMatchIds(puuid, count = 20, region = REGIONS.AMERICAS) {
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
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
  
  // Get match IDs
  const matchIds = await getMatchIds(puuid, 20);
  
  // Get match details in parallel
  const matches = await getMatchesParallel(matchIds);
  
  return {
    account,
    summoner,
    matches
  };
}