// src/lib/awsAi.js
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromEnv } from '@aws-sdk/credential-providers';

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: fromEnv(),
});

// Model IDs
const CLAUDE_HAIKU = 'us.anthropic.claude-3-5-haiku-20241022-v1:0';
const CLAUDE_SONNET = 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
const CLAUDE_3_HAIKU = 'anthropic.claude-3-haiku-20240307-v1:0';

// Current live-game grounding to reduce outdated recommendations
const PATCH_CONTEXT = `Current date: Oct 12, 2025
Current League of Legends patch: 25.19

Important, factual constraints:
- Mythic items were removed in Season 2024. Do not refer to mythic passives.
- Prowler's Claw was removed. Never recommend it.
- If you are not 100% certain an item/rune exists this patch, do not recommend it.
- Prefer playstyle/macro guidance when uncertain, or direct the user to up-to-date sources (u.gg / op.gg).

Response policy for builds/items:
- If no explicit current items are provided in context, keep advice general (e.g., lethality vs survivability, spike timings) and suggest checking u.gg/op.gg for exact builds.
- Never fabricate or guess specific items.`;

/**
 * Call Claude via AWS Bedrock with retry logic
 */
export async function callClaude(prompt, options = {}) {
  const {
    model = CLAUDE_HAIKU,
    maxTokens = 2048,
    temperature = 0.7,
    system = null,
    retries = 2 // Default 2 retries for intermittent failures
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const payload = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        temperature: temperature,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      };

      if (system) {
        payload.system = system;
      }

      const command = new InvokeModelCommand({
        modelId: model,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload),
      });

      console.log(`📡 Calling Claude (${model})... [attempt ${attempt + 1}/${retries + 1}]`);
      const response = await client.send(command);
      
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const text = responseBody.content[0].text;
      
      console.log('✅ Claude response received');
      return text;

    } catch (error) {
      lastError = error;
      console.error(`❌ Bedrock Error (attempt ${attempt + 1}):`, error.message);
      console.error('Error details:', {
        name: error.name,
        code: error.$metadata?.httpStatusCode,
        retryable: error.$retryable
      });
      
      // Fallback to older model if needed
      if (error.name === 'ValidationException' && model === CLAUDE_HAIKU) {
        console.log('⚠️  Trying fallback model...');
        return callClaude(prompt, { ...options, model: CLAUDE_3_HAIKU, retries: 0 });
      }
      
      // Don't retry on certain errors
      if (error.name === 'ValidationException' || error.name === 'AccessDeniedException') {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Max 5 seconds
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed
  throw lastError;
}

function formatMatchContext(match, playerPuuid) {
  try {
    const p = match?.info?.participants?.find(x => x.puuid === playerPuuid);
    if (!p) return null;
    const champ = p.championName;
    const k = p.kills, d = p.deaths, a = p.assists;
    const role = p.teamPosition || 'FILL';
    const win = p.win ? 'Victory' : 'Defeat';
    const durS = match?.info?.gameDuration || 0;
    const mins = Math.floor(durS / 60);
    const secs = durS % 60;
    const kdaRatio = ((k + a) / Math.max(d, 1)).toFixed(2);
    return `Match: ${champ} ${k}/${d}/${a} (KDA ${kdaRatio}), Role: ${role}, Result: ${win}, Duration: ${mins}m ${secs}s`;
  } catch {
    return null;
  }
}

/**
 * Build prompts for the dialogue assistant
 * @param {boolean} includeFollowups - If true, asks Claude to include followup questions in response
 */
export function buildDialoguePrompt(kind, profileData, extra, includeFollowups = true) {
  const baseSystem = 'You are a friendly Poro companion from League of Legends. Speak warmly, concisely, and naturally. Do not use roleplay actions or stage directions. Do not use asterisks. Avoid numbered or bulleted lists. Keep responses short and conversational.\n\nAdhere to the CURRENT PATCH CONTEXT strictly:\n' + PATCH_CONTEXT;

  const { account, summoner, matches } = profileData || {};
  const playerLine = account && summoner
    ? `${account.gameName}#${account.tagLine} (Level ${summoner.summonerLevel})`
    : 'Unknown Player';

  // Extract stats to give Claude context
  let statsContext = '';
  if (matches && matches.length > 0 && account?.puuid) {
    const stats = extractMatchStats(matches, account.puuid);
    const topChamps = stats.topChampions.map(c => `${c.name} (${c.games})`).join(', ');
    statsContext = `\n\nRECENT PERFORMANCE:
- Win Rate: ${stats.winRate}%
- KDA: ${stats.kda} (${stats.avgKills}/${stats.avgDeaths}/${stats.avgAssists})
- Top Champions: ${topChamps}
- Main Role: ${stats.mainRole}
- Games Analyzed: ${stats.totalGames}`;
  }

  const preface = `Player: ${playerLine}\nMatches Available: ${matches?.length || 0}${statsContext}`;

  // Followup suffix to append to main prompts
  const followupSuffix = includeFollowups 
    ? '\n\nAfter your response, suggest 3 short follow-up questions the user might ask (related to your answer and their data). Format: FOLLOWUPS: question1 | question2 | question3'
    : '';

  const prompts = {
    initial: `Give a warm, enthusiastic greeting (max 2–3 sentences). Be punchy and upbeat. Include their general playstyle personality. No asterisks, no roleplay actions, no lists.\n\n${preface}${followupSuffix}`,
    more: `Explain their playstyle in a friendly tone (max 3–4 sentences). Focus on patterns in champions, roles, and combat style. Keep it conversational, no lists, no asterisks. Avoid specific item/rune recommendations unless explicitly provided as current.\n\n${preface}${followupSuffix}`,
    improve: `Offer constructive, encouraging tips (max 3–4 sentences). Keep it practical and positive. No lists; flow naturally. No asterisks. Avoid specific build/item calls unless explicitly provided as current.\n\n${preface}${followupSuffix}`,
    compare: `Briefly compare them to similar players (max 3–4 sentences). Keep it positive and actionable. No lists; conversational. No asterisks. Do not cite specific items unless provided as current.\n\n${preface}${followupSuffix}`,
    surprise: `Share an interesting pattern or fun observation (max 3–4 sentences). Keep it playful, no lists, no asterisks.\n\n${preface}${followupSuffix}`,
    custom: (extra?.question ? `Answer the user's question about their gameplay (max 3–4 sentences). Keep it specific to their data. No lists; conversational. No asterisks. If the question asks for item/build advice and no current items are provided, give general guidance and direct them to u.gg/op.gg for exact builds.\n\nQuestion: ${extra.question}\n\n${preface}${followupSuffix}` : `Answer the user's question briefly (max 3–4 sentences).\n\n${preface}${followupSuffix}`),
    match: (() => {
      const ctx = extra?.match && profileData?.account?.puuid
        ? formatMatchContext(extra.match, profileData.account.puuid)
        : null;
      return `${ctx ? ctx + '\n\n' : ''}Analyze this specific match for the player above (max 3–4 sentences). Explain what went right or wrong and give one key takeaway to try next time. Be friendly and conversational. No lists, no asterisks.${followupSuffix}`;
    })(),
    followups: (extra?.lastAnswer ? `Based on the assistant's last reply and the player's data, suggest three short follow-up questions the user might ask next. Keep them distinct and engaging. Output ONLY the three questions separated by the pipe character (|). No extra text.\n\nLast reply: ${extra.lastAnswer}\n\n${preface}` : `Suggest three short follow-up questions separated by | about the player's data. No extra text.\n\n${preface}`),
  };

  return { system: baseSystem, prompt: prompts[kind] || prompts.initial };
}

/**
 * Extract statistics from matches
 */
function extractMatchStats(matches, playerPuuid) {
  const stats = {
    totalGames: matches.length,
    wins: 0,
    losses: 0,
    championCounts: {},
    totalKills: 0,
    totalDeaths: 0,
    totalAssists: 0,
    roles: {},
    avgGameDuration: 0,
    firstBloods: 0,
    pentaKills: 0,
  };

  matches.forEach(match => {
    const player = match.info.participants.find(p => p.puuid === playerPuuid);
    if (!player) return;

    // Win/Loss
    if (player.win) stats.wins++;
    else stats.losses++;

    // Champion pool
    stats.championCounts[player.championName] = 
      (stats.championCounts[player.championName] || 0) + 1;

    // KDA
    stats.totalKills += player.kills;
    stats.totalDeaths += player.deaths;
    stats.totalAssists += player.assists;

    // Role
    const role = player.teamPosition || 'UNKNOWN';
    stats.roles[role] = (stats.roles[role] || 0) + 1;

    // Special stats
    if (player.firstBloodKill) stats.firstBloods++;
    if (player.pentaKills > 0) stats.pentaKills += player.pentaKills;

    // Duration
    stats.avgGameDuration += match.info.gameDuration;
  });

  // Calculate averages
  stats.winRate = ((stats.wins / stats.totalGames) * 100).toFixed(1);
  stats.avgKills = (stats.totalKills / stats.totalGames).toFixed(1);
  stats.avgDeaths = (stats.totalDeaths / stats.totalGames).toFixed(1);
  stats.avgAssists = (stats.totalAssists / stats.totalGames).toFixed(1);
  stats.kda = ((stats.totalKills + stats.totalAssists) / Math.max(stats.totalDeaths, 1)).toFixed(2);
  stats.avgGameDuration = Math.floor(stats.avgGameDuration / stats.totalGames / 60); // minutes

  // Top 3 champions
  stats.topChampions = Object.entries(stats.championCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([champ, count]) => ({ name: champ, games: count }));

  // Main role
  stats.mainRole = Object.entries(stats.roles)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'FILL';

  return stats;
}

/**
 * Generate insights from match data
 */
export async function generatePlayerInsights(profileData) {
  const { account, summoner, matches, mastery } = profileData;

  // Extract key stats
  const stats = extractMatchStats(matches, account.puuid);

  // Format mastery data if available - map championId to name from recent matches
  let masteryText = '';
  if (mastery && mastery.length > 0) {
    // Build championId -> championName map from matches
    const champIdToName = new Map();
    matches.forEach(m => {
      m?.info?.participants?.forEach(p => {
        if (p.championId && p.championName) {
          champIdToName.set(p.championId, p.championName);
        }
      });
    });

    const topMastery = mastery.slice(0, 5)
      .filter(m => m.championLevel != null)
      .map(m => {
        const name = champIdToName.get(m.championId) || `Champion ${m.championId}`;
        return `${name} - Level ${m.championLevel} (${(m.championPoints || 0).toLocaleString()} pts)`;
      })
      .join(', ');
    if (topMastery) {
      masteryText = `\n- Top Mastery Champions: ${topMastery}`;
    }
  }

  // Create prompt for Claude
  const prompt = `You are an expert League of Legends coach analyzing a player's performance. Be insightful, specific, and add some personality - make it fun but helpful!

Player: ${account.gameName}#${account.tagLine}
Level: ${summoner.summonerLevel}
Matches Analyzed: ${matches.length}

STATISTICS:
- Win Rate: ${stats.winRate}%
- KDA: ${stats.kda}
- Average: ${stats.avgKills}/${stats.avgDeaths}/${stats.avgAssists}
- Top Champions: ${stats.topChampions.map(c => `${c.name} (${c.games} games)`).join(', ')}
- Main Role: ${stats.mainRole}
- First Bloods: ${stats.firstBloods}
- Penta Kills: ${stats.pentaKills}
- Avg Game Duration: ${stats.avgGameDuration} minutes${masteryText}

Generate a "Champion Personality" insight that:
1. Gives them a memorable nickname based on their playstyle
2. Describes their playstyle with specific data (consider both recent match performance AND overall mastery - mastery shows long-term champion expertise)
3. Highlights their main strength
4. Points out one area to improve (be constructive!)
5. Include a fun fact from their stats
6. Keep it under 200 words total
7. Be engaging and personal - make them want to share it!

Format as JSON:
{
  "title": "Champion Personality",
  "nickname": "A catchy 2-4 word nickname",
  "summary": "Main 2-3 sentence overview of their playstyle",
  "strength": "One specific strength with data",
  "weakness": "One area to improve with advice",
  "funFact": "Something interesting or funny from their stats"
}`;

  try {
    const response = await callClaude(prompt, {
      temperature: 0.8, // More creative
      maxTokens: 1500
    });

    // Try to parse as JSON - handle various formats
    let jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        // Try direct parse first
        return JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        // If that fails, try cleaning up common issues
        let cleaned = jsonMatch[0]
          .replace(/[\u2018\u2019]/g, "'")  // Smart quotes to straight quotes
          .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes
          .replace(/,(\s*[}\]])/g, '$1')    // Remove trailing commas
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // Quote unquoted keys
        
        try {
          return JSON.parse(cleaned);
        } catch (e) {
          console.warn('JSON parse failed even after cleanup:', e.message);
        }
      }
    }

    // Fallback if not JSON
    return {
      title: "Champion Personality",
      nickname: "League Player",
      summary: response,
      strength: "Analyzing your playstyle...",
      weakness: "Gathering more data...",
      funFact: `You've played ${stats.totalGames} games!`
    };

  } catch (error) {
    console.error('Failed to generate insights:', error);
    throw error;
  }
}