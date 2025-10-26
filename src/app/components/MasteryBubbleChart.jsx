// MasteryBubbleChart.jsx - Full width version
'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Crown, Trophy, Star, Twitter, ChevronRight, ChevronLeft } from 'lucide-react';

export default function MasteryBubbleChart({ mastery, getChampionIconSrc, allMatches = null, playerPuuid = null }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, data: null });
  const [isReady, setIsReady] = useState(false);
  const [viewMode, setViewMode] = useState('mastery'); // 'mastery' or 'recent'
  
  // Compute recent matches data
  const computeRecentFromMatches = (matches, puuid) => {
    try {
      if (!matches || !Array.isArray(matches) || matches.length === 0) return [];
      if (!puuid) return [];
      
      const counts = new Map();
      matches.forEach(m => {
        const p = m?.info?.participants?.find(x => x.puuid === puuid);
        if (p && p.championId != null) {
          const champIdNum = Number(p.championId);
          if (!Number.isNaN(champIdNum) && champIdNum > 0) {
            counts.set(champIdNum, (counts.get(champIdNum) || 0) + 1);
          }
        }
      });
      
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 40)
        .map(([championId, games]) => ({ 
          championId: Number(championId), 
          championPoints: null, 
          championLevel: null, 
          games: Number(games) 
        }));
    } catch (error) {
      console.error('computeRecentFromMatches error:', error);
      return [];
    }
  };
  
  const recentData = allMatches && playerPuuid ? computeRecentFromMatches(allMatches, playerPuuid) : [];
  const canToggle = recentData.length > 0 && mastery.length > 0;
  const currentData = viewMode === 'mastery' ? mastery : recentData;

  // Wait for container to be ready
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady || !currentData || currentData.length === 0 || !svgRef.current || !containerRef.current) {
      return;
    }

    // Get actual container width and make it square
    const containerWidth = containerRef.current.clientWidth;
    if (!containerWidth || containerWidth < 10) {
      return;
    }
    const size = containerWidth; // Make it fill the full width

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', size)
      .attr('height', size)
      .attr('viewBox', `0 0 ${size} ${size}`);

    // Prepare data - use championPoints or games as value
    // Filter out invalid entries and ensure minimum values
    const data = currentData
      .filter(m => m && (m.championId != null))
      .map(m => ({
        ...m,
        value: Math.max(m.championPoints || (m.games * 2000) || 1000, 1000),
        id: m.championId
      }))
      .slice(0, 40); // Limit to 40 champions max

    // Ensure we have valid data
    if (data.length === 0) return;

    // Create hierarchy for pack layout
    const root = d3.hierarchy({ children: data })
      .sum(d => d.value || 1000);

    // Create pack layout with full size
    const pack = d3.pack()
      .size([size, size])
      .padding(Math.max(2, size * 0.01)); // Responsive padding

    let nodes;
    try {
      nodes = pack(root).leaves();
      if (!nodes || nodes.length === 0) return;
    } catch (error) {
      console.error('D3 pack error:', error);
      return;
    }

    // Color scale
    const colorScale = d3.scaleOrdinal()
      .domain(data.map(d => d.championId))
      .range(['#60a5fa', '#a78bfa', '#fb923c', '#34d399', '#f472b6', '#f59e0b', '#22d3ee', '#ef4444']);

    // Create groups for each bubble
    const bubbles = svg.selectAll('g')
      .data(nodes)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Add circles
    bubbles.append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => colorScale(d.data.championId))
      .attr('opacity', 0.8)
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 2);

    // Add champion icons - fill most of the bubble
    bubbles.append('image')
      .attr('xlink:href', d => getChampionIconSrc(d.data.championId))
      .attr('x', d => -d.r * 0.95)
      .attr('y', d => -d.r * 0.95)
      .attr('width', d => d.r * 1.9)
      .attr('height', d => d.r * 1.9)
      .attr('clip-path', d => `circle(${d.r * 0.9}px at 50% 50%)`)
      .attr('opacity', 1);

    // Add invisible hover targets for better interaction
    bubbles.append('circle')
      .attr('r', d => d.r)
      .attr('fill', 'transparent')
      .attr('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        // Highlight on hover
        d3.select(this.parentNode).select('circle:first-child')
          .transition()
          .duration(200)
          .attr('opacity', 1)
          .attr('stroke-width', 3);
        
        // Show tooltip
        const rect = containerRef.current.getBoundingClientRect();
        setTooltip({
          visible: true,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          data: d.data
        });
      })
      .on('mousemove', function(event) {
        const rect = containerRef.current.getBoundingClientRect();
        setTooltip(prev => ({
          ...prev,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        }));
      })
      .on('mouseleave', function() {
        // Remove highlight
        d3.select(this.parentNode).select('circle:first-child')
          .transition()
          .duration(200)
          .attr('opacity', 0.8)
          .attr('stroke-width', 2);
        
        // Hide tooltip
        setTooltip({ visible: false, x: 0, y: 0, data: null });
      });

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      if (newWidth !== containerWidth) {
        // Re-render on resize
        d3.select(svgRef.current).selectAll('*').remove();
        // Trigger re-render by updating a dummy state or just call the effect logic again
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);

  }, [isReady, currentData, getChampionIconSrc]);

  if (!currentData || currentData.length === 0) {
    return <p className="text-gray-500 text-sm">No mastery data</p>;
  }

  // Calculate stats based on current view
  const totalPoints = currentData.reduce((sum, m) => sum + (m.championPoints || 0), 0);
  const totalChampions = currentData.length;
  const top3 = currentData.slice(0, 3);
  const statLabel = viewMode === 'mastery' ? 'Total Points' : 'Recent Games';

  return (
    <div className="bg-gradient-to-br from-purple-900/40 via-blue-900/40 to-indigo-900/40 rounded-xl p-6 shadow-xl border border-purple-500/30">
      {/* Header with Stats */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Crown className="text-purple-400" size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">
                {viewMode === 'mastery' ? 'Champion Mastery' : 'Recent Matches'}
              </h3>
              <p className="text-gray-400 text-sm">
                {viewMode === 'mastery' ? 'Your most played champions' : 'Champions from your recent games'}
              </p>
            </div>
          </div>
          
          {/* Toggle Button */}
          {canToggle && (
            <button
              onClick={() => setViewMode(viewMode === 'mastery' ? 'recent' : 'mastery')}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition"
              title={`Switch to ${viewMode === 'mastery' ? 'recent matches' : 'mastery'}`}
            >
              {viewMode === 'mastery' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              <span className="text-sm text-white font-medium hidden sm:inline">
                {viewMode === 'mastery' ? 'Recent' : 'Mastery'}
              </span>
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={16} className="text-yellow-400" />
              <span className="text-gray-400 text-xs font-medium">{statLabel}</span>
            </div>
            <div className="text-white font-bold text-lg">
              {viewMode === 'mastery' ? totalPoints.toLocaleString() : totalChampions}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
            <div className="flex items-center gap-2 mb-1">
              <Star size={16} className="text-blue-400" />
              <span className="text-gray-400 text-xs font-medium">Champions</span>
            </div>
            <div className="text-white font-bold text-lg">{totalChampions}</div>
          </div>
        </div>

        {/* Top 3 Champions */}
        {top3.length > 0 && (
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-xs font-semibold text-gray-400 mb-2">Top 3 Champions</div>
            <div className="flex gap-2">
              {top3.map((champ, idx) => (
                <div key={champ.championId} className="flex-1 bg-white/10 rounded-lg p-2 text-center border border-white/20">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {idx === 0 && <Crown size={12} className="text-yellow-400" />}
                    {idx === 1 && <Trophy size={12} className="text-gray-300" />}
                    {idx === 2 && <Star size={12} className="text-orange-400" />}
                    <span className="text-white text-xs font-bold">#{idx + 1}</span>
                  </div>
                  <img
                    src={getChampionIconSrc(champ.championId)}
                    alt="Champion"
                    className="w-10 h-10 rounded-full mx-auto mb-1 border-2 border-white/30"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <div className="text-xs text-purple-300 font-semibold">
                    {viewMode === 'mastery' 
                      ? (champ.championPoints || 0).toLocaleString() 
                      : `${champ.games || 0} games`
                    }
                  </div>
                  {champ.championLevel && (
                    <div className="text-xs text-gray-400">M{champ.championLevel}</div>
                  )}
                  {viewMode === 'recent' && champ.games && (
                    <div className="text-xs text-gray-400">{champ.games} game{champ.games !== 1 ? 's' : ''}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bubble Chart */}
      <div ref={containerRef} className="w-full relative bg-gray-900/30 rounded-lg p-4 border border-white/10" style={{ minHeight: '400px' }}>
        <svg ref={svgRef} className="drop-shadow-lg w-full h-auto" style={{ display: 'block' }}></svg>
        
        {/* Tooltip */}
        {tooltip.visible && tooltip.data && (
          <div
            className="absolute pointer-events-none z-50 bg-gray-900 border border-purple-500/50 rounded-lg px-4 py-3 shadow-xl"
            style={{
              left: `${tooltip.x + 15}px`,
              top: `${tooltip.y - 10}px`,
              transform: 'translate(0, -100%)'
            }}
          >
            {viewMode === 'mastery' && tooltip.data.championLevel != null && (
              <>
                <div className="text-sm font-semibold text-purple-300">
                  {(tooltip.data.championPoints || 0).toLocaleString()} Points
                </div>
                <div className="text-xs text-blue-300">
                  Mastery Level {tooltip.data.championLevel}
                </div>
                {tooltip.data.chestGranted && (
                  <div className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                    <Trophy size={12} />
                    Chest Earned
                  </div>
                )}
              </>
            )}
            {(viewMode === 'recent' || (!tooltip.data.championLevel && tooltip.data.games)) && (
              <div className="text-sm text-gray-300">
                Played {tooltip.data.games || 0} game{tooltip.data.games !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share Button */}
      <button
        onClick={() => {
          if (viewMode === 'mastery') {
            const topChampText = top3.map((c, i) => `#${i+1}: ${(c.championPoints || 0).toLocaleString()} pts`).join(' • ');
            const text = `My League Champion Mastery 🎮\n\n${totalPoints.toLocaleString()} total mastery points across ${totalChampions} champions!\n\nTop 3: ${topChampText}\n\nGet your Rift Rewind at https://rift-recap.vercel.app`;
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
          } else {
            const topChampText = top3.map((c, i) => `#${i+1}: ${c.games || 0} games`).join(' • ');
            const text = `My Recent League Champions 🎮\n\nPlayed ${totalChampions} different champions in recent games!\n\nTop 3: ${topChampText}\n\nGet your Rift Rewind at https://rift-recap.vercel.app`;
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
          }
        }}
        className="w-full mt-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg"
      >
        <Twitter size={18} />
        Share Your Champion {viewMode === 'mastery' ? 'Mastery' : 'Recent Matches'}
      </button>
    </div>
  );
}