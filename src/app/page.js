// src/app/page.js
'use client';

import { useState } from 'react';

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

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProfile(null);
    setInsights(null);
    setIsDemo(false);

    try {
      // Check if this is a demo account first
      const demoData = await checkDemoAccount(gameName, tagLine);
      
      if (demoData) {
        console.log('✨ Using pre-loaded demo data (instant!)');
        setProfile(demoData.profile);
        setInsights(demoData.insights);
        setIsDemo(true);
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

      // Generate insights
      setInsightsLoading(true);
      const insightsRes = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.data)
      });

      const insightsData = await insightsRes.json();
      
      if (insightsRes.ok) {
        setInsights(insightsData.insights);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setInsightsLoading(false);
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
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
            <p className="text-gray-400 text-sm mb-3 text-center">
              ⚡ Try a demo account for instant results:
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button
                onClick={() => loadDemoAccount('Bosey', 'NA1')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition flex items-center gap-2"
              >
                <span>⚡</span>
                Bosey#NA1
                <span className="text-xs text-blue-300">(instant)</span>
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-2 text-center">
              Or search any summoner above for live analysis (~15 seconds)
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
                  <span className="text-3xl">🤖</span>
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

            {/* Match History (collapsed by default) */}
            <details className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <summary className="text-xl font-bold cursor-pointer hover:text-blue-400 transition">
                Recent Matches ({profile.matches.length})
              </summary>
              <div className="space-y-2 mt-4">
                {profile.matches.slice(0, 10).map((match) => {
                  const participant = match.info.participants.find(
                    p => p.puuid === profile.account.puuid
                  );
                  
                  const kdaRatio = ((participant.kills + participant.assists) / Math.max(participant.deaths, 1)).toFixed(2);
                  
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
                          <span className="font-bold text-lg">{participant.championName}</span>
                          <span className="text-gray-300">
                            {participant.kills}/{participant.deaths}/{participant.assists}
                          </span>
                          <span className="text-sm text-gray-400">
                            KDA: {kdaRatio}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`font-semibold ${participant.win ? 'text-blue-400' : 'text-red-400'}`}>
                            {participant.win ? 'Victory' : 'Defeat'}
                          </span>
                          <p className="text-sm text-gray-400">
                            {Math.floor(match.info.gameDuration / 60)}m {match.info.gameDuration % 60}s
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
      </div>
    </main>
  );
}