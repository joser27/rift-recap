// MasteryBubbleChart.jsx - Full width version
'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export default function MasteryBubbleChart({ mastery, getChampionIconSrc }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, data: null });
  const [isReady, setIsReady] = useState(false);

  // Wait for container to be ready
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady || !mastery || mastery.length === 0 || !svgRef.current || !containerRef.current) {
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
    const data = mastery
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

  }, [isReady, mastery, getChampionIconSrc]);

  if (!mastery || mastery.length === 0) {
    return <p className="text-gray-500 text-sm">No mastery data</p>;
  }

  return (
    <div ref={containerRef} className="w-full relative" style={{ minHeight: '400px' }}>
      <svg ref={svgRef} className="drop-shadow-lg w-full h-auto" style={{ display: 'block' }}></svg>
      
      {/* Tooltip */}
      {tooltip.visible && tooltip.data && (
        <div
          className="absolute pointer-events-none z-50 bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 shadow-xl"
          style={{
            left: `${tooltip.x + 15}px`,
            top: `${tooltip.y - 10}px`,
            transform: 'translate(0, -100%)'
          }}
        >
          {tooltip.data.championLevel != null && (
            <>
              <div className="text-sm font-semibold text-purple-300">
                {(tooltip.data.championPoints || 0).toLocaleString()} Points
              </div>
              <div className="text-xs text-blue-300">
                Mastery Level {tooltip.data.championLevel}
              </div>
              {tooltip.data.chestGranted && (
                <div className="text-xs text-yellow-400 mt-1">
                  ✓ Chest Earned
                </div>
              )}
            </>
          )}
          {tooltip.data.games && !tooltip.data.championLevel && (
            <div className="text-sm text-gray-300">
              Played {tooltip.data.games} games
            </div>
          )}
        </div>
      )}
    </div>
  );
}