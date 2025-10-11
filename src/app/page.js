// app/page.js
'use client';

import { useState } from 'react';

export default function Home() {
  const [gameName, setGameName] = useState('');
  const [tagLine, setTagLine] = useState('NA1');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProfile(null);

    try {
      const res = await fetch(`/api/summoner?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch');
      }

      setProfile(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          Rift Rewind
        </h1>
        <p className="text-center text-gray-400 mb-8 text-lg">
          Your Season, Your Story
        </p>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8">
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

        {/* Loading State */}
        {loading && (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Fetching your match history...</p>
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

            {/* Match List */}
            <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <h3 className="text-2xl font-bold mb-4">Recent Matches</h3>
              <div className="space-y-2">
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
            </div>
          </div>
        )}
      </div>
    </main>
  );
}