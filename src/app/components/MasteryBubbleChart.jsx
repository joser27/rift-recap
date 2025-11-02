'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import html2canvas from 'html2canvas';
import { Crown, Trophy, Star, ChevronRight, ChevronLeft, Download } from 'lucide-react';

export default function MasteryBubbleChart({ mastery, getChampionIconSrc, allMatches = null, playerPuuid = null }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const shareWrapperRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, data: null });
  const [isReady, setIsReady] = useState(false);
  const [viewMode, setViewMode] = useState('mastery');
  const [isCapturing, setIsCapturing] = useState(false);
  
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

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady || !currentData || currentData.length === 0 || !svgRef.current || !containerRef.current) {
      return;
    }

    const containerWidth = containerRef.current.clientWidth;
    if (!containerWidth || containerWidth < 10) {
      return;
    }
    const size = containerWidth;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', size)
      .attr('height', size)
      .attr('viewBox', `0 0 ${size} ${size}`);

    const data = currentData
      .filter(m => m && (m.championId != null))
      .map(m => ({
        ...m,
        value: Math.max(m.championPoints || (m.games * 2000) || 1000, 1000),
        id: m.championId
      }))
      .slice(0, 40);

    if (data.length === 0) return;

    const root = d3.hierarchy({ children: data })
      .sum(d => d.value || 1000);

    const pack = d3.pack()
      .size([size, size])
      .padding(Math.max(2, size * 0.01));

    let nodes;
    try {
      nodes = pack(root).leaves();
      if (!nodes || nodes.length === 0) return;
    } catch (error) {
      console.error('D3 pack error:', error);
      return;
    }

    const colorScale = d3.scaleOrdinal()
      .domain(data.map(d => d.championId))
      .range(['#60a5fa', '#a78bfa', '#fb923c', '#34d399', '#f472b6', '#f59e0b', '#22d3ee', '#ef4444']);

    const bubbles = svg.selectAll('g')
      .data(nodes)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    bubbles.append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => colorScale(d.data.championId))
      .attr('opacity', 0.8)
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 2);

    svg.append('defs')
      .selectAll('clipPath')
      .data(nodes)
      .join('clipPath')
      .attr('id', (d, i) => `clip-${i}`)
      .append('circle')
      .attr('r', d => d.r * 0.9);

    bubbles.append('image')
      .attr('href', d => getChampionIconSrc(d.data.championId))
      .attr('xlink:href', d => getChampionIconSrc(d.data.championId))
      .attr('crossorigin', 'anonymous')
      .attr('x', d => -d.r * 0.95)
      .attr('y', d => -d.r * 0.95)
      .attr('width', d => d.r * 1.9)
      .attr('height', d => d.r * 1.9)
      .attr('clip-path', (d, i) => `url(#clip-${i})`)
      .attr('opacity', 1);
    bubbles.append('circle')
      .attr('r', d => d.r)
      .attr('fill', 'transparent')
      .attr('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this.parentNode).select('circle:first-child')
          .transition()
          .duration(200)
          .attr('opacity', 1)
          .attr('stroke-width', 3);
        
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
        d3.select(this.parentNode).select('circle:first-child')
          .transition()
          .duration(200)
          .attr('opacity', 0.8)
          .attr('stroke-width', 2);
        
        setTooltip({ visible: false, x: 0, y: 0, data: null });
      });

    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      if (newWidth !== containerWidth) {
        d3.select(svgRef.current).selectAll('*').remove();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);

  }, [isReady, currentData, getChampionIconSrc]);

  if (!currentData || currentData.length === 0) {
    return <p className="text-gray-500 text-sm">No mastery data</p>;
  }

  const totalPoints = currentData.reduce((sum, m) => sum + (m.championPoints || 0), 0);
  const totalChampions = currentData.length;
  const top3 = currentData.slice(0, 3);
  const statLabel = viewMode === 'mastery' ? 'Total Points' : 'Recent Games';

  const handleDownloadImage = async () => {
    if (!shareWrapperRef.current || isCapturing) return;
    
    try {
      setIsCapturing(true);
      
      const svgElement = svgRef.current;
      const svgWidth = parseInt(svgElement.getAttribute('width'));
      const svgHeight = parseInt(svgElement.getAttribute('height'));
      
      const bubbleCanvas = document.createElement('canvas');
      bubbleCanvas.width = svgWidth;
      bubbleCanvas.height = svgHeight;
      const ctx = bubbleCanvas.getContext('2d');
      
      const groups = svgElement.querySelectorAll('g[transform]');
      const bubbleData = [];
      
      groups.forEach((group) => {
        const transform = group.getAttribute('transform');
        const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
        if (!match) return;
        
        const groupX = parseFloat(match[1]);
        const groupY = parseFloat(match[2]);
        
        const circle = group.querySelector('circle');
        if (!circle) return;
        
        const r = parseFloat(circle.getAttribute('r'));
        const fill = circle.getAttribute('fill');
        const opacity = parseFloat(circle.getAttribute('opacity') || 1);
        
        const image = group.querySelector('image');
        if (!image) return;
        
        const href = image.getAttribute('href') || image.getAttribute('xlink:href');
        const imgX = parseFloat(image.getAttribute('x'));
        const imgY = parseFloat(image.getAttribute('y'));
        const imgWidth = parseFloat(image.getAttribute('width'));
        const imgHeight = parseFloat(image.getAttribute('height'));
        
        bubbleData.push({
          x: groupX,
          y: groupY,
          r,
          fill,
          opacity,
          href,
          imgX,
          imgY,
          imgWidth,
          imgHeight
        });
      });
      
      const imagePromises = bubbleData.map(async (bubble) => {
        if (!bubble.href) return null;
        
        try {
          const response = await fetch(bubble.href);
          const blob = await response.blob();
          const img = new Image();
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
          });
          
          return { ...bubble, img };
        } catch (e) {
          console.error('Failed to load image:', bubble.href, e);
          return { ...bubble, img: null };
        }
      });
      
      const loadedBubbles = await Promise.all(imagePromises);
      
      loadedBubbles.forEach((bubble) => {
        ctx.globalAlpha = bubble.opacity;
        ctx.fillStyle = bubble.fill;
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.r, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        if (bubble.img) {
          ctx.save();
          
          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, bubble.r * 0.9, 0, 2 * Math.PI);
          ctx.clip();
          
          const absoluteX = bubble.x + bubble.imgX;
          const absoluteY = bubble.y + bubble.imgY;
          ctx.drawImage(bubble.img, absoluteX, absoluteY, bubble.imgWidth, bubble.imgHeight);
          
          ctx.restore();
        }
      });
      
      bubbleCanvas.style.width = svgElement.style.width || '100%';
      bubbleCanvas.style.height = svgElement.style.height || 'auto';
      bubbleCanvas.className = svgElement.className;
      
      const originalSvgParent = svgElement.parentNode;
      svgElement.style.display = 'none';
      originalSvgParent.insertBefore(bubbleCanvas, svgElement);
      
      const finalCanvas = await html2canvas(shareWrapperRef.current, {
        backgroundColor: null,
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        ignoreElements: (element) => {
          if (element.classList?.contains('capture-exclude')) return true;
          if (element.classList?.contains('absolute') && element.classList?.contains('pointer-events-none')) return true;
          return false;
        },
      });
      
      bubbleCanvas.remove();
      svgElement.style.display = 'block';
      
      const dataURL = finalCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataURL;
      a.download = `league-champion-${viewMode === 'mastery' ? 'mastery' : 'recent'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      const svgElement = svgRef.current;
      if (svgElement) {
        svgElement.style.display = 'block';
      }
      
      alert('Failed to save image. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };


  return (
    <div
      ref={shareWrapperRef}
      className="rounded-xl p-6 shadow-xl border"
      style={{
        background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.4) 0%, rgba(30, 58, 138, 0.4) 50%, rgba(49, 46, 129, 0.4) 100%)',
        borderColor: 'rgba(168, 85, 247, 0.3)'
      }}
      data-capture-root="true"
    >
      {/* Header with Stats */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3 capture-solid-bg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)' }}>
              <Crown style={{ color: 'rgb(192, 132, 252)' }} size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold" style={{ color: 'rgb(255, 255, 255)' }}>
                {viewMode === 'mastery' ? 'Champion Mastery' : 'Recent Matches'}
              </h3>
              <p className="text-sm" style={{ color: 'rgb(156, 163, 175)' }}>
                {viewMode === 'mastery' ? 'Your most played champions' : 'Champions from your recent games'}
              </p>
            </div>
          </div>
          
          {/* Toggle Button */}
          {canToggle && (
            <button
              onClick={() => setViewMode(viewMode === 'mastery' ? 'recent' : 'mastery')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
              title={`Switch to ${viewMode === 'mastery' ? 'recent matches' : 'mastery'}`}
            >
              {viewMode === 'mastery' ? <ChevronRight size={18} style={{ color: 'rgb(255, 255, 255)' }} /> : <ChevronLeft size={18} style={{ color: 'rgb(255, 255, 255)' }} />}
              <span className="text-sm font-medium hidden sm:inline" style={{ color: 'rgb(255, 255, 255)' }}>
                {viewMode === 'mastery' ? 'Recent' : 'Mastery'}
              </span>
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={16} style={{ color: 'rgb(250, 204, 21)' }} />
              <span className="text-xs font-medium" style={{ color: 'rgb(156, 163, 175)' }}>{statLabel}</span>
            </div>
            <div className="font-bold text-lg" style={{ color: 'rgb(255, 255, 255)' }}>
              {viewMode === 'mastery' ? totalPoints.toLocaleString() : totalChampions}
            </div>
          </div>
          <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Star size={16} style={{ color: 'rgb(96, 165, 250)' }} />
              <span className="text-xs font-medium" style={{ color: 'rgb(156, 163, 175)' }}>Champions</span>
            </div>
            <div className="font-bold text-lg" style={{ color: 'rgb(255, 255, 255)' }}>{totalChampions}</div>
          </div>
        </div>

        {/* Top 3 Champions */}
        {top3.length > 0 && (
          <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: 'rgb(156, 163, 175)' }}>Top 3 Champions</div>
            <div className="flex gap-2">
              {top3.map((champ, idx) => (
                <div key={champ.championId} className="flex-1 rounded-lg p-2 text-center" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {idx === 0 && <Crown size={12} style={{ color: 'rgb(250, 204, 21)' }} />}
                    {idx === 1 && <Trophy size={12} style={{ color: 'rgb(209, 213, 219)' }} />}
                    {idx === 2 && <Star size={12} style={{ color: 'rgb(251, 146, 60)' }} />}
                    <span className="text-xs font-bold" style={{ color: 'rgb(255, 255, 255)' }}>#{idx + 1}</span>
                  </div>
                  <img
                    src={getChampionIconSrc(champ.championId)}
                    alt="Champion"
                    className="w-10 h-10 rounded-full mx-auto mb-1"
                    style={{ border: '2px solid rgba(255, 255, 255, 0.3)' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <div className="text-xs font-semibold" style={{ color: 'rgb(216, 180, 254)' }}>
                    {viewMode === 'mastery' 
                      ? (champ.championPoints || 0).toLocaleString() 
                      : `${champ.games || 0} games`
                    }
                  </div>
                  {champ.championLevel && (
                    <div className="text-xs" style={{ color: 'rgb(156, 163, 175)' }}>M{champ.championLevel}</div>
                  )}
                  {viewMode === 'recent' && champ.games && (
                    <div className="text-xs" style={{ color: 'rgb(156, 163, 175)' }}>{champ.games} game{champ.games !== 1 ? 's' : ''}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bubble Chart */}
      <div
        ref={containerRef}
        className="w-full relative rounded-lg p-4"
        style={{ minHeight: '400px', backgroundColor: 'rgba(17, 24, 39, 0.3)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
      >
        <svg ref={svgRef} className="drop-shadow-lg w-full h-auto" style={{ display: 'block' }}></svg>
        
        {/* Tooltip */}
        {tooltip.visible && tooltip.data && (
          <div
            className="absolute pointer-events-none z-50 rounded-lg px-4 py-3 shadow-xl border"
            style={{
              backgroundColor: '#111827',
              borderColor: 'rgba(168, 85, 247, 0.5)',
              left: `${tooltip.x + 15}px`,
              top: `${tooltip.y - 10}px`,
              transform: 'translate(0, -100%)'
            }}
          >
            {viewMode === 'mastery' && tooltip.data.championLevel != null && (
              <>
                <div className="text-sm font-semibold" style={{ color: 'rgb(216, 180, 254)' }}>
                  {(tooltip.data.championPoints || 0).toLocaleString()} Points
                </div>
                <div className="text-xs" style={{ color: 'rgb(147, 197, 253)' }}>
                  Mastery Level {tooltip.data.championLevel}
                </div>
                {tooltip.data.chestGranted && (
                  <div className="text-xs mt-1 flex items-center gap-1" style={{ color: 'rgb(250, 204, 21)' }}>
                    <Trophy size={12} style={{ color: 'rgb(250, 204, 21)' }} />
                    Chest Earned
                  </div>
                )}
              </>
            )}
            {(viewMode === 'recent' || (!tooltip.data.championLevel && tooltip.data.games)) && (
              <div className="text-sm" style={{ color: 'rgb(209, 213, 219)' }}>
                Played {tooltip.data.games || 0} game{tooltip.data.games !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share Button */}
      <div className="mt-4 capture-exclude">
        <button
          onClick={handleDownloadImage}
          disabled={isCapturing}
          className="w-full font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(90deg, rgb(147, 51, 234) 0%, rgb(59, 130, 246) 100%)', color: 'rgb(255, 255, 255)' }}
          onMouseEnter={(e) => !isCapturing && (e.currentTarget.style.background = 'linear-gradient(90deg, rgb(126, 34, 206) 0%, rgb(37, 99, 235) 100%)')}
          onMouseLeave={(e) => !isCapturing && (e.currentTarget.style.background = 'linear-gradient(90deg, rgb(147, 51, 234) 0%, rgb(59, 130, 246) 100%)')}
        >
          {isCapturing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Download size={18} style={{ color: 'rgb(255, 255, 255)' }} />
              <span>Download Image</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}