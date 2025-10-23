// src/app/page.js
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, TrendingUp, UsersRound, Sparkles, Bot, Zap, PawPrint, Share2 } from 'lucide-react';
import PoroAssistant from './components/PoroAssistant';
import DialogueBox from './components/DialogueBox';
import MasteryBubbleChart from './components/MasteryBubbleChart';
import ShareableCard from './components/ShareableCard';
import ProgressChart from './components/ProgressChart';

// Helper function to check for pre-loaded demo data
async function checkDemoAccount(gameName, tagLine) {
  try {
    const filename = `${gameName.toLowerCase()}-${tagLine.toLowerCase()}.json`;
    const res = await fetch(`/demo-data/${filename}`);
    if (res.ok) {
      const data = await res.json();
      // Only use demo if it has matches
      if (data.profile?.matches?.length > 0) {
        return data;
      }
    }
  } catch (e) {
    // Not a demo account, will fetch live
  }
  return null;
}

export default function Home() {
  const [gameName, setGameName] = useState('');
  const [tagLine, setTagLine] = useState('NA1');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [poroState, setPoroState] = useState('idle'); // idle | thinking | ready | talking | laughing
  const [dialogue, setDialogue] = useState("Hi! I'm Poro—search a Summoner name above and I'll fetch insights.");
  const [dialogueVisible, setDialogueVisible] = useState(true);
  const [dialogueLoading, setDialogueLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(null);
  const loadingIntervalRef = useRef(null);
  const revertIdleTimerRef = useRef(null);
  const [currentPoroMatch, setCurrentPoroMatch] = useState(null); // persist match context for followups
  const [showShareCard, setShowShareCard] = useState(false);
  const baseOptions = useMemo(() => ([
    { key: 'more', label: 'Tell me more about my playstyle', icon: <MessageCircle size={40} /> },
    { key: 'improve', label: 'What should I improve?', icon: <TrendingUp size={40} /> },
    { key: 'compare', label: 'How do I compare to others?', icon: <UsersRound size={40} /> },
    { key: 'surprise', label: 'Surprise me with something interesting!', icon: <Sparkles size={40} /> },
  ]), []);
  const [options, setOptions] = useState(baseOptions);
  const lastAnswerRef = useRef('');
  
  // Load More state
  const [loadingMoreMatches, setLoadingMoreMatches] = useState(false);
  const [hasMoreMatches, setHasMoreMatches] = useState(true);
  const [allMatches, setAllMatches] = useState([]); // Cache all fetched matches
  // Mastery state
  const [mastery, setMastery] = useState([]);
  const [masteryLoading, setMasteryLoading] = useState(false);

  const computeTopFromMatches = (matches, playerPuuid) => {
    try {
      if (!matches || !Array.isArray(matches) || matches.length === 0) return [];
      if (!playerPuuid) return [];
      
      const counts = new Map();
      matches.forEach(m => {
        const p = m?.info?.participants?.find(x => x.puuid === playerPuuid);
        if (p && p.championId != null) {
          const champIdNum = Number(p.championId);
          if (!Number.isNaN(champIdNum) && champIdNum > 0) {
            counts.set(champIdNum, (counts.get(champIdNum) || 0) + 1);
          }
        }
      });
      
      const result = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 40)
        .map(([championId, games]) => ({ 
          championId: Number(championId), 
          championPoints: null, 
          championLevel: null, 
          games: Number(games) 
        }));
      
      return result;
    } catch (error) {
      console.error('computeTopFromMatches error:', error);
      return [];
    }
  };

  const fetchMastery = async (summonerId, platform, puuid, fallbackMatches) => {
    if (!summonerId && !puuid) return;
    try {
      setMasteryLoading(true);
      const params = new URLSearchParams();
      if (summonerId) params.set('summonerId', summonerId);
      if (puuid) params.set('puuid', puuid);
      params.set('count', '40');
      params.set('platform', (platform || 'NA1').toUpperCase());
      const res = await fetch(`/api/mastery?${params.toString()}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.mastery)) {
        setMastery(data.mastery);
      } else {
        const fallback = computeTopFromMatches(fallbackMatches, puuid);
        setMastery(fallback);
      }
    } catch (e) {
      const fallback = computeTopFromMatches(fallbackMatches, puuid);
      setMastery(fallback);
    } finally {
      setMasteryLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProfile(null);
    setInsights(null);
    setIsDemo(false);
    setDialogue('');
    setDialogueVisible(false);
    setPoroState('thinking');
    setOptions(baseOptions);
    lastAnswerRef.current = '';
    // Reset load more state
    setAllMatches([]);
    setHasMoreMatches(true);
    // Reset mastery state
    setMastery([]);
    setMasteryLoading(false);

    try {
      // Check if this is a demo account first
      const demoData = await checkDemoAccount(gameName, tagLine);
      
      if (demoData) {
        console.log('✨ Using pre-loaded demo data (instant!)');
        // Deduplicate matches in demo data
        const uniqueMatches = Array.from(
          new Map(demoData.profile.matches.map(m => [m.metadata?.matchId, m])).values()
        );
        const cleanedProfile = {
          ...demoData.profile,
          matches: uniqueMatches
        };
        setProfile(cleanedProfile);
        setInsights(demoData.insights);
        setIsDemo(true);
        setAllMatches(uniqueMatches);
        setHasMoreMatches(false); // Demo accounts are pre-loaded, no more to fetch
        // Fetch mastery for demo profile as well
        fetchMastery(
          cleanedProfile.summoner?.id,
          cleanedProfile.account?.tagLine,
          cleanedProfile.account?.puuid,
          uniqueMatches
        );
        // Phase 2: deliver initial insight
        setDialogue("I've got a quick insight ready!");
        setDialogueVisible(true);
        setPoroState('ready');
        // After a moment, start talking
        setTimeout(() => setPoroState('talking'), 800);
        setLoading(false);
        return;
      }
      
      // Otherwise, fetch live data
      console.log('⏳ Fetching live data from Riot API...');
      const res = await fetch(`/api/summoner?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch');
      }

      console.log('📊 Profile data received:', data.data);
      console.log('🏆 Ranked stats:', data.data.rankedStats);
      
      setProfile(data.data);
      setAllMatches(data.data.matches); // Initialize cache with first 20
      setHasMoreMatches(data.data.matches.length === 20); // If we got 20, there might be more
      setLoading(false); // Profile loaded, hide main loading spinner
      
      // Fetch mastery first, then generate insights with mastery data
      setInsightsLoading(true);
      setMasteryLoading(true);
      try {
        const params = new URLSearchParams();
        if (data.data.summoner?.id) params.set('summonerId', data.data.summoner.id);
        if (data.data.account?.puuid) params.set('puuid', data.data.account.puuid);
        params.set('count', '40');
        params.set('platform', (data.data.account?.tagLine || 'NA1').toUpperCase());
        
        const masteryRes = await fetch(`/api/mastery?${params.toString()}`);
        const masteryData = await masteryRes.json();
        const fetchedMastery = masteryRes.ok && Array.isArray(masteryData.mastery) 
          ? masteryData.mastery 
          : computeTopFromMatches(data.data.matches, data.data.account.puuid);
        
        setMastery(fetchedMastery);
        setMasteryLoading(false);

        // Generate AI insights with both profile and mastery
        const insRes = await fetch('/api/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data.data, mastery: fetchedMastery })
        });
        const insData = await insRes.json();
        if (insRes.ok && insData?.insights) {
          setInsights(insData.insights);
        }
      } catch (e) {
        console.warn('Insights/mastery fetch failed', e);
        // Fallback to recent matches for mastery
        const fallback = computeTopFromMatches(data.data.matches, data.data.account.puuid);
        setMastery(fallback);
      } finally {
        setInsightsLoading(false);
        setMasteryLoading(false);
      }

      // Conversational prompt stays the same
      setDialogue("I took a peek at your recent games—want a quick overview?");
      setDialogueVisible(true);
      setPoroState('ready');
      setTimeout(() => setPoroState('talking'), 800);

    } catch (err) {
      setError(err.message);
      setPoroState('idle');
      setLoading(false);
    }
  };
  const handleDialogueOption = async (key) => {
    if (!profile) return;
    if (key === 'reset') {
      setOptions(baseOptions);
      setDialogue('Back to the main options. What sounds good?');
      setDialogueVisible(true);
      setPoroState('talking');
      return;
    }
    setDialogueVisible(true);
    setPoroState('thinking');
    setDialogueLoading(true);
    // Start cycling loading phases
    const phases = ["Hmm, let me think...", "Analyzing your games...", "Almost there!"];
    let idx = 0;
    setLoadingPhase(phases[idx]);
    loadingIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % phases.length;
      setLoadingPhase(phases[idx]);
    }, 1600);
    // Clear any previous revert timer
    if (revertIdleTimerRef.current) {
      clearTimeout(revertIdleTimerRef.current);
      revertIdleTimerRef.current = null;
    }
    try {
      // Route followup keys to custom questions
      // Send only essential data (not 200 raw matches) to avoid Vercel payload limits
      const lightProfile = {
        account: profile.account,
        summoner: profile.summoner,
        rankedStats: profile.rankedStats,
        matches: currentPoroMatch ? [currentPoroMatch] : profile.matches.slice(0, 20) // Prefer the active match context
      };
      
      let body;
      if (key.startsWith('followup-')) {
        const follow = options.find(o => o.key === key);
        body = { kind: 'custom', profile: lightProfile, question: follow?.label, match: currentPoroMatch };
      } else {
        body = { kind: key, profile: lightProfile, match: currentPoroMatch };
      }
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      setPoroState('ready');
      setDialogue(data.message);
      setTimeout(() => setPoroState('talking'), 400);
      lastAnswerRef.current = data.message || '';
      
      // Use followups from the same response (no second API call!)
      if (data.followups && Array.isArray(data.followups) && data.followups.length > 0) {
        const mapped = data.followups.slice(0, 3).map((q, i) => ({ key: `followup-${i}`, label: q }));
        setOptions([...mapped, { key: 'reset', label: 'Back to main options' }]);
      } else {
        // Fallback to base options if no followups provided
        setOptions(baseOptions);
      }
      // Estimate typewriter duration to return to idle after speaking
      const messageLength = (data.message || '').length;
      const typingMsPerChar = 18; // keep in sync with DialogueBox default
      const estimated = Math.min(8000, Math.max(1200, messageLength * typingMsPerChar + 600));
      revertIdleTimerRef.current = setTimeout(() => {
        setPoroState('idle');
      }, estimated);
    } catch (e) {
      console.error('❌ Poro dialogue error:', e);
      console.error('Error details:', {
        message: e.message,
        status: e.status,
        response: e.response
      });
      setPoroState('idle');
      setDialogue('Hmm... something went wrong. Want to try again?');
      setOptions(baseOptions);
    } finally {
      setDialogueLoading(false);
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      setLoadingPhase(null);
    }
  };

  const handleFreeSubmit = async (question) => {
    if (!profile) return;
    setDialogueVisible(true);
    setPoroState('thinking');
    setDialogueLoading(true);
    // Start cycling loading phases
    const phases = ["Hmm, let me think...", "Analyzing your games...", "Almost there!"];
    let idx = 0;
    setLoadingPhase(phases[idx]);
    loadingIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % phases.length;
      setLoadingPhase(phases[idx]);
    }, 1600);
    if (revertIdleTimerRef.current) {
      clearTimeout(revertIdleTimerRef.current);
      revertIdleTimerRef.current = null;
    }
    try {
      // Send lightweight profile (only 20 recent matches)
      const lightProfile = {
        account: profile.account,
        summoner: profile.summoner,
        rankedStats: profile.rankedStats,
        matches: profile.matches.slice(0, 20)
      };
      
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'custom', profile: lightProfile, question })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      setPoroState('ready');
      setDialogue(data.message);
      setTimeout(() => setPoroState('talking'), 400);
      lastAnswerRef.current = data.message || '';
      
      // Use followups from the same response (no second API call!)
      if (data.followups && Array.isArray(data.followups) && data.followups.length > 0) {
        const mapped = data.followups.slice(0, 3).map((q, i) => ({ key: `followup-${i}`, label: q }));
        setOptions([...mapped, { key: 'reset', label: 'Back to main options' }]);
      } else {
        // Fallback to base options if no followups provided
        setOptions(baseOptions);
      }
      const messageLength = (data.message || '').length;
      const typingMsPerChar = 18;
      const estimated = Math.min(8000, Math.max(1200, messageLength * typingMsPerChar + 600));
      revertIdleTimerRef.current = setTimeout(() => {
        setPoroState('idle');
      }, estimated);
    } catch (e) {
      console.error('❌ Poro free input error:', e);
      console.error('Error details:', {
        message: e.message,
        question: question
      });
      setPoroState('idle');
      setDialogue('Hmm... something went wrong. Want to try again?');
      setOptions(baseOptions);
    } finally {
      setDialogueLoading(false);
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      setLoadingPhase(null);
    }
  };

  const handleAskMatch = async (match) => {
    if (!profile) return;
    setDialogueVisible(true);
    setPoroState('thinking');
    setDialogueLoading(true);
    const phases = ["Hmm, let me think...", "Analyzing your games...", "Almost there!"];
    let idx = 0;
    setLoadingPhase(phases[idx]);
    loadingIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % phases.length;
      setLoadingPhase(phases[idx]);
    }, 1600);
    if (revertIdleTimerRef.current) {
      clearTimeout(revertIdleTimerRef.current);
      revertIdleTimerRef.current = null;
    }
    try {
      // Persist match context for followups
      setCurrentPoroMatch(match);

      // Send lightweight profile (only essential data + this specific match)
      const lightProfile = {
        account: profile.account,
        summoner: profile.summoner,
        rankedStats: profile.rankedStats,
        matches: [match] // Only send the match being analyzed
      };
      
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'match', profile: lightProfile, match })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPoroState('ready');
      setDialogue(data.message);
      setTimeout(() => setPoroState('talking'), 400);
      lastAnswerRef.current = data.message || '';
      
      // Use followups from the same response (no second API call!)
      if (data.followups && Array.isArray(data.followups) && data.followups.length > 0) {
        const mapped = data.followups.slice(0, 3).map((q, i) => ({ key: `followup-${i}`, label: q }));
        setOptions([...mapped, { key: 'reset', label: 'Back to main options' }]);
      } else {
        // Fallback to base options if no followups provided
        setOptions(baseOptions);
      }
      const messageLength = (data.message || '').length;
      const typingMsPerChar = 18;
      const estimated = Math.min(8000, Math.max(1200, messageLength * typingMsPerChar + 600));
      revertIdleTimerRef.current = setTimeout(() => {
        setPoroState('idle');
      }, estimated);
    } catch (e) {
      console.error('❌ Poro match analysis error:', e);
      console.error('Error details:', {
        message: e.message,
        matchId: match?.metadata?.matchId
      });
      setPoroState('idle');
      setDialogue('Hmm... something went wrong. Want to try again?');
      setOptions(baseOptions);
    } finally {
      setDialogueLoading(false);
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      setLoadingPhase(null);
    }
  };


  const handleLoadMoreMatches = async () => {
    if (!profile || isDemo || loadingMoreMatches) return;
    
    setLoadingMoreMatches(true);
    try {
      const currentCount = allMatches.length;
      const res = await fetch(
        `/api/match?puuid=${encodeURIComponent(profile.account.puuid)}&start=${currentCount}&count=20`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch more matches');
      }

      const newMatches = data.data.matches;
      
      if (newMatches.length > 0) {
        // Deduplicate matches by matchId before adding
        setAllMatches(prev => {
          const existingIds = new Set(prev.map(m => m.metadata?.matchId).filter(Boolean));
          const uniqueNew = newMatches.filter(m => !existingIds.has(m.metadata?.matchId));
          return [...prev, ...uniqueNew];
        });
        // Update profile with all matches (for AI analysis)
        setProfile(prev => {
          const existingIds = new Set(prev.matches.map(m => m.metadata?.matchId).filter(Boolean));
          const uniqueNew = newMatches.filter(m => !existingIds.has(m.metadata?.matchId));
          return {
            ...prev,
            matches: [...prev.matches, ...uniqueNew]
          };
        });
      }
      
      // Update hasMore flag
      setHasMoreMatches(data.data.hasMore && newMatches.length > 0);
      
    } catch (err) {
      console.error('Load more error:', err);
      // If we hit a 404 or "Not found", it means there are no more matches
      if (err.message.includes('Not found') || err.message.includes('404')) {
        setHasMoreMatches(false);
        console.log('No more matches available for this player');
      } else {
        // For other errors, show a message but don't hide the button
        console.error('Failed to load more matches:', err.message);
      }
    } finally {
      setLoadingMoreMatches(false);
    }
  };

  const loadDemoAccount = (name, tag) => {
    setGameName(name);
    setTagLine(tag);
    // Trigger form submit after state updates
    setTimeout(() => {
      document.querySelector('form').requestSubmit();
    }, 100);
  };

  const handlePoroClick = () => {
    // Simply toggle dialogue visibility
    setDialogueVisible(!dialogueVisible);
    
    // Update Poro state based on visibility
    if (dialogueVisible) {
      // Hiding dialogue
      setPoroState('idle');
    } else {
      // Showing dialogue
      if (profile) {
        setPoroState('talking');
      } else {
        setPoroState('talking');
      }
    }
  };

  // Asset helpers
  const getChampionIconSrc = (championId) => {
    if (!championId) return '';
    // Proxy through our API to avoid ORB/CORS blocks and add fallbacks
    const url = `/api/champion-icon?id=${encodeURIComponent(championId)}`;
    return url;
  };

  const getRoleIconSrc = (roleRaw) => {
    const role = (roleRaw || '').toUpperCase();
    const map = {
      TOP: 'top',
      JUNGLE: 'jungle',
      MIDDLE: 'middle',
      MID: 'middle',
      BOTTOM: 'bottom',
      ADC: 'bottom',
      CARRY: 'bottom',
      DUO_CARRY: 'bottom',
      SUPPORT: 'support',
      UTILITY: 'support',
      FILL: 'fill'
    };
    const file = map[role] || 'unknown';
    return `/lolAssets/lol/roles/${file}.png`;
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto relative">
        {/* Left Sidebar: Top Mastery - Large bubble chart (Desktop only) */}
        {profile && (
          <aside className="hidden lg:block fixed left-8 top-24 w-[600px] z-10">
            <div className="p-6">
              <h3 className="text-2xl font-bold mb-4 text-center bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                Top Mastery
              </h3>
              {masteryLoading ? (
                <div className="flex items-center justify-center" style={{ height: '600px' }}>
                  <p className="text-gray-400 text-center">Loading...</p>
                </div>
              ) : mastery && mastery.length > 0 ? (
                <MasteryBubbleChart 
                  mastery={mastery} 
                  getChampionIconSrc={getChampionIconSrc}
                />
              ) : (
                <div className="flex items-center justify-center" style={{ height: '600px' }}>
                  <p className="text-gray-400 text-center">No mastery data available</p>
                </div>
              )}
            </div>
          </aside>
        )}
        
        {/* Main Content - Centered */}
        <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-bold text-center mb-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          Rift Rewind
        </h1>
        <p className="text-center text-gray-400 mb-8 text-base md:text-lg">
          Your Season, Your Story - Powered by AI
        </p>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="bg-gray-800 rounded-lg p-4 md:p-6 shadow-lg mb-6">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <input
              type="text"
              placeholder="Summoner Name (e.g., YinYatsui)"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              className="flex-1 px-4 py-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
              required
            />
            <input
              type="text"
              placeholder="Tag (e.g., NA1)"
              value={tagLine}
              onChange={(e) => setTagLine(e.target.value.toUpperCase())}
              className="md:w-32 px-4 py-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Analyzing...' : 'Search'}
            </button>
          </div>
        </form>

        {/* Demo Account Quick Access */}
        {!profile && !loading && (
          <div className="bg-gray-800/50 rounded-lg p-4 mb-6 border border-gray-700">
            <p className="text-gray-400 text-sm mb-3 text-center flex items-center justify-center gap-2">
              <Zap size={16} className="text-blue-400" />
              Try a demo account for instant results:
            </p>
            <div className="flex flex-col md:flex-row gap-2 justify-center">
              <button
                onClick={() => loadDemoAccount('YinYatsui', 'NA1')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition flex items-center gap-2"
              >
                <Zap size={16} />
                YinYatsui#NA1
                <span className="text-xs text-blue-300">(instant)</span>
              </button>
              <button
                onClick={() => loadDemoAccount('SoloRenektonOnly', 'NA1')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition flex items-center gap-2"
              >
                <Zap size={16} />
                SoloRenektonOnly#NA1
                <span className="text-xs text-blue-300">(instant)</span>
              </button>
              <button
                onClick={() => loadDemoAccount('T1 ok good yes', 'NA1')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition flex items-center gap-2"
              >
                <Zap size={16} />
                T1 ok good yes#NA1
                <span className="text-xs text-blue-300">(instant)</span>
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-2 text-center">
              Or search any summoner above for live analysis
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Fetching your match history...</p>
            <p className="text-gray-500 text-sm mt-2">This may take 10-15 seconds</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-8">
            <p className="text-red-200">❌ {error}</p>
          </div>
        )}

        {/* Results */}
        {profile && (
          <div className="space-y-6">
            {/* Demo Badge */}
            {isDemo && (
              <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-3 text-center">
                <p className="text-blue-300 text-sm">
                  ⚡ Instant Demo Mode - Pre-loaded data for fast demonstration
                </p>
              </div>
            )}

            {/* Player Card */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg p-4 md:p-6 shadow-lg border border-gray-600">
              <div className="flex items-center gap-4 md:gap-6">
                {/* Ranked Emblem */}
                {(() => {
                  if (!profile.rankedStats || profile.rankedStats.length === 0) {
                    return null;
                  }
                  
                  const soloQueue = profile.rankedStats.find(r => r.queueType === 'RANKED_SOLO_5x5');
                  const flexQueue = profile.rankedStats.find(r => r.queueType === 'RANKED_FLEX_SR');
                  const ranked = soloQueue || flexQueue;
                  
                  return ranked ? (
                    <div className="shrink-0">
                      <img
                        src={`/api/ranked-emblem?tier=${ranked.tier}`}
                        alt={`${ranked.tier} ${ranked.rank}`}
                        className="w-16 h-16 md:w-20 md:h-20"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                  ) : null;
                })()}
                
                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-2">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">
                      {profile.account.gameName}
                      <span className="text-gray-400">#{profile.account.tagLine}</span>
                    </h2>
                    {profile.rankedStats && profile.rankedStats.length > 0 && (() => {
                      const soloQueue = profile.rankedStats.find(r => r.queueType === 'RANKED_SOLO_5x5');
                      const flexQueue = profile.rankedStats.find(r => r.queueType === 'RANKED_FLEX_SR');
                      const ranked = soloQueue || flexQueue;
                      return ranked ? (
                        <span className="text-xs sm:text-sm font-semibold text-yellow-400 shrink-0">
                          {ranked.tier.charAt(0) + ranked.tier.slice(1).toLowerCase()} {ranked.rank}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  
                  <div className="flex flex-wrap gap-3 md:gap-5 text-xs sm:text-sm text-gray-300">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">Level</span>
                      <span className="text-blue-400 font-semibold">{profile.summoner.summonerLevel}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">Matches</span>
                      <span className="text-purple-400 font-semibold">{profile.matches.length}</span>
                    </div>
                    {profile.rankedStats && profile.rankedStats.length > 0 && (() => {
                      const soloQueue = profile.rankedStats.find(r => r.queueType === 'RANKED_SOLO_5x5');
                      return soloQueue ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400">LP</span>
                            <span className="text-yellow-400 font-semibold">{soloQueue.leaguePoints}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400">W/L</span>
                            <span className="text-green-400 font-semibold">{soloQueue.wins}</span>
                            <span className="text-gray-500">/</span>
                            <span className="text-red-400 font-semibold">{soloQueue.losses}</span>
                            <span className="text-gray-500 text-xs">
                              ({((soloQueue.wins / (soloQueue.wins + soloQueue.losses)) * 100).toFixed(0)}%)
                            </span>
                          </div>
                        </>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Insights */}
            {insightsLoading && (
              <div className="bg-gray-800 rounded-lg p-6 text-center">
                <div className="animate-pulse flex items-center justify-center gap-3">
                  <div className="h-4 w-4 bg-blue-500 rounded-full animate-bounce"></div>
                  <p className="text-gray-400">AI is analyzing your playstyle...</p>
                </div>
              </div>
            )}

            {insights && (
              <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-lg p-6 shadow-lg border border-blue-500/30">
                <div className="flex items-center gap-3 mb-4">
                  <Bot size={22} className="text-blue-300" />
                  <h3 className="text-2xl font-bold">{insights.title || 'Champion Personality'}</h3>
                </div>
                
                {insights.nickname && (
                  <p className="text-xl text-blue-300 mb-4 italic">{`"${insights.nickname}"`}</p>
                )}

                <p className="text-gray-200 mb-4 leading-relaxed">{insights.summary}</p>

                {insights.strength && (
                  <div className="bg-green-900/20 border-l-4 border-green-500 p-4 mb-3">
                    <p className="text-green-300"><strong>💪 Strength:</strong> {insights.strength}</p>
                  </div>
                )}

                {insights.weakness && (
                  <div className="bg-red-900/20 border-l-4 border-red-500 p-4 mb-3">
                    <p className="text-red-300"><strong>⚠️ Growth Area:</strong> {insights.weakness}</p>
                  </div>
                )}

                {insights.funFact && (
                  <div className="bg-yellow-900/20 border-l-4 border-yellow-500 p-4">
                    <p className="text-yellow-300"><strong>✨ Fun Fact:</strong> {insights.funFact}</p>
                  </div>
                )}

                {/* Social Share Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button
                    onClick={() => {
                      const text = `I just got my Rift Rewind! 🎮\n\nMy Champion Personality: ${insights.nickname}\n${insights.funFact}\n\nGet yours at https://rift-recap.vercel.app`;
                      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
                    }}
                    className="flex-1 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                    Share on Twitter
                  </button>
                  
                  <button
                    onClick={() => {
                      const text = `**My Rift Rewind 2025** 🎮\n\nChampion Personality: *${insights.nickname}*\n\n${insights.funFact}\n\nCheck yours: https://rift-recap.vercel.app`;
                      navigator.clipboard.writeText(text);
                      alert('Copied to clipboard! Paste in Discord 🎉');
                    }}
                    className="flex-1 bg-[#5865F2] hover:bg-[#4752c4] text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    Share on Discord
                  </button>
                </div>

                {/* Share Button */}
                <button
                  onClick={() => setShowShareCard(true)}
                  className="mt-4 w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-3"
                >
                  <Share2 size={24} />
                  Share Your League Recap
                </button>
              </div>
            )}


            {/* Top Mastery - Mobile version (below Champion Personality) */}
            {profile && (
              <div className="block lg:hidden bg-gray-800 rounded-lg p-4 md:p-6 shadow-lg">
                <h3 className="text-xl md:text-2xl font-bold mb-4 text-center bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                  Top Mastery
                </h3>
                {masteryLoading ? (
                  <div className="flex items-center justify-center" style={{ height: '400px' }}>
                    <p className="text-gray-400 text-center">Loading mastery data...</p>
                  </div>
                ) : mastery && mastery.length > 0 ? (
                  <div className="w-full">
                    <MasteryBubbleChart 
                      mastery={mastery} 
                      getChampionIconSrc={getChampionIconSrc}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center" style={{ height: '400px' }}>
                    <p className="text-gray-400 text-center">No mastery data available</p>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Progress Tracking Features */}
            {profile && (
              <div className="block lg:hidden space-y-6">
                {/* Progress Over Time Chart - Mobile */}
                {allMatches.length > 0 && (
                  <ProgressChart 
                    matches={allMatches} 
                    playerPuuid={profile.account.puuid}
                  />
                )}

                {/* Your Best Game Highlight - Mobile */}
                {allMatches.length > 0 && (() => {
                  const bestMatch = allMatches.reduce((best, current) => {
                    const participant = current.info.participants.find(p => p.puuid === profile.account.puuid);
                    const currentParticipant = current.info.participants.find(p => p.puuid === profile.account.puuid);
                    
                    if (!participant || !currentParticipant) return best;
                    
                    // Calculate performance score (KDA weighted + damage + CS + vision)
                    const currentScore = (currentParticipant.kills * 2) + currentParticipant.assists - currentParticipant.deaths + 
                                       (currentParticipant.totalDamageDealtToChampions / 1000) + 
                                       ((currentParticipant.totalMinionsKilled + currentParticipant.neutralMinionsKilled) / 10) +
                                       (currentParticipant.visionScore / 2);
                    
                    const bestScore = best ? ((best.kills * 2) + best.assists - best.deaths + 
                                             (best.totalDamageDealtToChampions / 1000) + 
                                             ((best.totalMinionsKilled + best.neutralMinionsKilled) / 10) +
                                             (best.visionScore / 2)) : -Infinity;
                    
                    return currentScore > bestScore ? currentParticipant : best;
                  }, null);

                  if (!bestMatch) return null;

                  const kdaRatio = ((bestMatch.kills + bestMatch.assists) / Math.max(bestMatch.deaths, 1)).toFixed(2);
                  const cs = (bestMatch.totalMinionsKilled || 0) + (bestMatch.neutralMinionsKilled || 0);
                  const minutes = Math.max(1, Math.floor(allMatches.find(m => 
                    m.info.participants.find(p => p.puuid === profile.account.puuid) === bestMatch
                  )?.info.gameDuration / 60));
                  const csPerMin = (cs / minutes).toFixed(1);
                  const damage = Math.round(bestMatch.totalDamageDealtToChampions / 1000);
                  const gameDate = new Date(allMatches.find(m => 
                    m.info.participants.find(p => p.puuid === profile.account.puuid) === bestMatch
                  )?.info.gameCreation).toLocaleDateString();

                  return (
                    <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 rounded-lg shadow-lg">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-3xl">⭐</span>
                        <h2 className="text-2xl font-bold text-gray-900">Your Standout Game</h2>
                      </div>
                      
                      <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-4 mb-3">
                          <img
                            src={getChampionIconSrc(bestMatch.championId)}
                            alt={`${bestMatch.championName} icon`}
                            className="w-16 h-16 rounded-lg object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">
                              {bestMatch.championName}
                            </h3>
                            <p className="text-lg text-gray-800">
                              {bestMatch.kills}/{bestMatch.deaths}/{bestMatch.assists} KDA ({kdaRatio})
                            </p>
                            <p className="text-sm text-gray-700">
                              {bestMatch.win ? '🏆 Victory' : '💪 Valiant effort'} • {gameDate}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="bg-white/30 rounded px-3 py-2">
                            <span className="text-gray-700 font-semibold">Damage:</span>
                            <div className="text-gray-900 font-bold">{damage}K</div>
                          </div>
                          <div className="bg-white/30 rounded px-3 py-2">
                            <span className="text-gray-700 font-semibold">CS:</span>
                            <div className="text-gray-900 font-bold">{cs} ({csPerMin}/m)</div>
                          </div>
                          <div className="bg-white/30 rounded px-3 py-2">
                            <span className="text-gray-700 font-semibold">Vision:</span>
                            <div className="text-gray-900 font-bold">{bestMatch.visionScore}</div>
                          </div>
                          <div className="bg-white/30 rounded px-3 py-2">
                            <span className="text-gray-700 font-semibold">Gold:</span>
                            <div className="text-gray-900 font-bold">{Math.round(bestMatch.goldEarned / 1000)}K</div>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          const text = `Just had my best game this season! 🎮\n\n${bestMatch.championName}: ${bestMatch.kills}/${bestMatch.deaths}/${bestMatch.assists} KDA\n${damage}K damage • ${cs} CS • ${bestMatch.visionScore} vision score\n\nCheck your stats at https://rift-recap.vercel.app`;
                          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
                        }}
                        className="bg-white text-orange-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition flex items-center gap-2 mx-auto"
                      >
                        📤 Share This Game
                      </button>
                    </div>
                  );
                })()}

                {/* Biggest Improvement Metric - Mobile */}
                {allMatches.length >= 20 && (() => {
                  const totalMatches = allMatches.length;
                  const earlyMatches = allMatches.slice(-totalMatches, -Math.floor(totalMatches / 2));
                  const recentMatches = allMatches.slice(-Math.floor(totalMatches / 2));
                  
                  if (earlyMatches.length === 0 || recentMatches.length === 0) return null;
                  
                  const calculateAvgKDA = (matches) => {
                    const validMatches = matches.filter(match => {
                      const participant = match.info.participants.find(p => p.puuid === profile.account.puuid);
                      return participant && participant.deaths > 0;
                    });
                    
                    if (validMatches.length === 0) return 0;
                    
                    const totalKDA = validMatches.reduce((sum, match) => {
                      const participant = match.info.participants.find(p => p.puuid === profile.account.puuid);
                      return sum + ((participant.kills + participant.assists) / participant.deaths);
                    }, 0);
                    
                    return totalKDA / validMatches.length;
                  };
                  
                  const earlyKDA = calculateAvgKDA(earlyMatches);
                  const recentKDA = calculateAvgKDA(recentMatches);
                  const improvement = earlyKDA > 0 ? ((recentKDA - earlyKDA) / earlyKDA * 100) : 0;
                  
                  // Calculate win rate improvement
                  const earlyWins = earlyMatches.filter(match => {
                    const participant = match.info.participants.find(p => p.puuid === profile.account.puuid);
                    return participant && participant.win;
                  }).length;
                  const recentWins = recentMatches.filter(match => {
                    const participant = match.info.participants.find(p => p.puuid === profile.account.puuid);
                    return participant && participant.win;
                  }).length;
                  
                  const earlyWinRate = (earlyWins / earlyMatches.length) * 100;
                  const recentWinRate = (recentWins / recentMatches.length) * 100;
                  const winRateImprovement = recentWinRate - earlyWinRate;
                  
                  const isImproving = improvement > 0 || winRateImprovement > 0;
                  const mainMetric = Math.abs(improvement) > Math.abs(winRateImprovement) ? 'KDA' : 'Win Rate';
                  const mainValue = mainMetric === 'KDA' ? improvement : winRateImprovement;
                  
                  return (
                    <div className={`p-6 rounded-lg shadow-lg ${isImproving ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-3xl">{isImproving ? '📈' : '📊'}</span>
                        <h2 className="text-2xl font-bold text-white">Biggest Improvement</h2>
                      </div>
                      
                      <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 mb-4">
                        <div className="text-center">
                          <div className="text-4xl font-bold text-white mb-2">
                            {mainValue > 0 ? '+' : ''}{mainValue.toFixed(1)}%
                          </div>
                          <div className="text-lg text-white/90 mb-3">
                            {mainMetric} {isImproving ? 'Increase' : 'Change'}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-white/30 rounded px-3 py-2">
                              <div className="text-white/80 font-semibold">Early Season</div>
                              <div className="text-white font-bold">
                                {mainMetric === 'KDA' ? earlyKDA.toFixed(2) : `${earlyWinRate.toFixed(1)}%`}
                              </div>
                            </div>
                            <div className="bg-white/30 rounded px-3 py-2">
                              <div className="text-white/80 font-semibold">Recent Games</div>
                              <div className="text-white font-bold">
                                {mainMetric === 'KDA' ? recentKDA.toFixed(2) : `${recentWinRate.toFixed(1)}%`}
                              </div>
                            </div>
                          </div>
                          
                          {mainMetric !== 'KDA' && (
                            <div className="mt-3 text-sm text-white/80">
                              KDA: {earlyKDA.toFixed(2)} → {recentKDA.toFixed(2)} ({improvement > 0 ? '+' : ''}{improvement.toFixed(1)}%)
                            </div>
                          )}
                          {mainMetric !== 'Win Rate' && (
                            <div className="mt-3 text-sm text-white/80">
                              Win Rate: {earlyWinRate.toFixed(1)}% → {recentWinRate.toFixed(1)}% ({winRateImprovement > 0 ? '+' : ''}{winRateImprovement.toFixed(1)}%)
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <p className="text-white/90 text-sm">
                          {isImproving 
                            ? `You've been getting better! Keep up the great work! 🎉`
                            : `Your performance has been consistent. Focus on specific areas to improve! 💪`
                          }
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Match History (open by default) */}
            <details open className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <summary className="text-xl font-bold cursor-pointer hover:text-blue-400 transition">
                Recent Matches ({allMatches.length})
              </summary>
              <div className="space-y-2 mt-4">
                {allMatches.map((match) => {
                  const participant = match.info.participants.find(
                    p => p.puuid === profile.account.puuid
                  );
                  
                  const kdaRatio = ((participant.kills + participant.assists) / Math.max(participant.deaths, 1)).toFixed(2);
                  const teamKills = match.info.participants
                    .filter(p => p.teamId === participant.teamId)
                    .reduce((sum, p) => sum + p.kills, 0);
                  const killParticipation = (((participant.kills + participant.assists) / Math.max(teamKills, 1)) * 100).toFixed(0);
                  const cs = (participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0);
                  const minutes = Math.max(1, Math.floor(match.info.gameDuration / 60));
                  const csPerMin = (cs / minutes).toFixed(1);
                  const visionScore = participant.visionScore;
                  const damage = participant.totalDamageDealtToChampions;
                  const gold = participant.goldEarned;
                  const role = participant.teamPosition || participant.role || 'FILL';
                  
                  return (
                    <div
                      key={match.metadata.matchId}
                      className={`p-3 md:p-4 rounded-lg transition hover:scale-[1.01] ${
                        participant.win 
                          ? 'bg-blue-900/30 border border-blue-500/30' 
                          : 'bg-red-900/30 border border-red-500/30'
                      }`}
                    >
                      {/* Mobile & Desktop Layout */}
                      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                        {/* Left: Champion & Stats */}
                        <div className="flex items-center gap-2 md:gap-3">
                          {/* Champion Icon */}
                          <img
                            src={getChampionIconSrc(participant.championId)}
                            alt={`${participant.championName} icon`}
                            className="w-12 h-12 md:w-14 md:h-14 rounded-md object-cover shrink-0"
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          
                          {/* Summoner Spells */}
                          <div className="flex flex-col gap-0.5">
                            <img
                              src={`/api/summoner-spell?id=${participant.summoner1Id}`}
                              alt="Spell 1"
                              className="w-5 h-5 md:w-6 md:h-6 rounded"
                              loading="lazy"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                            <img
                              src={`/api/summoner-spell?id=${participant.summoner2Id}`}
                              alt="Spell 2"
                              className="w-5 h-5 md:w-6 md:h-6 rounded"
                              loading="lazy"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </div>
                          
                          {/* KDA & Role */}
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-gray-200 font-semibold text-sm md:text-base">
                                {participant.kills}/{participant.deaths}/{participant.assists}
                              </span>
                              <span className="text-xs text-gray-400">
                                {kdaRatio} KDA
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <img
                                src={getRoleIconSrc(role)}
                                alt={`${role} icon`}
                                className="w-3 h-3 md:w-4 md:h-4 inline-block"
                                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                              />
                              <span>{role}</span>
                            </div>
                          </div>
                          
                          {/* Items */}
                          <div className="hidden sm:grid grid-cols-4 gap-0.5 ml-2">
                            {[0, 1, 2, 3, 4, 5, 6].map((slot) => {
                              const itemId = participant[`item${slot}`];
                              return itemId ? (
                                <img
                                  key={slot}
                                  src={`/api/item-icon?id=${itemId}`}
                                  alt={`Item ${slot}`}
                                  className="w-6 h-6 md:w-7 md:h-7 rounded border border-gray-700"
                                  loading="lazy"
                                  onError={(e) => { e.currentTarget.style.opacity = '0.3'; }}
                                />
                              ) : (
                                <div key={slot} className="w-6 h-6 md:w-7 md:h-7 bg-gray-800/50 rounded border border-gray-700/50" />
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Right: Result & Duration */}
                        <div className="flex items-center justify-between md:flex-col md:items-end gap-2">
                          <div className="flex flex-col md:items-end">
                            <span className={`font-bold text-sm md:text-base ${participant.win ? 'text-blue-400' : 'text-red-400'}`}>
                              {participant.win ? 'Victory' : 'Defeat'}
                            </span>
                            <span className="text-xs md:text-sm text-gray-400">
                              {Math.floor(match.info.gameDuration / 60)}m {match.info.gameDuration % 60}s
                            </span>
                          </div>
                          <button
                            onClick={() => handleAskMatch(match)}
                            className="inline-flex items-center gap-1.5 text-xs md:text-sm text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline whitespace-nowrap"
                          >
                            <PawPrint size={14} className="md:w-4 md:h-4" />
                            <span className="hidden sm:inline">Ask Poro about this game</span>
                            <span className="sm:hidden">Ask Poro</span>
                          </button>
                        </div>
                      </div>
                      
                      {/* Items (Mobile Only - Below Stats) */}
                      <div className="sm:hidden mt-3 flex items-center gap-2">
                        <span className="text-xs text-gray-400 shrink-0">Items:</span>
                        <div className="flex gap-1 overflow-x-auto">
                          {[0, 1, 2, 3, 4, 5, 6].map((slot) => {
                            const itemId = participant[`item${slot}`];
                            return itemId ? (
                              <img
                                key={slot}
                                src={`/api/item-icon?id=${itemId}`}
                                alt={`Item ${slot}`}
                                className="w-7 h-7 rounded border border-gray-700 shrink-0"
                                loading="lazy"
                                onError={(e) => { e.currentTarget.style.opacity = '0.3'; }}
                              />
                            ) : (
                              <div key={slot} className="w-7 h-7 bg-gray-800/50 rounded border border-gray-700/50 shrink-0" />
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Stats Grid */}
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs md:text-sm text-gray-300">
                        <div className="bg-black/20 rounded px-2 py-1.5 border border-white/5">
                          <span className="text-gray-400">CS:</span> {cs} <span className="text-gray-500 text-xs">({csPerMin}/m)</span>
                        </div>
                        <div className="bg-black/20 rounded px-2 py-1.5 border border-white/5">
                          <span className="text-gray-400">KP:</span> {killParticipation}%
                        </div>
                        <div className="bg-black/20 rounded px-2 py-1.5 border border-white/5 truncate">
                          <span className="text-gray-400">Dmg:</span> {damage?.toLocaleString?.() || damage}
                        </div>
                        <div className="bg-black/20 rounded px-2 py-1.5 border border-white/5">
                          <span className="text-gray-400">Vision:</span> {visionScore}
                        </div>
                        <div className="bg-black/20 rounded px-2 py-1.5 border border-white/5 truncate">
                          <span className="text-gray-400">Gold:</span> {gold?.toLocaleString?.() || gold}
                        </div>
                      </div>

                      {/* Players expander */}
                      <div className="mt-3 space-y-2">
                        <details className="bg-black/10 rounded border border-white/5">
                          <summary className="cursor-pointer px-3 py-2 text-xs md:text-sm text-gray-200 hover:text-white">View all players</summary>
                          <div className="px-2 md:px-3 pb-3 pt-2">
                            {/* Stacked teams on mobile, side-by-side on desktop */}
                            <div className="flex flex-col md:grid md:grid-cols-2 gap-3 md:gap-4">
                              {([100, 200]).map((teamId) => {
                                const team = match.info.participants.filter(p => p.teamId === teamId);
                                return (
                                  <div key={teamId} className="bg-black/20 rounded p-2 md:p-3 border border-white/5">
                                    <div className="font-semibold mb-2 text-xs md:text-sm text-gray-300 flex items-center gap-2">
                                      <span className={`inline-block w-2 h-2 rounded-full ${teamId === 100 ? 'bg-blue-400' : 'bg-red-400'}`}></span>
                                      Team {teamId === 100 ? 'Blue' : 'Red'}
                                    </div>
                                    {/* Header - hidden on mobile, shown on desktop */}
                                    <div className="hidden md:grid grid-cols-6 gap-2 text-xs uppercase tracking-wide text-gray-400 px-2 pb-1">
                                      <div className="col-span-2">Player</div>
                                      <div className="text-center">K/D/A</div>
                                      <div className="text-center">CS</div>
                                      <div className="text-right">Gold</div>
                                      <div className="text-right">Dmg</div>
                                    </div>
                                    <div className="space-y-1 md:divide-y md:divide-white/5">
                                      {team.map((p) => {
                                        const csP = (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);
                                        return (
                                          <div key={p.puuid} className="md:grid md:grid-cols-6 md:gap-2 text-xs md:text-sm text-gray-200 px-1 md:px-2 py-1.5 md:py-1 hover:bg-white/5 rounded md:rounded-none">
                                            {/* Mobile: Compact horizontal layout */}
                                            <div className="flex md:hidden items-center justify-between gap-2">
                                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <img
                                                  src={getChampionIconSrc(p.championId)}
                                                  alt={`${p.championName} icon`}
                                                  className="w-5 h-5 rounded object-cover shrink-0"
                                                  loading="lazy"
                                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                />
                                                <span className="font-semibold truncate text-xs" title={p.summonerName || p.riotIdGameName || 'Unknown'}>
                                                  {(p.summonerName || p.riotIdGameName || 'Unknown').split(' ')[0]}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-3 text-xs shrink-0">
                                                <span className="text-gray-300">{p.kills}/{p.deaths}/{p.assists}</span>
                                                <span className="text-gray-400">{csP} CS</span>
                                              </div>
                                            </div>
                                            
                                            {/* Desktop: Table layout */}
                                            <div className="hidden md:contents">
                                              <div className="col-span-2 flex items-center gap-2 min-w-0">
                                                <img
                                                  src={getChampionIconSrc(p.championId)}
                                                  alt={`${p.championName} icon`}
                                                  className="w-6 h-6 rounded object-cover shrink-0"
                                                  loading="lazy"
                                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                />
                                                <span className="font-semibold truncate" title={p.summonerName || p.riotIdGameName || 'Unknown'}>
                                                  {p.summonerName || p.riotIdGameName || 'Unknown'}
                                                </span>
                                              </div>
                                              <div className="text-center text-gray-300">
                                                {p.kills}/{p.deaths}/{p.assists}
                                              </div>
                                              <div className="text-center text-gray-400">
                                                {csP}
                                              </div>
                                              <div className="text-right text-gray-400 truncate">
                                                {(p.goldEarned / 1000).toFixed(1)}k
                                              </div>
                                              <div className="text-right text-gray-400 truncate">
                                                {(p.totalDamageDealtToChampions / 1000).toFixed(1)}k
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  );
                })}
                
                {/* Load More Button */}
                {!isDemo && hasMoreMatches && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={handleLoadMoreMatches}
                      disabled={loadingMoreMatches}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition inline-flex items-center gap-2"
                    >
                      {loadingMoreMatches ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Loading more matches...
                        </>
                      ) : (
                        <>
                          Load 20 More Matches
                          <span className="text-xs text-blue-300">({allMatches.length} loaded)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
                
                {!isDemo && !hasMoreMatches && allMatches.length > 20 && (
                  <div className="mt-6 text-center text-gray-400 text-sm">
                    📜 No more matches available - you&apos;ve loaded all {allMatches.length} matches!
                  </div>
                )}
              </div>
            </details>

            {/* Try Another Search */}
            <div className="text-center">
              <button
                onClick={() => {
                  setProfile(null);
                  setInsights(null);
                  setGameName('');
                  setIsDemo(false);
                }}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition"
              >
                Search Another Summoner
              </button>
            </div>
          </div>
        )}

        {/* Right Sidebar: Progress Tracking Features (Desktop only) */}
        {profile && (
          <aside className="hidden lg:block absolute top-[124px] right-[-500px] w-[600px] z-10 space-y-6">
            {/* Progress Over Time Chart */}
            {allMatches.length > 0 && (
              <ProgressChart 
                matches={allMatches} 
                playerPuuid={profile.account.puuid}
              />
            )}

            {/* Your Best Game Highlight */}
            {allMatches.length > 0 && (() => {
              const bestMatch = allMatches.reduce((best, current) => {
                const participant = current.info.participants.find(p => p.puuid === profile.account.puuid);
                const currentParticipant = current.info.participants.find(p => p.puuid === profile.account.puuid);
                
                if (!participant || !currentParticipant) return best;
                
                // Calculate performance score (KDA weighted + damage + CS + vision)
                const currentScore = (currentParticipant.kills * 2) + currentParticipant.assists - currentParticipant.deaths + 
                                   (currentParticipant.totalDamageDealtToChampions / 1000) + 
                                   ((currentParticipant.totalMinionsKilled + currentParticipant.neutralMinionsKilled) / 10) +
                                   (currentParticipant.visionScore / 2);
                
                const bestScore = best ? ((best.kills * 2) + best.assists - best.deaths + 
                                         (best.totalDamageDealtToChampions / 1000) + 
                                         ((best.totalMinionsKilled + best.neutralMinionsKilled) / 10) +
                                         (best.visionScore / 2)) : -Infinity;
                
                return currentScore > bestScore ? currentParticipant : best;
              }, null);

              if (!bestMatch) return null;

              const kdaRatio = ((bestMatch.kills + bestMatch.assists) / Math.max(bestMatch.deaths, 1)).toFixed(2);
              const cs = (bestMatch.totalMinionsKilled || 0) + (bestMatch.neutralMinionsKilled || 0);
              const minutes = Math.max(1, Math.floor(allMatches.find(m => 
                m.info.participants.find(p => p.puuid === profile.account.puuid) === bestMatch
              )?.info.gameDuration / 60));
              const csPerMin = (cs / minutes).toFixed(1);
              const damage = Math.round(bestMatch.totalDamageDealtToChampions / 1000);
              const gameDate = new Date(allMatches.find(m => 
                m.info.participants.find(p => p.puuid === profile.account.puuid) === bestMatch
              )?.info.gameCreation).toLocaleDateString();

              return (
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 rounded-lg shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">⭐</span>
                    <h2 className="text-2xl font-bold text-gray-900">Your Standout Game</h2>
                  </div>
                  
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-4 mb-3">
                      <img
                        src={getChampionIconSrc(bestMatch.championId)}
                        alt={`${bestMatch.championName} icon`}
                        className="w-16 h-16 rounded-lg object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {bestMatch.championName}
                        </h3>
                        <p className="text-lg text-gray-800">
                          {bestMatch.kills}/{bestMatch.deaths}/{bestMatch.assists} KDA ({kdaRatio})
                        </p>
                        <p className="text-sm text-gray-700">
                          {bestMatch.win ? '🏆 Victory' : '💪 Valiant effort'} • {gameDate}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-white/30 rounded px-3 py-2">
                        <span className="text-gray-700 font-semibold">Damage:</span>
                        <div className="text-gray-900 font-bold">{damage}K</div>
                      </div>
                      <div className="bg-white/30 rounded px-3 py-2">
                        <span className="text-gray-700 font-semibold">CS:</span>
                        <div className="text-gray-900 font-bold">{cs} ({csPerMin}/m)</div>
                      </div>
                      <div className="bg-white/30 rounded px-3 py-2">
                        <span className="text-gray-700 font-semibold">Vision:</span>
                        <div className="text-gray-900 font-bold">{bestMatch.visionScore}</div>
                      </div>
                      <div className="bg-white/30 rounded px-3 py-2">
                        <span className="text-gray-700 font-semibold">Gold:</span>
                        <div className="text-gray-900 font-bold">{Math.round(bestMatch.goldEarned / 1000)}K</div>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      const text = `Just had my best game this season! 🎮\n\n${bestMatch.championName}: ${bestMatch.kills}/${bestMatch.deaths}/${bestMatch.assists} KDA\n${damage}K damage • ${cs} CS • ${bestMatch.visionScore} vision score\n\nCheck your stats at https://rift-recap.vercel.app`;
                      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
                    }}
                    className="bg-white text-orange-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition flex items-center gap-2 mx-auto"
                  >
                    📤 Share This Game
                  </button>
                </div>
              );
            })()}

            {/* Biggest Improvement Metric */}
            {allMatches.length >= 20 && (() => {
              const totalMatches = allMatches.length;
              const earlyMatches = allMatches.slice(-totalMatches, -Math.floor(totalMatches / 2));
              const recentMatches = allMatches.slice(-Math.floor(totalMatches / 2));
              
              if (earlyMatches.length === 0 || recentMatches.length === 0) return null;
              
              const calculateAvgKDA = (matches) => {
                const validMatches = matches.filter(match => {
                  const participant = match.info.participants.find(p => p.puuid === profile.account.puuid);
                  return participant && participant.deaths > 0;
                });
                
                if (validMatches.length === 0) return 0;
                
                const totalKDA = validMatches.reduce((sum, match) => {
                  const participant = match.info.participants.find(p => p.puuid === profile.account.puuid);
                  return sum + ((participant.kills + participant.assists) / participant.deaths);
                }, 0);
                
                return totalKDA / validMatches.length;
              };
              
              const earlyKDA = calculateAvgKDA(earlyMatches);
              const recentKDA = calculateAvgKDA(recentMatches);
              const improvement = earlyKDA > 0 ? ((recentKDA - earlyKDA) / earlyKDA * 100) : 0;
              
              // Calculate win rate improvement
              const earlyWins = earlyMatches.filter(match => {
                const participant = match.info.participants.find(p => p.puuid === profile.account.puuid);
                return participant && participant.win;
              }).length;
              const recentWins = recentMatches.filter(match => {
                const participant = match.info.participants.find(p => p.puuid === profile.account.puuid);
                return participant && participant.win;
              }).length;
              
              const earlyWinRate = (earlyWins / earlyMatches.length) * 100;
              const recentWinRate = (recentWins / recentMatches.length) * 100;
              const winRateImprovement = recentWinRate - earlyWinRate;
              
              const isImproving = improvement > 0 || winRateImprovement > 0;
              const mainMetric = Math.abs(improvement) > Math.abs(winRateImprovement) ? 'KDA' : 'Win Rate';
              const mainValue = mainMetric === 'KDA' ? improvement : winRateImprovement;
              
              return (
                <div className={`p-6 rounded-lg shadow-lg ${isImproving ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{isImproving ? '📈' : '📊'}</span>
                    <h2 className="text-2xl font-bold text-white">Biggest Improvement</h2>
                  </div>
                  
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 mb-4">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-white mb-2">
                        {mainValue > 0 ? '+' : ''}{mainValue.toFixed(1)}%
                      </div>
                      <div className="text-lg text-white/90 mb-3">
                        {mainMetric} {isImproving ? 'Increase' : 'Change'}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-white/30 rounded px-3 py-2">
                          <div className="text-white/80 font-semibold">Early Season</div>
                          <div className="text-white font-bold">
                            {mainMetric === 'KDA' ? earlyKDA.toFixed(2) : `${earlyWinRate.toFixed(1)}%`}
                          </div>
                        </div>
                        <div className="bg-white/30 rounded px-3 py-2">
                          <div className="text-white/80 font-semibold">Recent Games</div>
                          <div className="text-white font-bold">
                            {mainMetric === 'KDA' ? recentKDA.toFixed(2) : `${recentWinRate.toFixed(1)}%`}
                          </div>
                        </div>
                      </div>
                      
                      {mainMetric !== 'KDA' && (
                        <div className="mt-3 text-sm text-white/80">
                          KDA: {earlyKDA.toFixed(2)} → {recentKDA.toFixed(2)} ({improvement > 0 ? '+' : ''}{improvement.toFixed(1)}%)
                        </div>
                      )}
                      {mainMetric !== 'Win Rate' && (
                        <div className="mt-3 text-sm text-white/80">
                          Win Rate: {earlyWinRate.toFixed(1)}% → {recentWinRate.toFixed(1)}% ({winRateImprovement > 0 ? '+' : ''}{winRateImprovement.toFixed(1)}%)
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-white/90 text-sm">
                      {isImproving 
                        ? `You've been getting better! Keep up the great work! 🎉`
                        : `Your performance has been consistent. Focus on specific areas to improve! 💪`
                      }
                    </p>
                  </div>
                </div>
              );
            })()}
          </aside>
        )}

        {/** Poro Assistant fixed bottom-right, always mounted */}
        <PoroAssistant
          state={poroState}
          showDialogue={dialogueVisible ? (
            <DialogueBox
              text={dialogue}
              options={profile ? options : []}
              onOption={handleDialogueOption}
              typing={!dialogueLoading}
              disabled={dialogueLoading}
              loadingPhase={dialogueLoading ? loadingPhase : null}
              showFreeInput={!!profile}
              onFreeSubmit={handleFreeSubmit}
            />
          ) : null}
          onPoroClick={handlePoroClick}
          scale={9}
        />
        </div>
      </div>

      {/* Shareable Card Modal */}
      {showShareCard && profile && insights && (
        <ShareableCard
          profile={profile}
          insights={insights}
          mastery={mastery}
          onClose={() => setShowShareCard(false)}
        />
      )}
    </main>
  );
}