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
 * Call Claude via AWS Bedrock
 */
export async function callClaude(prompt, options = {}) {
  const {
    model = CLAUDE_HAIKU,
    maxTokens = 2048,
    temperature = 0.7,
    system = null
  } = options;

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

    console.log(`📡 Calling Claude (${model})...`);
    const response = await client.send(command);
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text = responseBody.content[0].text;
    
    console.log('✅ Claude response received');
    return text;

  } catch (error) {
    console.error('❌ Bedrock Error:', error.message);
    
    // Fallback to older model if needed
    if (error.name === 'ValidationException' && model === CLAUDE_HAIKU) {
      console.log('⚠️  Trying fallback model...');
      return callClaude(prompt, { ...options, model: CLAUDE_3_HAIKU });
    }
    
    throw error;
  }
}

/**
 * Build prompts for the dialogue assistant
 */
export function buildDialoguePrompt(kind, profileData, extra) {
  const baseSystem = 'You are a friendly Poro companion from League of Legends. Speak warmly, concisely, and naturally. Do not use roleplay actions or stage directions. Do not use asterisks. Avoid numbered or bulleted lists. Keep responses short and conversational.\n\nAdhere to the CURRENT PATCH CONTEXT strictly:\n' + PATCH_CONTEXT;

  const { account, summoner, matches } = profileData || {};
  const playerLine = account && summoner
    ? `${account.gameName}#${account.tagLine} (Level ${summoner.summonerLevel})`
    : 'Unknown Player';

  const preface = `Player: ${playerLine}\nMatches Available: ${matches?.length || 0}`;

  const prompts = {
    initial: `Give a warm, enthusiastic greeting (max 2–3 sentences). Be punchy and upbeat. Include their general playstyle personality. No asterisks, no roleplay actions, no lists.\n\n${preface}`,
    more: `Explain their playstyle in a friendly tone (max 3–4 sentences). Focus on patterns in champions, roles, and combat style. Keep it conversational, no lists, no asterisks. Avoid specific item/rune recommendations unless explicitly provided as current.\n\n${preface}`,
    improve: `Offer constructive, encouraging tips (max 3–4 sentences). Keep it practical and positive. No lists; flow naturally. No asterisks. Avoid specific build/item calls unless explicitly provided as current.\n\n${preface}`,
    compare: `Briefly compare them to similar players (max 3–4 sentences). Keep it positive and actionable. No lists; conversational. No asterisks. Do not cite specific items unless provided as current.\n\n${preface}`,
    surprise: `Share an interesting pattern or fun observation (max 3–4 sentences). Keep it playful, no lists, no asterisks.\n\n${preface}`,
    custom: (extra?.question ? `Answer the user's question about their gameplay (max 3–4 sentences). Keep it specific to their data. No lists; conversational. No asterisks. If the question asks for item/build advice and no current items are provided, give general guidance and direct them to u.gg/op.gg for exact builds.\n\nQuestion: ${extra.question}\n\n${preface}` : `Answer the user's question briefly (max 3–4 sentences).\n\n${preface}`),
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
  const { account, summoner, matches } = profileData;

  // Extract key stats
  const stats = extractMatchStats(matches, account.puuid);

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
- Avg Game Duration: ${stats.avgGameDuration} minutes

Generate a "Champion Personality" insight that:
1. Gives them a memorable nickname based on their playstyle
2. Describes their playstyle with specific data
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

    // Try to parse as JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
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