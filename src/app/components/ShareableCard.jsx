'use client';

import { useRef } from 'react';
import html2canvas from 'html2canvas';

export default function ShareableCard({ profile, insights, mastery = [], onClose }) {
  const cardRef = useRef(null);

  // Extract data
  const gameName = profile?.account?.gameName || 'Summoner';
  const level = profile?.summoner?.summonerLevel || 0;
  
  // Get ranked info (same logic as main page)
  let rank = 'Unranked';
  if (profile?.rankedStats && profile.rankedStats.length > 0) {
    const soloQueue = profile.rankedStats.find(r => r.queueType === 'RANKED_SOLO_5x5');
    const flexQueue = profile.rankedStats.find(r => r.queueType === 'RANKED_FLEX_SR');
    const ranked = soloQueue || flexQueue;
    if (ranked) {
      rank = `${ranked.tier.charAt(0) + ranked.tier.slice(1).toLowerCase()} ${ranked.rank}`;
    }
  }
  
  const nickname = insights?.nickname || 'The Player';
  
  // Calculate stats from RANKED SOLO QUEUE matches only (queueId 420)
  const allMatches = profile?.matches || [];
  const puuid = profile?.account?.puuid;
  
  // Filter for Ranked Solo Queue only
  const rankedMatches = allMatches.filter(m => m?.info?.queueId === 420);
  const matches = rankedMatches.length > 0 ? rankedMatches : allMatches; // Fallback to all if no ranked
  
  const participants = matches
    .map(m => m?.info?.participants?.find(p => p?.puuid === puuid))
    .filter(Boolean);

  const totalGames = participants.length;
  const wins = participants.filter(p => p?.win).length;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  // Calculate KDA
  const totalKills = participants.reduce((sum, p) => sum + (p?.kills || 0), 0);
  const totalDeaths = participants.reduce((sum, p) => sum + (p?.deaths || 0), 0);
  const totalAssists = participants.reduce((sum, p) => sum + (p?.assists || 0), 0);
  const kda = totalDeaths > 0
    ? ((totalKills + totalAssists) / totalDeaths).toFixed(1)
    : ((totalKills + totalAssists) || 0).toFixed(1);
  
  // Get top champion (prefer mastery; fallback to most played champion in matches)
  const topMastery = Array.isArray(mastery) && mastery.length > 0 ? mastery[0] : null;
  const topMasteryPoints = topMastery?.championPoints
    ? (topMastery.championPoints >= 1_000_000
        ? (topMastery.championPoints / 1_000_000).toFixed(1) + 'M'
        : (topMastery.championPoints / 1_000).toFixed(0) + 'K')
    : '0';

  function resolveChampionName(championId) {
    if (!championId) return null;
    // Try to resolve from this player's matches first
    for (const m of matches) {
      const p = m?.info?.participants?.find(x => x?.puuid === puuid);
      if (p && (p.championId === championId || p.championName)) {
        if (p.championId === championId) return p.championName;
      }
      // Fallback: any participant with this championId
      const any = m?.info?.participants?.find(x => x?.championId === championId);
      if (any?.championName) return any.championName;
    }
    return null;
  }

  // Fallback: most played champion by this player if no mastery
  function mostPlayedChampionName() {
    const counts = new Map();
    for (const p of participants) {
      if (!p?.championName) continue;
      counts.set(p.championName, (counts.get(p.championName) || 0) + 1);
    }
    let best = null, bestCount = 0;
    for (const [name, count] of counts.entries()) {
      if (count > bestCount) { best = name; bestCount = count; }
    }
    return best;
  }

  const topChampionName = topMastery
    ? (resolveChampionName(topMastery.championId) || 'Champion')
    : (mostPlayedChampionName() || 'Champion');
  
  // Generate surprising stat
  const avgGameTime = participants.length > 0
    ? Math.round(matches.reduce((sum, m) => sum + ((m?.info?.gameDuration) || 0), 0) / participants.length / 60)
    : 0;
  
  // Get personality insight (first sentence of summary)
  const personalityInsight = insights?.summary 
    ? insights.summary.split('.')[0] + '.'
    : 'A dedicated League player with unique playstyle.';

  // --- Derived Insights for Wrapped Sections ---
  // Champion games map
  const gamesByChampion = new Map();
  for (const p of participants) {
    if (!p?.championName) continue;
    gamesByChampion.set(p.championName, (gamesByChampion.get(p.championName) || 0) + 1);
  }
  let mostPlayed = null, mostPlayedGames = 0;
  for (const [name, count] of gamesByChampion.entries()) {
    if (count > mostPlayedGames) { mostPlayed = name; mostPlayedGames = count; }
  }

  // Average local time of game start
  function avgStartTime(minutes) {
    if (minutes.length === 0) return null;
    const avg = Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length);
    const h = Math.floor(avg / 60);
    const m = avg % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = ((h + 11) % 12) + 1;
    const mm = m.toString().padStart(2, '0');
    return `${hh}:${mm} ${ampm}`;
  }
  const startMinutes = matches
    .map(m => (m?.info?.gameStartTimestamp ?? m?.info?.gameCreation))
    .filter(Boolean)
    .map(ts => {
      const d = new Date(ts);
      return d.getHours() * 60 + d.getMinutes();
    });
  const avgStart = avgStartTime(startMinutes);

  // Longest win streak (assumes matches ordered recent->oldest)
  let longestStreak = 0, cur = 0;
  for (const p of participants) {
    if (p?.win) { cur += 1; longestStreak = Math.max(longestStreak, cur); } else { cur = 0; }
  }

  // KDA improvement: first half vs second half
  function kdaFor(list) {
    const k = list.reduce((s, p) => s + (p?.kills || 0), 0);
    const d = list.reduce((s, p) => s + (p?.deaths || 0), 0);
    const a = list.reduce((s, p) => s + (p?.assists || 0), 0);
    return d > 0 ? (k + a) / d : (k + a);
  }
  const mid = Math.floor(participants.length / 2) || 1;
  const kdaEarly = kdaFor(participants.slice(mid));
  const kdaLate = kdaFor(participants.slice(0, mid));
  const kdaImprovementPct = kdaEarly > 0 ? Math.round(((kdaLate - kdaEarly) / kdaEarly) * 100) : 0;

  // Lobby averages for personality/social proof
  const allLobbyParticipants = matches.flatMap(m => m?.info?.participants || []);
  const lobbyDeathsAvg = allLobbyParticipants.length
    ? allLobbyParticipants.reduce((s, x) => s + (x?.deaths || 0), 0) / allLobbyParticipants.length
    : 0;
  const playerDeathsAvg = participants.length
    ? participants.reduce((s, x) => s + (x?.deaths || 0), 0) / participants.length
    : 0;
  const deathsOverAvgPct = lobbyDeathsAvg > 0 ? Math.round(((playerDeathsAvg - lobbyDeathsAvg) / lobbyDeathsAvg) * 100) : 0;

  const playerVisionAvg = participants.length
    ? participants.reduce((s, x) => s + (x?.visionScore || 0), 0) / participants.length
    : 0;
  const lobbyVisionScores = allLobbyParticipants.map(x => x?.visionScore || 0).sort((a, b) => a - b);
  function percentileRank(values, v) {
    if (!values.length) return 0;
    let i = 0;
    while (i < values.length && values[i] <= v) i++;
    return Math.round((i / values.length) * 100);
  }
  const visionPercentile = percentileRank(lobbyVisionScores, playerVisionAvg);

  // Most deaths in a single game
  const mostDeaths = participants.reduce((max, p) => Math.max(max, p?.deaths || 0), 0);

  // Build sections
  const surprisingList = [];
  if (mostPlayed && totalGames > 0) {
    surprisingList.push(`You played ${mostPlayedGames} games on ${mostPlayed} (${Math.round((mostPlayedGames / totalGames) * 100)}% of your games)`);
  }
  if (avgStart) {
    surprisingList.push(`Your average game start time: ${avgStart}`);
  }
  if (mostDeaths > 0) {
    surprisingList.push(`Most deaths in a single game: ${mostDeaths}`);
  }
  if (longestStreak > 1) {
    surprisingList.push(`Longest win streak: ${longestStreak} games`);
  }
  if (participants.length >= 6 && isFinite(kdaImprovementPct)) {
    surprisingList.push(`Your KDA changed ${kdaImprovementPct > 0 ? '+' : ''}${kdaImprovementPct}% from early to recent games`);
  }

  const personalityList = [];
  if (totalGames > 0 && mostPlayedGames > 0) {
    const top3Count = Array.from(gamesByChampion.values()).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
    personalityList.push(`You're a Comfort Pick player (${Math.round((top3Count / totalGames) * 100)}% of games on your top 3 champions)`);
  }
  if (deathsOverAvgPct > 10) {
    personalityList.push(`Your playstyle: Aggressive (${deathsOverAvgPct}% higher deaths than lobby average)`);
  } else if (deathsOverAvgPct < -10) {
    personalityList.push(`Your playstyle: Safe (${Math.abs(deathsOverAvgPct)}% fewer deaths than lobby average)`);
  }

  const socialProofList = [];
  if (visionPercentile) {
    socialProofList.push(`You outperformed ${visionPercentile}% of players in your lobbies for vision score`);
  }

  // Download as image
  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2, // Higher quality
        logging: false,
      });
      
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${gameName}-league-recap.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Failed to generate image:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 overflow-y-auto">
      <div className="min-h-full flex items-start justify-center py-8 px-4">
        <div className="relative w-full mx-auto" style={{ maxWidth: '600px' }}>
          {/* Close button */}
          <button
            onClick={onClose}
            className="sticky top-8 float-right text-3xl z-10 mb-4 bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center"
            style={{ color: '#ffffff' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#d1d5db'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#ffffff'}
          >
            ✕
          </button>

          {/* Preview Card - Scrollable container */}
          <div className="clear-both mb-8 overflow-hidden rounded-lg shadow-2xl">
          <div
            ref={cardRef}
            className="p-8 mx-auto flex flex-col gap-5"
            style={{ background: 'linear-gradient(135deg, #9333ea 0%, #3b82f6 50%, #ec4899 100%)', color: '#ffffff', width: '100%', maxWidth: '540px' }}
          >
            {/* Header */}
            <div>
              <div className="text-xs font-semibold tracking-wider mb-2" style={{ opacity: 0.9 }}>
                YOUR LEAGUE LEGACY
              </div>
              <div className="h-0.5 w-12 rounded" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}></div>
            </div>

            {/* Nickname - Spotify style big text */}
            <div className="text-center my-6">
              <div className="text-4xl md:text-5xl font-bold leading-tight mb-3" style={{ color: '#dbeafe' }}>
                "{nickname}"
              </div>
              <div className="text-2xl font-medium mb-2" style={{ color: '#bfdbfe' }}>
                {gameName}
              </div>
              <div className="text-base" style={{ color: '#d1d5db' }}>
                Level {level} • {rank}
              </div>
            </div>

            {/* Stats Grid - Clean 3 column */}
            <div className="backdrop-blur-sm rounded-xl p-6" style={{ backgroundColor: 'rgba(17, 24, 39, 0.4)', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
              <div className="text-xs font-semibold tracking-wider mb-4 uppercase text-center" style={{ color: '#93c5fd' }}>
                📊 Ranked Solo Stats
              </div>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-xs mb-2 uppercase tracking-wide" style={{ color: '#9ca3af' }}>Games</div>
                  <div className="text-3xl font-bold" style={{ color: '#93c5fd' }}>{totalGames}</div>
                </div>
                <div>
                  <div className="text-xs mb-2 uppercase tracking-wide" style={{ color: '#9ca3af' }}>Win Rate</div>
                  <div className="text-3xl font-bold" style={{ color: '#86efac' }}>{winRate}%</div>
                </div>
                <div>
                  <div className="text-xs mb-2 uppercase tracking-wide" style={{ color: '#9ca3af' }}>KDA</div>
                  <div className="text-3xl font-bold" style={{ color: '#d8b4fe' }}>{kda}</div>
                </div>
              </div>
            </div>

            {/* Top Champion */}
            <div className="backdrop-blur-sm rounded-xl p-6" style={{ backgroundColor: 'rgba(30, 58, 138, 0.3)', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
              <div className="text-xs font-semibold tracking-wider mb-3 uppercase" style={{ color: '#93c5fd' }}>
                👑 Top Champion
              </div>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold" style={{ color: '#bfdbfe' }}>{topChampionName}</span>
                <span className="text-xl font-bold" style={{ color: '#93c5fd' }}>{topMasteryPoints} Points</span>
              </div>
            </div>

            {/* Wrapped Stats - Vertical Stack */}
            {surprisingList.length > 0 && (
              <div className="backdrop-blur-sm rounded-xl p-6" style={{ backgroundColor: 'rgba(113, 63, 18, 0.3)', border: '1px solid rgba(234, 179, 8, 0.4)' }}>
                <div className="text-xs font-semibold tracking-wider mb-3 uppercase" style={{ color: '#fde047' }}>
                  ✨ Surprising Stats
                </div>
                <div className="space-y-2">
                  {surprisingList.slice(0, 3).map((s, i) => (
                    <div key={`surprise-${i}`} className="text-sm leading-relaxed" style={{ color: '#e5e7eb' }}>
                      • {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Playstyle */}
            <div className="backdrop-blur-sm rounded-xl p-6" style={{ backgroundColor: 'rgba(88, 28, 135, 0.3)', border: '1px solid rgba(168, 85, 247, 0.4)' }}>
              <div className="text-xs font-semibold tracking-wider mb-3 uppercase" style={{ color: '#d8b4fe' }}>
                🤖 AI Analysis
              </div>
              <div className="text-base leading-relaxed italic" style={{ color: '#e5e7eb' }}>
                {personalityInsight}
              </div>
            </div>

            {/* Social Proof */}
            {socialProofList.length > 0 && (
              <div className="backdrop-blur-sm rounded-xl p-6" style={{ backgroundColor: 'rgba(17, 24, 39, 0.4)', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
                <div className="text-xs font-semibold tracking-wider mb-3 uppercase" style={{ color: '#93c5fd' }}>
                  🌟 Performance Rank
                </div>
                <div className="space-y-2">
                  {socialProofList.slice(0, 2).map((s, i) => (
                    <div key={`social-${i}`} className="text-sm leading-relaxed" style={{ color: '#e5e7eb' }}>
                      • {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
              <div className="flex justify-between items-center text-xs" style={{ color: '#d1d5db' }}>
                <span>Powered by AWS Bedrock</span>
                <span>rift-recap.vercel.app</span>
              </div>
            </div>
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          className="w-full font-bold py-3 md:py-4 rounded-lg transition-all transform hover:scale-105 text-sm md:text-base shadow-lg"
          style={{ background: 'linear-gradient(90deg, #2563eb 0%, #9333ea 100%)', color: '#ffffff' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(90deg, #1d4ed8 0%, #7e22ce 100%)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(90deg, #2563eb 0%, #9333ea 100%)'}
        >
          📥 Download Your League Recap
        </button>

        <p className="text-center mt-2 md:mt-3 text-xs md:text-sm" style={{ color: '#d1d5db' }}>
          Share your recap on social media!
        </p>
        </div>
      </div>
    </div>
  );
}

