'use client';

import { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Trophy, TrendingUp, Sparkles, BarChart3, X } from 'lucide-react';

export default function ShareableCard({ profile, insights, mastery = [], allMatches = [], onClose }) {
  const cardRef = useRef(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  
  // Card type options
  const cardTypes = [
    { 
      id: 'personality', 
      label: 'Your Champion Personality', 
      description: 'Share your AI-powered personality insights',
      icon: Sparkles,
      color: 'from-purple-600 to-pink-600'
    },
    { 
      id: 'top3', 
      label: 'Top 3 Champions', 
      description: 'Showcase your most played champions',
      icon: Trophy,
      color: 'from-blue-600 to-cyan-600'
    },
    { 
      id: 'defining', 
      label: 'Defining Moment', 
      description: 'Highlight your best game performance',
      icon: TrendingUp,
      color: 'from-yellow-500 to-orange-600'
    },
    { 
      id: 'yearreview', 
      label: 'Year in Review', 
      description: 'Overall stats summary',
      icon: BarChart3,
      color: 'from-green-600 to-emerald-600'
    }
  ];
  
  const currentCardType = cardTypes[currentCardIndex].id;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' && currentCardIndex < cardTypes.length - 1) {
        setCurrentCardIndex(currentCardIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentCardIndex > 0) {
        setCurrentCardIndex(currentCardIndex - 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCardIndex, cardTypes.length, onClose]);

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
  const puuid = profile?.account?.puuid;
  
  // Use allMatches prop (passed from parent) or fallback to profile matches
  const matchesToUse = allMatches.length > 0 ? allMatches : (profile?.matches || []);
  
  // Filter for Ranked Solo Queue only
  const rankedMatches = matchesToUse.filter(m => m?.info?.queueId === 420);
  const matches = rankedMatches.length > 0 ? rankedMatches : matchesToUse; // Fallback to all if no ranked
  
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

  // Helper function to get champion icon URL
  const getChampionIconSrc = (championId) => {
    if (!championId) return '';
    return `/api/champion-icon?id=${encodeURIComponent(championId)}`;
  };

  // Helper to resolve champion name from ID
  function resolveChampionName(championId) {
    if (!championId) return null;
    const matches = allMatches.length > 0 ? allMatches : (profile?.matches || []);
    const puuid = profile?.account?.puuid;
    
    for (const m of matches) {
      const p = m?.info?.participants?.find(x => x?.puuid === puuid);
      if (p && (p.championId === championId || p.championName)) {
        if (p.championId === championId) return p.championName;
      }
      const any = m?.info?.participants?.find(x => x?.championId === championId);
      if (any?.championName) return any.championName;
    }
    return null;
  }

  // Navigation handlers
  const handleNext = () => {
    if (currentCardIndex < cardTypes.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
    }
  };

  // Helper to convert oklab/oklch colors to RGB
  const convertModernColors = (element) => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1;
    tempCanvas.height = 1;
    const ctx = tempCanvas.getContext('2d');
    
    const convertColor = (color) => {
      if (!color || color === 'none' || color === 'transparent' || (!color.includes('oklab') && !color.includes('oklch'))) {
        return color;
      }
      try {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return a < 255 ? `rgba(${r}, ${g}, ${b}, ${a / 255})` : `rgb(${r}, ${g}, ${b})`;
      } catch (e) {
        return color;
      }
    };
    
    return convertColor;
  };

  // Download as image - with color conversion for Tailwind v4 compatibility
  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    try {
      // Preload all images to avoid re-fetching during html2canvas
      const images = cardRef.current.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map(img => {
          if (!img.complete) {
            return new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve; // Continue even if image fails
            });
          }
          return Promise.resolve();
        })
      );
      
      // Store original inline styles and apply converted colors
      const elementsWithStyles = [];
      const colorConverter = convertModernColors(cardRef.current);
      const allElements = cardRef.current.querySelectorAll('*');
      
      allElements.forEach(el => {
        const computed = window.getComputedStyle(el);
        const originalInlineStyle = el.getAttribute('style') || '';
        const colorProps = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'];
        
        colorProps.forEach(prop => {
          const value = computed.getPropertyValue(prop);
          if (value && (value.includes('oklab') || value.includes('oklch'))) {
            const converted = colorConverter(value);
            el.style.setProperty(prop, converted, 'important');
          }
        });
        
        elementsWithStyles.push({ el, originalInlineStyle });
      });
      
      // Render with html2canvas
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        windowWidth: cardRef.current.scrollWidth,
        windowHeight: cardRef.current.scrollHeight,
        onclone: (clonedDoc) => {
          // Ensure fonts are loaded and visible
          const clonedBody = clonedDoc.body;
          const allElements = clonedBody.querySelectorAll('*');
          allElements.forEach(el => {
            const computed = window.getComputedStyle(el);
            // Force font rendering
            el.style.fontFamily = computed.fontFamily;
            el.style.fontSize = computed.fontSize;
            el.style.fontWeight = computed.fontWeight;
            // Ensure no text clipping
            if (computed.textOverflow === 'ellipsis' || el.classList.contains('truncate')) {
              el.style.textOverflow = 'clip';
              el.style.overflow = 'visible';
              el.style.whiteSpace = 'nowrap';
            }
          });
        },
      });
      
      // Restore original inline styles
      elementsWithStyles.forEach(({ el, originalInlineStyle }) => {
        if (originalInlineStyle) {
          el.setAttribute('style', originalInlineStyle);
        } else {
          el.removeAttribute('style');
        }
      });
      
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const cardType = cardTypes[currentCardIndex];
        link.download = `${gameName}-${cardType?.label.replace(/\s+/g, '-').toLowerCase()}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Failed to generate image:', error);
    }
  };

  // Render carousel-style cards
  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 overflow-y-auto">
      <div className="min-h-full flex items-start justify-center py-4 md:py-8 px-4">
        <div className="relative w-full mx-auto" style={{ maxWidth: '600px' }}>
          {/* Header with progress indicators and close button */}
          <div className="sticky top-4 z-10 mb-4">
            <div className="flex justify-between items-center mb-3">
              {/* Progress indicators (like Instagram/Snapchat stories) */}
              <div className="flex-1 flex gap-1.5 mr-4">
                {cardTypes.map((_, index) => (
                  <div
                    key={index}
                    className="h-1 flex-1 rounded-full overflow-hidden bg-gray-700"
                  >
                    <div
                      className={`h-full transition-all duration-300 ${
                        index < currentCardIndex 
                          ? 'w-full bg-white' 
                          : index === currentCardIndex 
                          ? 'w-full bg-white' 
                          : 'w-0 bg-gray-700'
                      }`}
                    />
                  </div>
                ))}
              </div>
              
          {/* Close button */}
          <button
            onClick={onClose}
                className="bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full w-10 h-10 flex items-center justify-center transition shrink-0"
              >
                <X size={24} />
              </button>
            </div>

            {/* Card title */}
            <div className="text-center">
              <h3 className="text-white text-lg font-bold">
                {cardTypes[currentCardIndex].label}
              </h3>
              <p className="text-gray-400 text-sm">
                {currentCardIndex + 1} of {cardTypes.length}
              </p>
            </div>
          </div>

          {/* Card Preview with fade transition - Fixed height */}
          <div className="mb-6 rounded-lg shadow-2xl" style={{ height: '650px' }}>
            <div className="h-full transition-opacity duration-300">
              {currentCardType === 'personality' && renderPersonalityCard()}
              {currentCardType === 'top3' && renderTop3Card()}
              {currentCardType === 'defining' && renderDefiningMomentCard()}
              {currentCardType === 'yearreview' && renderYearReviewCard()}
            </div>
          </div>

          {/* Navigation and Download Controls */}
          <div className="space-y-3">
            {/* Previous/Next buttons */}
            <div className="flex gap-3">
              <button
                onClick={handlePrevious}
                disabled={currentCardIndex === 0}
                className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                ← Previous
              </button>
              <button
                onClick={handleNext}
                disabled={currentCardIndex === cardTypes.length - 1}
                className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                Next →
              </button>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="w-full font-bold py-3 md:py-4 rounded-lg transition-all transform hover:scale-105 text-sm md:text-base shadow-lg"
              style={{ background: 'linear-gradient(90deg, #2563eb 0%, #9333ea 100%)', color: '#ffffff' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(90deg, #1d4ed8 0%, #7e22ce 100%)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(90deg, #2563eb 0%, #9333ea 100%)'}
            >
              📥 Download This Card
          </button>

            <p className="text-center text-xs md:text-sm text-gray-400">
              Browse through all cards and download your favorites!
            </p>
            <p className="text-center text-xs text-gray-500 mt-1">
              💡 Use arrow keys ← → to navigate
            </p>
          </div>
        </div>
      </div>
    </div>
  );
  
  // Card rendering functions with consistent structure
  function renderPersonalityCard() {
    const personalityInsight = insights?.summary || 'A dedicated League player with unique playstyle.';
    const nickname = insights?.nickname || 'The Player';
    
    return (
      <div
        ref={cardRef}
        className="p-5 mx-auto flex flex-col justify-between h-full"
        style={{ 
          background: 'linear-gradient(135deg, #9333ea 0%, #3b82f6 50%, #ec4899 100%)', 
          color: '#ffffff', 
          width: '100%', 
          maxWidth: '540px'
        }}
      >
        {/* Compact Header */}
        <div className="mb-2">
          <div className="text-[10px] font-bold tracking-widest mb-1" style={{ opacity: 0.95 }}>
            YOUR CHAMPION PERSONALITY
          </div>
          <div className="h-0.5 w-10 rounded" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}></div>
        </div>

        {/* Compact Player Info */}
        <div className="text-center mb-3">
          <div className="text-2xl font-bold leading-tight mb-1" style={{ color: '#dbeafe' }}>
            &quot;{nickname}&quot;
          </div>
          <div className="text-base font-medium mb-0.5" style={{ color: '#bfdbfe' }}>
            {gameName}
          </div>
          <div className="text-[10px]" style={{ color: '#d1d5db' }}>
            Level {level} • {rank}
          </div>
        </div>

        {/* Section 1: AI Analysis - Most important, give it more space */}
        <div className="rounded-lg p-3 mb-2" style={{ backgroundColor: 'rgba(88, 28, 135, 0.4)', border: '1px solid rgba(168, 85, 247, 0.4)' }}>
          <div className="text-[10px] font-bold tracking-wide mb-1.5 uppercase" style={{ color: '#d8b4fe' }}>
            🤖 AI Analysis
          </div>
          <div className="text-xs leading-snug" style={{ color: '#e5e7eb' }}>
            {personalityInsight}
          </div>
        </div>

        {/* Section 2: Compact Inline Stats */}
        <div className="rounded-lg p-2.5 mb-2" style={{ backgroundColor: 'rgba(17, 24, 39, 0.4)', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
          <div className="flex justify-around" style={{ height: '36px', alignItems: 'center' }}>
            <div className="text-center" style={{ lineHeight: '1' }}>
              <div className="text-[9px] font-semibold uppercase mb-1" style={{ color: '#9ca3af', letterSpacing: '0.5px', lineHeight: '1.2' }}>GAMES</div>
              <div className="text-lg font-bold" style={{ color: '#93c5fd', lineHeight: '1' }}>{totalGames}</div>
            </div>
            <div className="w-px h-8" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}></div>
            <div className="text-center" style={{ lineHeight: '1' }}>
              <div className="text-[9px] font-semibold uppercase mb-1" style={{ color: '#9ca3af', letterSpacing: '0.5px', lineHeight: '1.2' }}>WIN RATE</div>
              <div className="text-lg font-bold" style={{ color: '#86efac', lineHeight: '1' }}>{winRate}%</div>
            </div>
            <div className="w-px h-8" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}></div>
            <div className="text-center" style={{ lineHeight: '1' }}>
              <div className="text-[9px] font-semibold uppercase mb-1" style={{ color: '#9ca3af', letterSpacing: '0.5px', lineHeight: '1.2' }}>KDA</div>
              <div className="text-lg font-bold" style={{ color: '#d8b4fe', lineHeight: '1' }}>{kda}</div>
            </div>
          </div>
        </div>

        {/* Section 3: Compact Highlights */}
        <div className="space-y-1.5 mb-3">
          {insights?.strength && (
            <div className="rounded-lg p-2.5" style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              <div className="text-[10px] font-bold mb-1" style={{ color: '#86efac' }}>
                ⚡ Strength
              </div>
              <div className="text-[11px] leading-tight" style={{ color: '#e5e7eb' }}>
                {insights.strength}
              </div>
            </div>
          )}
          {insights?.funFact && (
            <div className="rounded-lg p-2.5" style={{ backgroundColor: 'rgba(234, 179, 8, 0.2)', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
              <div className="text-[10px] font-bold mb-1" style={{ color: '#fde047' }}>
                💡 Fun Fact
              </div>
              <div className="text-[11px] leading-tight" style={{ color: '#e5e7eb' }}>
                {insights.funFact}
              </div>
            </div>
          )}
        </div>

        {/* Compact Footer */}
        <div className="mt-auto pt-2 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
          <div className="flex justify-between items-center text-[10px]" style={{ color: '#d1d5db' }}>
            <span>Powered by AWS Bedrock</span>
            <span>rift-recap.vercel.app</span>
          </div>
        </div>
      </div>
    );
  }

  function renderTop3Card() {
    const top3 = mastery.slice(0, 3);
    
    return (
      <div
        ref={cardRef}
        className="p-6 mx-auto flex flex-col justify-between h-full"
        style={{ 
          background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)', 
          color: '#ffffff', 
          width: '100%', 
          maxWidth: '540px'
        }}
      >
        {/* Header Badge */}
        <div className="mb-4">
          <div className="text-xs font-semibold tracking-wider mb-1" style={{ opacity: 0.9 }}>
            YOUR TOP CHAMPIONS
          </div>
          <div className="h-0.5 w-12 rounded" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}></div>
        </div>

        {/* Player Info */}
        <div className="text-center mb-5">
          <div className="text-3xl font-bold mb-2" style={{ color: '#dbeafe' }}>
            {gameName}
          </div>
          <div className="text-xs" style={{ color: '#d1d5db' }}>
            Level {level} • {rank}
          </div>
        </div>

        {/* Section 1: Top 3 Champions */}
        <div className="space-y-2.5 mb-3">
          {top3.map((champ, index) => {
            const champName = resolveChampionName(champ.championId) || 'Champion';
            const points = champ.championPoints
              ? (champ.championPoints >= 1_000_000
                  ? (champ.championPoints / 1_000_000).toFixed(1) + 'M'
                  : (champ.championPoints / 1_000).toFixed(0) + 'K')
              : (champ.games ? `${champ.games} games` : 'N/A');
            
            const medals = ['🥇', '🥈', '🥉'];
            
            return (
              <div key={index} className=" rounded-xl p-3" style={{ backgroundColor: 'rgba(30, 58, 138, 0.4)', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                <div className="flex items-center gap-3">
                  <div className="text-xl shrink-0">{medals[index]}</div>
                  <img
                    src={getChampionIconSrc(champ.championId)}
                    alt={champName}
                    className="w-12 h-12 rounded-lg object-cover"
                    style={{ boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.3)' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-bold truncate" style={{ color: '#bfdbfe' }}>
                      {champName}
                </div>
                    <div className="text-sm" style={{ color: '#93c5fd' }}>
                      {points}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Section 2: Stats Grid */}
        <div className=" rounded-xl p-4 mb-3" style={{ backgroundColor: 'rgba(17, 24, 39, 0.4)', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
          <div className="text-xs font-semibold tracking-wider mb-3 uppercase text-center" style={{ color: '#93c5fd' }}>
            Season Stats
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs mb-1 uppercase" style={{ color: '#9ca3af' }}>Games</div>
              <div className="text-xl font-bold" style={{ color: '#93c5fd' }}>{totalGames}</div>
            </div>
            <div>
              <div className="text-xs mb-1 uppercase" style={{ color: '#9ca3af' }}>Win Rate</div>
              <div className="text-xl font-bold" style={{ color: '#86efac' }}>{winRate}%</div>
            </div>
            <div>
              <div className="text-xs mb-1 uppercase" style={{ color: '#9ca3af' }}>KDA</div>
              <div className="text-xl font-bold" style={{ color: '#d8b4fe' }}>{kda}</div>
            </div>
          </div>
        </div>

        {/* Section 3: Champion Pool */}
        <div className=" rounded-lg p-3 mb-4" style={{ backgroundColor: 'rgba(30, 58, 138, 0.3)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <div className="text-xs font-semibold mb-1" style={{ color: '#93c5fd' }}>
            Champion Pool
          </div>
          <div className="text-xs" style={{ color: '#e5e7eb' }}>
            {mastery.length} champions played this season
          </div>
        </div>

            {/* Footer */}
        <div className="mt-auto pt-3 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
              <div className="flex justify-between items-center text-xs" style={{ color: '#d1d5db' }}>
                <span>Powered by AWS Bedrock</span>
                <span>rift-recap.vercel.app</span>
              </div>
            </div>
          </div>
    );
  }

  function renderDefiningMomentCard() {
    // Find best match
    const matches = allMatches.length > 0 ? allMatches : (profile?.matches || []);
    const puuid = profile?.account?.puuid;
    
    const bestMatch = matches.reduce((best, current) => {
      const currentParticipant = current.info.participants.find(p => p.puuid === puuid);
      
      if (!currentParticipant) return best;
      
      const currentScore = (currentParticipant.kills * 3) + (currentParticipant.assists * 2) - (currentParticipant.deaths * 2) + 
                         (currentParticipant.totalDamageDealtToChampions / 1000) + 
                         ((currentParticipant.totalMinionsKilled + currentParticipant.neutralMinionsKilled) / 10) +
                         (currentParticipant.visionScore) +
                         (currentParticipant.win ? 20 : 0);
      
      const bestScore = best ? ((best.kills * 3) + (best.assists * 2) - (best.deaths * 2) + 
                               (best.totalDamageDealtToChampions / 1000) + 
                               ((best.totalMinionsKilled + best.neutralMinionsKilled) / 10) +
                               (best.visionScore) +
                               (best.win ? 20 : 0)) : -Infinity;
      
      return currentScore > bestScore ? currentParticipant : best;
    }, null);

    if (!bestMatch) {
      return (
        <div ref={cardRef} className="h-full flex items-center justify-center">
          <div className="text-center text-white">No match data available</div>
        </div>
      );
    }

    const kdaRatio = ((bestMatch.kills + bestMatch.assists) / Math.max(bestMatch.deaths, 1)).toFixed(2);
    const cs = (bestMatch.totalMinionsKilled || 0) + (bestMatch.neutralMinionsKilled || 0);
    const matchData = matches.find(m => 
      m.info.participants.find(p => p.puuid === puuid) === bestMatch
    );
    const minutes = Math.max(1, Math.floor(matchData?.info.gameDuration / 60));
    const csPerMin = (cs / minutes).toFixed(1);
    const damage = Math.round(bestMatch.totalDamageDealtToChampions / 1000);
    const gameDate = new Date(matchData?.info.gameCreation).toLocaleDateString();
    
    // Calculate team contribution
    const teamKills = matchData?.info.participants
      .filter(p => p.teamId === bestMatch.teamId)
      .reduce((sum, p) => sum + p.kills, 0) || 1;
    const killParticipation = (((bestMatch.kills + bestMatch.assists) / teamKills) * 100).toFixed(0);
    
    return (
      <div
        ref={cardRef}
        className="p-6 mx-auto flex flex-col justify-between h-full"
        style={{ 
          background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', 
          color: '#ffffff', 
          width: '100%', 
          maxWidth: '540px'
        }}
      >
        {/* Header Badge */}
        <div className="mb-4">
          <div className="text-xs font-semibold tracking-wider mb-1" style={{ opacity: 0.9 }}>
            YOUR DEFINING MOMENT
          </div>
          <div className="h-0.5 w-12 rounded" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}></div>
        </div>

        {/* Player Info */}
        <div className="text-center mb-5">
          <div className="text-3xl font-bold mb-2" style={{ color: '#fef3c7' }}>
            {gameName}
          </div>
          <div className="text-xs" style={{ color: '#fde68a' }}>
            {gameDate}
          </div>
        </div>

        {/* Section 1: Champion & KDA */}
        <div className=" rounded-xl p-4 text-center mb-3" style={{ backgroundColor: 'rgba(120, 53, 15, 0.4)', border: '1px solid rgba(251, 191, 36, 0.4)' }}>
          <img
            src={getChampionIconSrc(bestMatch.championId)}
            alt={bestMatch.championName}
            className="w-16 h-16 rounded-xl object-cover mx-auto mb-2"
            style={{ boxShadow: '0 0 0 4px rgba(255, 255, 255, 0.3)' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="text-xl font-bold mb-1" style={{ color: '#fef3c7' }}>
            {bestMatch.championName}
          </div>
          <div className="text-2xl font-bold mb-1" style={{ color: '#ffffff' }}>
            {bestMatch.kills}/{bestMatch.deaths}/{bestMatch.assists}
          </div>
          <div className="text-sm" style={{ color: '#fde68a' }}>
            {kdaRatio} KDA • {bestMatch.win ? 'Victory' : 'Defeat'}
          </div>
        </div>

        {/* Section 2: Performance Stats */}
        <div className=" rounded-xl p-4 mb-3" style={{ backgroundColor: 'rgba(120, 53, 15, 0.3)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
          <div className="text-xs font-semibold tracking-wider mb-3 uppercase text-center" style={{ color: '#fed7aa' }}>
            Performance Highlights
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="text-center">
              <div className="text-xs mb-1 uppercase" style={{ color: '#fed7aa' }}>Damage</div>
              <div className="text-xl font-bold" style={{ color: '#ffffff' }}>{damage}K</div>
            </div>
            <div className="text-center">
              <div className="text-xs mb-1 uppercase" style={{ color: '#fed7aa' }}>CS/min</div>
              <div className="text-xl font-bold" style={{ color: '#ffffff' }}>{csPerMin}</div>
            </div>
            <div className="text-center">
              <div className="text-xs mb-1 uppercase" style={{ color: '#fed7aa' }}>Vision</div>
              <div className="text-xl font-bold" style={{ color: '#ffffff' }}>{bestMatch.visionScore}</div>
            </div>
            <div className="text-center">
              <div className="text-xs mb-1 uppercase" style={{ color: '#fed7aa' }}>Gold</div>
              <div className="text-xl font-bold" style={{ color: '#ffffff' }}>{Math.round(bestMatch.goldEarned / 1000)}K</div>
            </div>
          </div>
        </div>

        {/* Section 3: Team Impact */}
        <div className=" rounded-lg p-3 mb-4" style={{ backgroundColor: 'rgba(120, 53, 15, 0.3)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
          <div className="text-xs font-semibold mb-1" style={{ color: '#fed7aa' }}>
            Team Impact
          </div>
          <div className="text-xs" style={{ color: '#ffffff' }}>
            {killParticipation}% Kill Participation
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-3 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
          <div className="flex justify-between items-center text-xs" style={{ color: '#fef3c7' }}>
            <span>Powered by AWS Bedrock</span>
            <span>rift-recap.vercel.app</span>
          </div>
        </div>
      </div>
    );
  }

  function renderYearReviewCard() {
    return (
      <div
        ref={cardRef}
        className="p-6 mx-auto flex flex-col justify-between h-full"
        style={{ 
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
          color: '#ffffff', 
          width: '100%', 
          maxWidth: '540px'
        }}
      >
        {/* Header Badge */}
        <div className="mb-4">
          <div className="text-xs font-semibold tracking-wider mb-1" style={{ opacity: 0.9 }}>
            YOUR YEAR IN REVIEW
          </div>
          <div className="h-0.5 w-12 rounded" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}></div>
        </div>

        {/* Player Info */}
        <div className="text-center mb-5">
          <div className="text-3xl font-bold mb-2" style={{ color: '#d1fae5' }}>
            {gameName}
          </div>
          <div className="text-xs" style={{ color: '#a7f3d0' }}>
            Level {level} • {rank}
          </div>
        </div>

        {/* Section 1: Main Stats */}
        <div className=" rounded-xl p-4 mb-3" style={{ backgroundColor: 'rgba(6, 78, 59, 0.4)', border: '1px solid rgba(52, 211, 153, 0.4)' }}>
          <div className="text-xs font-semibold tracking-wider mb-3 uppercase text-center" style={{ color: '#a7f3d0' }}>
            📊 Season Stats
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs mb-1 uppercase" style={{ color: '#d1fae5' }}>Games</div>
              <div className="text-xl font-bold" style={{ color: '#ffffff' }}>{totalGames}</div>
            </div>
            <div>
              <div className="text-xs mb-1 uppercase" style={{ color: '#d1fae5' }}>Win Rate</div>
              <div className="text-xl font-bold" style={{ color: '#ffffff' }}>{winRate}%</div>
            </div>
            <div>
              <div className="text-xs mb-1 uppercase" style={{ color: '#d1fae5' }}>KDA</div>
              <div className="text-xl font-bold" style={{ color: '#ffffff' }}>{kda}</div>
            </div>
          </div>
        </div>

        {/* Section 2: Top Champion */}
        {mastery.length > 0 && (
          <div className=" rounded-xl p-4 mb-3" style={{ backgroundColor: 'rgba(6, 78, 59, 0.3)', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
            <div className="text-xs font-semibold tracking-wider mb-2 uppercase" style={{ color: '#a7f3d0' }}>
              👑 Most Played
            </div>
            <div className="flex items-center gap-3">
              <img
                src={getChampionIconSrc(mastery[0].championId)}
                alt="Top champion"
                className="w-12 h-12 rounded-lg object-cover"
                style={{ boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.3)' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold truncate" style={{ color: '#ffffff' }}>
                  {resolveChampionName(mastery[0].championId) || 'Champion'}
                </div>
                <div className="text-sm" style={{ color: '#d1fae5' }}>
                  {mastery[0].championPoints 
                    ? (mastery[0].championPoints >= 1_000_000
                        ? (mastery[0].championPoints / 1_000_000).toFixed(1) + 'M points'
                        : (mastery[0].championPoints / 1_000).toFixed(0) + 'K points')
                    : (mastery[0].games ? `${mastery[0].games} games` : '')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Highlights */}
        {surprisingList.length > 0 && (
          <div className=" rounded-xl p-4 mb-4" style={{ backgroundColor: 'rgba(6, 78, 59, 0.3)', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
            <div className="text-xs font-semibold tracking-wider mb-2 uppercase" style={{ color: '#a7f3d0' }}>
              ✨ Season Highlights
            </div>
            <div className="space-y-1.5">
              {surprisingList.slice(0, 3).map((s, i) => (
                <div key={`surprise-${i}`} className="text-xs leading-relaxed" style={{ color: '#d1fae5' }}>
                  • {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-3 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
          <div className="flex justify-between items-center text-xs" style={{ color: '#d1fae5' }}>
            <span>Powered by AWS Bedrock</span>
            <span>rift-recap.vercel.app</span>
        </div>
      </div>
    </div>
  );
  }
}

