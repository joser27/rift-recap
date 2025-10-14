// src/app/page.js
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, TrendingUp, UsersRound, Sparkles, Bot, Zap, PawPrint } from 'lucide-react';
import PoroAssistant from './components/PoroAssistant';
import DialogueBox from './components/DialogueBox';
import MasteryBubbleChart from './components/MasteryBubbleChart';

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
      const counts = new Map();
      (matches || []).forEach(m => {
        const p = m?.info?.participants?.find(x => x.puuid === playerPuuid);
        if (p && p.championId != null) {
          const champIdNum = Number(p.championId);
          if (!Number.isNaN(champIdNum)) {
            counts.set(champIdNum, (counts.get(champIdNum) || 0) + 1);
          }
        }
      });
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 40)
        .map(([championId, games]) => ({ championId, championPoints: null, championLevel: null, games }));
    } catch {
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

    try {
      // Check if this is a demo account first
      const demoData = await checkDemoAccount(gameName, tagLine);
      
      if (demoData) {
        console.log('✨ Using pre-loaded demo data (instant!)');
        setProfile(demoData.profile);
        setInsights(demoData.insights);
        setIsDemo(true);
        setAllMatches(demoData.profile.matches);
        setHasMoreMatches(false); // Demo accounts are pre-loaded, no more to fetch
        // Fetch mastery for demo profile as well
        fetchMastery(
          demoData.profile.summoner?.id,
          demoData.profile.account?.tagLine,
          demoData.profile.account?.puuid,
          demoData.profile.matches
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

      setProfile(data.data);
      setAllMatches(data.data.matches); // Initialize cache with first 20
      setHasMoreMatches(data.data.matches.length === 20); // If we got 20, there might be more
      // Fetch mastery for live profile
      fetchMastery(
        data.data.summoner?.id,
        data.data.account?.tagLine,
        data.data.account?.puuid,
        data.data.matches
      );

      // Kick off AI insights for all accounts
      try {
        setInsightsLoading(true);
        const insRes = await fetch('/api/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data.data)
        });
        const insData = await insRes.json();
        if (insRes.ok && insData?.insights) {
          setInsights(insData.insights);
        }
      } catch (e) {
        // Keep UI responsive even if insights fail
        console.warn('Insights fetch failed', e);
      } finally {
        setInsightsLoading(false);
      }

      // Conversational prompt stays the same
      setDialogue("I took a peek at your recent games—want a quick overview?");
      setDialogueVisible(true);
      setPoroState('ready');
      setTimeout(() => setPoroState('talking'), 800);

    } catch (err) {
      setError(err.message);
      setPoroState('idle');
    } finally {
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
      let body;
      if (key.startsWith('followup-')) {
        const follow = options.find(o => o.key === key);
        body = { kind: 'custom', profile, question: follow?.label };
      } else {
        body = { kind: key, profile };
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
      // Fetch dynamic followups and replace options
      try {
        const f = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'followups', profile, lastAnswer: lastAnswerRef.current })
        });
        const fdata = await f.json();
        if (f.ok && Array.isArray(fdata.followups) && fdata.followups.length) {
          const mapped = fdata.followups.slice(0, 3).map((q, i) => ({ key: `followup-${i}`, label: q }));
          setOptions([...mapped, { key: 'reset', label: 'Back to main options' }]);
        } else {
          setOptions(baseOptions);
        }
      } catch {
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
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'custom', profile, question })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      setPoroState('ready');
      setDialogue(data.message);
      setTimeout(() => setPoroState('talking'), 400);
      lastAnswerRef.current = data.message || '';
      // dynamic followups
      try {
        const f = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'followups', profile, lastAnswer: lastAnswerRef.current })
        });
        const fdata = await f.json();
        if (f.ok && Array.isArray(fdata.followups) && fdata.followups.length) {
          const mapped = fdata.followups.slice(0, 3).map((q, i) => ({ key: `followup-${i}`, label: q }));
          setOptions([...mapped, { key: 'reset', label: 'Back to main options' }]);
        } else {
          setOptions(baseOptions);
        }
      } catch {
        setOptions(baseOptions);
      }
      const messageLength = (data.message || '').length;
      const typingMsPerChar = 18;
      const estimated = Math.min(8000, Math.max(1200, messageLength * typingMsPerChar + 600));
      revertIdleTimerRef.current = setTimeout(() => {
        setPoroState('idle');
      }, estimated);
    } catch (e) {
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
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'match', profile, match })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPoroState('ready');
      setDialogue(data.message);
      setTimeout(() => setPoroState('talking'), 400);
      lastAnswerRef.current = data.message || '';
      // optional followups for match context
      try {
        const f = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'followups', profile, lastAnswer: lastAnswerRef.current })
        });
        const fdata = await f.json();
        if (f.ok && Array.isArray(fdata.followups) && fdata.followups.length) {
          const mapped = fdata.followups.slice(0, 3).map((q, i) => ({ key: `followup-${i}`, label: q }));
          setOptions([...mapped, { key: 'reset', label: 'Back to main options' }]);
        } else {
          setOptions(baseOptions);
        }
      } catch {
        setOptions(baseOptions);
      }
      const messageLength = (data.message || '').length;
      const typingMsPerChar = 18;
      const estimated = Math.min(8000, Math.max(1200, messageLength * typingMsPerChar + 600));
      revertIdleTimerRef.current = setTimeout(() => {
        setPoroState('idle');
      }, estimated);
    } catch (e) {
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
        // Append new matches to cache
        setAllMatches(prev => [...prev, ...newMatches]);
        // Update profile with all matches (for AI analysis)
        setProfile(prev => ({
          ...prev,
          matches: [...prev.matches, ...newMatches]
        }));
      }
      
      // Update hasMore flag
      setHasMoreMatches(data.data.hasMore && newMatches.length > 0);
      
    } catch (err) {
      console.error('Load more error:', err);
      // Don't break the UI, just log the error
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
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-7xl mx-auto relative">
        {/* Left Sidebar: Top Mastery - Large bubble chart */}
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
              ) : (
                <MasteryBubbleChart 
                  mastery={mastery} 
                  getChampionIconSrc={getChampionIconSrc}
                />
              )}
            </div>
          </aside>
        )}
        
        {/* Main Content - Centered */}
        <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          Rift Rewind
        </h1>
        <p className="text-center text-gray-400 mb-8 text-lg">
          Your Season, Your Story - Powered by AI
        </p>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="bg-gray-800 rounded-lg p-6 shadow-lg mb-6">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Summoner Name (e.g., Bosey)"
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
              className="w-32 px-4 py-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
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
            <div className="flex gap-2 justify-center flex-wrap">
              <button
                onClick={() => loadDemoAccount('Bosey', 'NA1')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition flex items-center gap-2"
              >
                <Zap size={16} />
                Bosey#NA1
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
            <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg p-6 shadow-lg border border-gray-600">
              <h2 className="text-3xl font-bold mb-2">
                {profile.account.gameName}
                <span className="text-gray-400">#{profile.account.tagLine}</span>
              </h2>
              <div className="flex gap-6 text-gray-300">
                <p>Level: <span className="text-blue-400 font-semibold">{profile.summoner.summonerLevel}</span></p>
                <p>Matches Analyzed: <span className="text-purple-400 font-semibold">{profile.matches.length}</span></p>
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
                      className={`p-4 rounded-lg transition hover:scale-[1.02] ${
                        participant.win 
                          ? 'bg-blue-900/30 border border-blue-500/30' 
                          : 'bg-red-900/30 border border-red-500/30'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <img
                            src={getChampionIconSrc(participant.championId)}
                            alt={`${participant.championName} icon`}
                            className="w-12 h-12 rounded-md object-cover shrink-0"
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <span className="font-bold text-lg">{participant.championName}</span>
                          <span className="text-gray-300">
                            {participant.kills}/{participant.deaths}/{participant.assists}
                          </span>
                          <span className="text-sm text-gray-400">
                            KDA: {kdaRatio}
                          </span>
                          <span className="text-sm text-gray-400 inline-flex items-center gap-1">
                            <img
                              src={getRoleIconSrc(role)}
                              alt={`${role} icon`}
                              className="w-4 h-4 inline-block"
                              onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                            />
                            Role: {role}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`font-semibold ${participant.win ? 'text-blue-400' : 'text-red-400'}`}>
                            {participant.win ? 'Victory' : 'Defeat'}
                          </span>
                          <p className="text-sm text-gray-400">
                            {Math.floor(match.info.gameDuration / 60)}m {match.info.gameDuration % 60}s
                          </p>
                          <button
                            onClick={() => handleAskMatch(match)}
                            className="mt-2 inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline"
                          >
                            <PawPrint size={16} />
                            Ask Poro about this game
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-sm text-gray-300">
                        <div className="bg-black/20 rounded px-2 py-1 border border-white/5">
                          <span className="text-gray-400">CS:</span> {cs} <span className="text-gray-400">({csPerMin}/m)</span>
                        </div>
                        <div className="bg-black/20 rounded px-2 py-1 border border-white/5">
                          <span className="text-gray-400">KP:</span> {killParticipation}%
                        </div>
                        <div className="bg-black/20 rounded px-2 py-1 border border-white/5">
                          <span className="text-gray-400">Dmg:</span> {damage?.toLocaleString?.() || damage}
                        </div>
                        <div className="bg-black/20 rounded px-2 py-1 border border-white/5">
                          <span className="text-gray-400">Vision:</span> {visionScore}
                        </div>
                        <div className="bg-black/20 rounded px-2 py-1 border border-white/5">
                          <span className="text-gray-400">Gold:</span> {gold?.toLocaleString?.() || gold}
                        </div>
                      </div>

                      {/* Players and raw data expanders */}
                      <div className="mt-3 space-y-2">
                        <details className="bg-black/10 rounded border border-white/5">
                          <summary className="cursor-pointer px-3 py-2 text-sm text-gray-200 hover:text-white">View all players</summary>
                          <div className="px-3 pb-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {([100, 200]).map((teamId) => {
                                const team = match.info.participants.filter(p => p.teamId === teamId);
                                return (
                                  <div key={teamId} className="bg-black/20 rounded p-3 border border-white/5">
                                    <div className="font-semibold mb-3 text-gray-300 flex items-center gap-2">
                                      <span className={`inline-block w-2 h-2 rounded-full ${teamId === 100 ? 'bg-blue-400' : 'bg-red-400'}`}></span>
                                      Team {teamId === 100 ? 'Blue' : 'Red'}
                                    </div>
                                    <div className="grid grid-cols-6 gap-2 text-xs uppercase tracking-wide text-gray-400 px-2 pb-1">
                                      <div className="col-span-2">Player (Champ)</div>
                                      <div className="text-center">K/D/A</div>
                                      <div className="text-center">CS</div>
                                      <div className="text-right">Gold</div>
                                      <div className="text-right">Dmg</div>
                                    </div>
                                    <div className="divide-y divide-white/5 rounded overflow-hidden">
                                      {team.map((p) => {
                                        const csP = (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);
                                        return (
                                          <div key={p.puuid} className="grid grid-cols-6 gap-2 text-sm text-gray-200 px-2 py-1 bg-white/5/0 hover:bg-white/5/10">
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
                                              <span className="text-gray-400 shrink-0">({p.championName})</span>
                                            </div>
                                            <div className="text-center text-gray-300">
                                              {p.kills}/{p.deaths}/{p.assists}
                                            </div>
                                            <div className="text-center text-gray-400">
                                              {csP}
                                            </div>
                                            <div className="text-right text-gray-400">
                                              {p.goldEarned?.toLocaleString?.() || p.goldEarned}
                                            </div>
                                            <div className="text-right text-gray-400">
                                              {p.totalDamageDealtToChampions?.toLocaleString?.() || p.totalDamageDealtToChampions}
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
          scale={9}
        />
        </div>
      </div>
    </main>
  );
}