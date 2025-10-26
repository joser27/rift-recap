// src/app/components/ProgressChart.jsx
'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

export default function ProgressChart({ matches, playerPuuid }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!matches || matches.length === 0 || !playerPuuid) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Calculate rolling 10-game KDA average
    const data = matches.map((match, index) => {
      const participant = match?.info?.participants?.find(p => p.puuid === playerPuuid);
      if (!participant) return null;
      
      const kda = ((participant.kills + participant.assists) / Math.max(participant.deaths, 1));
      
      // Calculate rolling average for last 10 games
      const windowStart = Math.max(0, index - 9);
      const windowMatches = matches.slice(windowStart, index + 1);
      const windowKdas = windowMatches
        .map(m => {
          const p = m?.info?.participants?.find(part => part.puuid === playerPuuid);
          return p ? ((p.kills + p.assists) / Math.max(p.deaths, 1)) : 0;
        })
        .filter(k => k > 0);
      
      const rollingKda = windowKdas.length > 0 
        ? windowKdas.reduce((sum, k) => sum + k, 0) / windowKdas.length 
        : kda;
      
      return {
        index: index,
        kda: kda,
        rollingKda: rollingKda,
        win: participant.win,
        champion: participant.championName,
        gameCreation: match.info.gameCreation,
        matchId: match.metadata?.matchId
      };
    }).filter(d => d !== null);

    if (data.length === 0) return;

    // Set up SVG dimensions
    const width = 800;
    const height = 300;
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Create scales
    const xScale = d3.scaleLinear()
      .domain([0, data.length - 1])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.rollingKda))
      .nice()
      .range([innerHeight, 0]);

    // Create axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(Math.min(10, data.length))
      .tickFormat(d => `Game ${d + 1}`);

    const yAxis = d3.axisLeft(yScale)
      .tickFormat(d => d.toFixed(1));

    // Add axes
    svg.append("g")
      .attr("transform", `translate(${margin.left}, ${height - margin.bottom})`)
      .call(xAxis)
      .selectAll("text")
      .style("fill", "#9CA3AF")
      .style("font-size", "12px");

    svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .call(yAxis)
      .selectAll("text")
      .style("fill", "#9CA3AF")
      .style("font-size", "12px");

    // Add axis labels with better visibility
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 10)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", "#E5E7EB")
      .style("font-size", "13px")
      .style("font-weight", "600")
      .text("KDA (10-game rolling average)");

    svg.append("text")
      .attr("transform", `translate(${width / 2}, ${height})`)
      .style("text-anchor", "middle")
      .style("fill", "#E5E7EB")
      .style("font-size", "13px")
      .style("font-weight", "600")
      .text("Game Number");

    // Create line generator
    const line = d3.line()
      .x(d => margin.left + xScale(d.index))
      .y(d => margin.top + yScale(d.rollingKda))
      .curve(d3.curveMonotoneX);

    // Add the main trend line
    svg.append("path")
      .datum(data)
      .attr("d", line)
      .attr("stroke", "#3B82F6")
      .attr("stroke-width", 3)
      .attr("fill", "none");

    // Add individual game points (colored by win/loss)
    svg.selectAll(".game-point")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "game-point")
      .attr("cx", d => margin.left + xScale(d.index))
      .attr("cy", d => margin.top + yScale(d.rollingKda))
      .attr("r", 4)
      .attr("fill", d => d.win ? "#10B981" : "#EF4444")
      .attr("stroke", "#1F2937")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        // Show tooltip
        const tooltip = d3.select("body").append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.8)")
          .style("color", "white")
          .style("padding", "8px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "1000");

        tooltip.html(`
          <div><strong>Game ${d.index + 1}</strong></div>
          <div>${d.champion} - ${d.win ? 'Victory' : 'Defeat'}</div>
          <div>KDA: ${d.kda.toFixed(2)}</div>
          <div>Rolling Avg: ${d.rollingKda.toFixed(2)}</div>
        `);

        d3.select(this)
          .attr("r", 6)
          .style("stroke-width", 2);
      })
      .on("mousemove", function(event) {
        d3.select(".tooltip")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        d3.select(".tooltip").remove();
        d3.select(this)
          .attr("r", 4)
          .style("stroke-width", 1);
      });

    // Add trend line (simple linear regression)
    if (data.length > 1) {
      // Calculate linear regression manually
      const n = data.length;
      const sumX = data.reduce((sum, d) => sum + d.index, 0);
      const sumY = data.reduce((sum, d) => sum + d.rollingKda, 0);
      const sumXY = data.reduce((sum, d) => sum + (d.index * d.rollingKda), 0);
      const sumXX = data.reduce((sum, d) => sum + (d.index * d.index), 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      // Create trend line data points
      const trendData = [
        [0, intercept],
        [data.length - 1, slope * (data.length - 1) + intercept]
      ];
      
      const trendLine = d3.line()
        .x(d => margin.left + xScale(d[0]))
        .y(d => margin.top + yScale(d[1]))
        .curve(d3.curveLinear);

      svg.append("path")
        .datum(trendData)
        .attr("d", trendLine)
        .attr("stroke", "#F59E0B")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5")
        .attr("fill", "none");
    }

    // Calculate and display trend
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = firstHalf.length > 0 
      ? firstHalf.reduce((sum, d) => sum + d.rollingKda, 0) / firstHalf.length 
      : 0;
    const secondAvg = secondHalf.length > 0 
      ? secondHalf.reduce((sum, d) => sum + d.rollingKda, 0) / secondHalf.length 
      : 0;
    
    const trendDirection = secondAvg > firstAvg ? "improving" : "declining";
    const trendPercent = firstAvg > 0 ? Math.abs(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

    // Add trend text
    svg.append("text")
      .attr("x", margin.left + innerWidth - 10)
      .attr("y", margin.top + 20)
      .attr("text-anchor", "end")
      .style("fill", trendDirection === "improving" ? "#10B981" : "#EF4444")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .text(`Trend: ${trendDirection} ${trendPercent.toFixed(1)}%`);

  }, [matches, playerPuuid]);

  if (!matches || matches.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <p className="text-gray-400">No match data available for progress chart</p>
      </div>
    );
  }

  // Calculate trend for display
  const firstHalfData = matches.slice(0, Math.floor(matches.length / 2));
  const secondHalfData = matches.slice(Math.floor(matches.length / 2));
  
  const calcAvgKDA = (matchList) => {
    const kdas = matchList.map(m => {
      const p = m?.info?.participants?.find(part => part.puuid === playerPuuid);
      return p ? ((p.kills + p.assists) / Math.max(p.deaths, 1)) : 0;
    }).filter(k => k > 0);
    return kdas.length > 0 ? kdas.reduce((sum, k) => sum + k, 0) / kdas.length : 0;
  };
  
  const firstAvg = calcAvgKDA(firstHalfData);
  const secondAvg = calcAvgKDA(secondHalfData);
  const isImproving = secondAvg > firstAvg;
  const trendPercent = firstAvg > 0 ? Math.abs(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 shadow-xl border border-gray-700">
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <Activity size={24} className="text-blue-400" />
          <h3 className="text-xl font-bold text-white">Your Season Journey</h3>
        </div>
        <p className="text-gray-400 text-sm">
          Performance trend across all {matches.length} games (smoothed with 10-game rolling average)
        </p>
        <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
          isImproving ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
        }`}>
          {isImproving ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {isImproving ? 'Trending Up' : 'Consistent'} • {trendPercent.toFixed(1)}% change
        </div>
      </div>
      
      <div className="flex justify-center">
        <svg ref={svgRef} className="max-w-full h-auto" />
      </div>
      
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span>Victory</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span>Defeat</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-blue-500"></div>
          <span>Rolling Average</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-yellow-500 border-dashed border border-yellow-500"></div>
          <span>Trend Line</span>
        </div>
      </div>
    </div>
  );
}
