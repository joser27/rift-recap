# Rift Rewind 🎮

**Your Season, Your Story** - AI-powered League of Legends year-end recap for the AWS x Riot Games Hackathon.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-orange)](https://aws.amazon.com/bedrock/)
[![Riot API](https://img.shields.io/badge/Riot-API-red)](https://developer.riotgames.com/)

**Live Demo:** https://rift-recap.vercel.app/ 
**Devpost:** https://riftrewind.devpost.com/

---

## 📋 Project Intent

### The Problem
League of Legends players generate massive amounts of gameplay data throughout the year, but current tools (like op.gg) only show raw statistics without meaningful context. Players want to understand their growth, celebrate wins, and get actionable feedback - but existing solutions are purely data-driven with no personality or storytelling.

### Our Solution
Rift Rewind uses **generative AI on AWS Bedrock** to transform raw match history into personalized, shareable year-end recaps - think "Spotify Wrapped" for League of Legends. The AI analyzes playstyle patterns, identifies strengths/weaknesses, and generates engaging narratives that players actually want to share with friends.

### Why This Matters
- **For Players:** Meaningful reflection on their League journey with actionable insights
- **For the Hackathon:** Demonstrates creative use of AWS AI services beyond typical chatbot applications
- **For Me:** Learning AWS Bedrock, Next.js App Router, and AI prompt engineering in a real project

### Key Innovation
Unlike competitor sites that just show stats, we use **Claude 3.5 Haiku on AWS Bedrock** to generate natural language insights with personality. Our dual-mode system (instant demo accounts + real-time analysis) ensures great UX during judging while proving the system works for any of the 180M+ League players.

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **React 18** - UI components (functional components with hooks)
- **Tailwind CSS** - Utility-first styling
- **D3.js** - Data visualizations (packed bubble chart)
- **Custom components** - No UI library for full control

### Backend (Serverless)
- **Next.js API Routes** - Serverless functions deployed as AWS Lambda (via Vercel)
- **No database** - Stateless architecture, data fetched on-demand

### APIs & Services
- **Riot Games API** - League of Legends match history data
  - Rate limited: 20 req/sec, 100 req/2min
  - Using parallel fetching with `p-limit` for optimal performance
- **AWS Bedrock** - Claude 3.5 Haiku for AI text generation
  - Cost: ~$0.0004 per insight (extremely cheap)
  - Credential provider pattern for secure authentication

### Deployment
- **Vercel** - Hosting & serverless function execution
- **GitHub** - Version control & CI/CD

### Key Libraries
- `@aws-sdk/client-bedrock-runtime` - AWS Bedrock API client
- `@aws-sdk/credential-providers` - AWS credential management
- `p-limit` - Concurrency control for API calls
- `d3` - Data visualization library for bubble charts
- `lucide-react` - Icon library
- `dotenv` - Environment variable management

---

## 📁 Folder Structure
```
rift-recap/
├── public/
│   ├── demo-data/              # Pre-fetched demo accounts (JSON files)
│   │   ├── yinyatsui-na1.json  # 200 matches + AI insights
│   │   ├── solorenektononly-na1.json
│   │   └── t1 ok good yes-na1.json
│   └── lolAssets/              # Local League of Legends assets
│       ├── cursor/             # Custom cursor images
│       └── lol/roles/          # Role icons (top, jungle, mid, etc.)
│
├── src/
│   ├── app/                    # Next.js App Router (Pages + API)
│   │   ├── api/                # Serverless API routes
│   │   │   ├── summoner/route.js      # GET: Fetch summoner + 20 matches
│   │   │   ├── match/route.js         # GET: Pagination (start/count params)
│   │   │   ├── insights/route.js      # POST: Generate AI insights
│   │   │   ├── mastery/route.js       # GET: Fetch top champion mastery
│   │   │   ├── champion-icon/route.js   # GET: Proxy champion images
│   │   │   ├── item-icon/route.js       # GET: Proxy item images (Data Dragon)
│   │   │   ├── summoner-spell/route.js  # GET: Proxy spell images with ID mapping
│   │   │   ├── ranked-emblem/route.js   # GET: Proxy ranked tier emblems
│   │   │   └── ai/route.js              # POST: Poro dialogue with combined followups
│   │   │
│   │   ├── components/         # React components
│   │   │   ├── PoroAssistant.jsx     # Interactive Poro sprite
│   │   │   ├── poro.module.css       # Poro animations & styles
│   │   │   ├── DialogueBox.jsx       # Chat bubble UI
│   │   │   ├── DialogueBox.module.css
│   │   │   └── MasteryBubbleChart.jsx # D3.js bubble visualization
│   │   │
│   │   ├── globals.css         # Tailwind base + custom cursor
│   │   ├── layout.js           # Root layout
│   │   └── page.js             # Main UI (search, results, interactions)
│   │
│   └── lib/                    # Shared utilities & helpers
│       ├── riotApi.js          # Riot API wrapper
│       │                       # - getPlayerProfile(gameName, tagLine)
│       │                       # - getChampionMasteryTop(summonerId, count)
│       │                       # - getAdditionalMatches(puuid, start, count)
│       └── awsAi.js            # AWS Bedrock wrapper
│                               # - callClaude(prompt, options)
│                               # - generatePlayerInsights(profileData)
│                               # - buildDialoguePrompt(kind, profile, extra)
│
├── scripts/
│   └── fetch-demo-accounts.mjs # Pre-fetch 200 matches for demos
│
├── .env.local                  # Environment variables (NOT in git)
├── .gitignore
├── package.json                # Dependencies: d3, @aws-sdk/*, p-limit
├── jsconfig.json               # Path aliases (@/* → ./src/*)
├── eslint.config.mjs           # ESLint rules (@next/next/no-img-element: off)
├── next.config.mjs
└── README.md
```

### Important File Purposes

| File | Purpose | Notes |
|------|---------|-------|
| `src/lib/riotApi.js` | Abstracts all Riot API calls | Rate limiting, retries, parallel fetching, mastery API |
| `src/lib/awsAi.js` | Abstracts AWS Bedrock calls | Prompt engineering, JSON parsing, mastery integration |
| `src/app/api/summoner/route.js` | Fetches player data | Account + summoner + 20 matches |
| `src/app/api/match/route.js` | Fetch additional matches | Pagination with `puuid`, `start`, `count` |
| `src/app/api/mastery/route.js` | Fetch champion mastery | Top 40 champions by mastery points |
| `src/app/api/champion-icon/route.js` | Proxy champion images | Avoids ORB/CORS, includes fallbacks |
| `src/app/api/item-icon/route.js` | Proxy item images | Data Dragon v15.20.1, transparent placeholders |
| `src/app/api/summoner-spell/route.js` | Proxy summoner spell images | ID→name mapping, supports ARAM/Arena |
| `src/app/api/ranked-emblem/route.js` | Proxy ranked tier emblems | Iron → Challenger, Community Dragon |
| `src/app/api/insights/route.js` | Generates AI insights | Includes match + mastery analysis |
| `src/app/api/ai/route.js` | Poro dialogue responses | Interactive Q&A with Claude, combined followups |
| `src/app/page.js` | Main UI component | Search, mastery chart, match history, Poro |
| `src/app/components/MasteryBubbleChart.jsx` | D3.js visualization | Packed bubble chart with tooltips |
| `src/app/components/PoroAssistant.jsx` | Interactive mascot | Clickable Poro with animations |
| `public/demo-data/*.json` | Pre-fetched demo data | 200 matches each for instant loading |

---

## 🎯 Features

### ✅ Core Features (Week 1)
- [x] Riot API integration with parallel fetching (20+ concurrent requests)
- [x] Summoner search (Riot ID format: `GameName#TAG`)
- [x] Match history display with detailed stats (KDA, CS, damage, vision, gold)
- [x] AWS Bedrock integration (Claude 3.5 Haiku)
- [x] AI-generated "Champion Personality" insight with nickname, strengths, weaknesses
- [x] Demo account system (instant pre-loaded demos vs. live API fetch)
- [x] Error handling & user feedback

### ✅ Visual & UX Improvements (Week 2)
- [x] **Champion Image Proxy** - Server-side proxy at `/api/champion-icon` to avoid browser ORB/CORS blocking
- [x] **Ranked Emblem Display** - Shows player's competitive rank
  - Fetches Solo Queue (or Flex) rank via PUUID
  - Displays tier emblem, rank, LP, and W/L record
  - Compact inline layout next to summoner name
  - Auto-hides for unranked players
- [x] **Item & Spell Icons** - Full match card asset display
  - Items: 6 equipment slots + trinket with Data Dragon v15.20.1
  - Summoner Spells: Flash, Ignite, etc. with ID→name mapping
  - Desktop: Inline grid layout next to champion
  - Mobile: Items in separate scrollable row
  - Graceful fallback for Arena/special game modes
- [x] **Top Mastery Bubble Chart** - D3.js packed bubble visualization showing top 40 mastery champions
  - Interactive hover tooltips with mastery points and levels
  - Desktop: Fixed left sidebar (600px)
  - Mobile: Responsive section below Champion Personality
- [x] **Interactive Poro Assistant** - Clickable Poro that toggles dialogue visibility
  - Desktop: Full size, bottom-right corner
  - Mobile: 60% scaled, repositioned for better UX
  - 50% API call reduction via combined response pattern
- [x] **Match History Auto-Open** - Recent matches section expanded by default
- [x] **Mobile Responsive Design**:
  - Stacked match cards (op.gg style)
  - Teams displayed as "hamburger" rows on mobile
  - Responsive typography and spacing
  - Dialogue buttons stack vertically
  - Touch-optimized spacing and tap targets
- [x] **Enhanced AI Insights** - Now analyzes both recent matches AND champion mastery data
  - Poro dialogue includes full stats context (win rate, KDA, top champions)
  - More accurate and personalized responses
- [x] **Load More Matches** - On-demand pagination (20 matches at a time)
  - Graceful handling when no more matches available
  - Clear error messaging

### 🎨 Technical Improvements
- [x] **Multi-CDN Image Proxy System** - 4 API routes with fallback chains
  - Champion icons: Community Dragon → GitHub raw
  - Items: Data Dragon → Community Dragon → placeholder
  - Spells: Data Dragon → Community Dragon → placeholder
  - Ranked emblems: Community Dragon (all tiers)
  - Transparent 1x1 PNG placeholders for missing assets
- [x] **Data Dragon Integration** - Using Riot's official CDN (v15.20.1)
- [x] **AI Optimization** - Combined response pattern (50% API call reduction)
  - Single call returns both answer + followup questions
  - Retry logic with exponential backoff
  - Enhanced error logging with AWS metadata
- [x] ChampionId → ChampionName mapping from match data
- [x] Robust JSON parsing with smart quote handling
- [x] D3.js data validation to prevent pack layout errors
- [x] ESLint config updated to allow `<img>` tags (using custom proxy)
- [x] Demo accounts now fetch 200 matches instead of 20
- [x] Lazy loading for all images (performance optimization)
- [x] 24-hour edge caching for CDN assets

### 🚧 In Progress
- [ ] Additional demo accounts for judging

### 📅 Planned (Week 3)
- [ ] Shareable image cards (Spotify Wrapped style)
- [ ] 3-minute demo video
- [ ] Final polish & testing

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** (for Next.js)
- **Riot Games Developer API Key** (free, expires every 24 hours)
- **AWS Account** with Bedrock access (free tier sufficient)
- **Git** for version control

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/YOUR_USERNAME/rift-rewind.git
cd rift-rewind

Install dependencies:

```bash
npm install

Set up environment variables:

Create .env.local in the project root:
```bash
# Riot Games API (get from https://developer.riotgames.com/)
RIOT_API_KEY=RGAPI-your-key-here

# AWS Bedrock Credentials (from IAM user)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
Important Notes:

Riot API keys expire every 24 hours - regenerate daily
Never commit .env.local to Git (already in .gitignore)
AWS credentials should have AmazonBedrockFullAccess policy attached


Enable AWS Bedrock models:


Go to AWS Console → Amazon Bedrock → Model access
Request access to: Claude 3.5 Haiku
Wait 2-5 minutes for approval


Run the development server:

```bash
npm run dev

Open your browser:


Navigate to http://localhost:3000
Try the demo account: Click "⚡ Bosey#NA1"
Or search any summoner: e.g., Faker#KR1


🔧 New Configuration/Assets

Custom Cursor (global + interactive elements):

```css
/* globals.css */
html, body, * {
  cursor: url('/lolAssets/cursor/hand1.png') 8 2, auto;
}

button, a, [role="button"], input[type="submit"], input[type="button"],
summary, [onclick], .cursor-pointer {
  cursor: url('/lolAssets/cursor/hand2.png') 8 2, pointer !important;
}
```

Champion icons via CDN (CommunityDragon) using championId:

```javascript
// Example (used in page.js)
const championIconUrl = (championId) => `https://cdn.communitydragon.org/latest/champion/${championId}/square`;
```

Role icons (local): place PNGs in `public/lolAssets/lol/roles/` with filenames: `top.png`, `jungle.png`, `middle.png`, `bottom.png`, `support.png`, `fill.png`, `unknown.png`.


🎮 How It Works
User Flow
User enters summoner name
    ↓
Check if demo account exists
    ↓
┌─────────────┬─────────────┐
│ Demo Mode   │ Live Mode   │
│ (instant)   │ (~15 sec)   │
└─────────────┴─────────────┘
    ↓               ↓
Load from       Fetch from
JSON file       Riot API
    ↓               ↓
    └───────┬───────┘
            ↓
    Display match history
            ↓
    Generate AI insights
    (AWS Bedrock)
            ↓
    Display personalized recap
Demo vs. Live Mode
Demo Mode (Instant)

Pre-fetched data stored in public/demo-data/
No API calls, no AI generation
Perfect for judging/demos
Cost: $0

Live Mode (~15 seconds)

Real-time Riot API fetch (20 matches)
AWS Bedrock AI generation (fresh insights)
Works for any League player
Cost: ~$0.0004 per request

Data Flow
1. Frontend (page.js)
   ↓ POST /api/summoner?gameName=X&tagLine=Y
   
2. API Route (api/summoner/route.js)
   ↓ Call riotApi.getPlayerProfile()
   
3. Riot API Helper (lib/riotApi.js)
   ↓ Parallel fetch: Account + Summoner + 20 Matches
   
4. Return profile data to frontend
   ↓ Optional: GET /api/match?puuid=...&start=20&count=20 (Load More)
   ↓ POST /api/insights with profile data
   
5. Insights API (api/insights/route.js)
   ↓ Call awsAi.generatePlayerInsights()
   
6. AWS Bedrock (lib/awsAi.js)
   ↓ Send prompt with match stats to Claude
   
7. Parse AI response → Return insights
   ↓
8. Display in UI

🧪 Testing
Quick Tests
```bash
# Test Riot API (from project root)
node src/app/api/test-api.mjs

# Test AWS Bedrock
node src/app/api/test-bedrock.mjs

# Pre-fetch demo accounts
node scripts/fetch-demo-accounts.mjs
Manual Testing in Browser

**Demo Account Test:**
- Click "⚡ YinYatsui#NA1" button
- Should load instantly (<1 second)
- Should show 200 matches + AI insights
- Should display mastery bubble chart immediately

**Live Account Test:**
- Search any summoner (e.g., `Doublelift#NA1`)
- Should show loading spinner (~2-3 seconds for profile)
- Match history appears, then AI analyzes (~7 seconds)
- Mastery bubble chart loads on the left (desktop) or below personality (mobile)


Error Handling Test:

Search non-existent summoner: FakePlayer#NA1
Should show error message (not crash)




💰 Cost Analysis
Current Costs (as of Day 3)
ServiceUsageCostAWS Bedrock (Haiku)~10 insights generated$0.004Riot Games APIFree tier$0Vercel HostingFree tier$0Total Spent~$0.01
Projected Hackathon Costs
PhaseEstimated CostDevelopment (Oct 12 - Nov 10)$2-5Demo/Judging (Dec 1-10)$0.50Total Budget Used~$5 of $70
Cost per insight: $0.0004 (less than a penny!)
Why So Cheap?

Using Claude 3.5 Haiku (10x cheaper than Sonnet)
Pre-fetched demo accounts (no API costs during judging)
Efficient prompt engineering (minimal tokens)
No database costs (stateless architecture)


🐛 Known Issues & Solutions
"401 Unauthorized" from Riot API
Cause: API key expired (they last 24 hours)
Fix:

Go to https://developer.riotgames.com/
Click "Regenerate API Key"
Update RIOT_API_KEY in .env.local
Restart server

"Resolved credential object is not valid"
Cause: AWS credentials format issue
Fix:

Ensure no quotes in .env.local: AWS_ACCESS_KEY_ID=AKIA... (not 'AKIA...')
Use fromEnv() credential provider in awsAi.js
Verify IAM user has AmazonBedrockFullAccess policy

Rate Limiting (429 errors)
Cause: Hitting Riot API limits (20 req/sec)
Solution: Already handled automatically with p-limit and retry logic

Dev Server Starts Slowly After Adding Many Images
Cause:
- Next.js dev server (Turbopack) scans and watches all files in the repo.
- Large local image folders in `public/` significantly increase startup time, especially on Windows.

Solutions Implemented:
- Use CDN for champion icons (CommunityDragon) to avoid bundling thousands of files.
- Keep only small local assets (cursor hands, role icons) in `public/`.

Extra Tips:
- Consider running in WSL2 and storing the repo in the Linux filesystem for faster dev on Windows.
- Exclude the project folder from antivirus real-time scanning.
- You can try `next dev --no-turbo` once to compare startup characteristics.

🏗️ Development Timeline
DateMilestoneStatusOct 11Riot API integration, basic UI✅ CompleteOct 12AWS Bedrock setup, first AI insight✅ CompleteOct 13Demo accounts, UI polish✅ CompleteOct 14-17Additional insights, visualizations🚧 In ProgressOct 18-24Shareable cards, mobile responsive📅 PlannedOct 25-31Demo video, documentation📅 PlannedNov 1-10Final testing, buffer time📅 PlannedNov 10Submission Deadline (2pm PST)🎯 Goal

## 📊 API Documentation

### GET `/api/summoner`
Fetches summoner profile and match history.

**Query Parameters:**
- `gameName` (required): Summoner name
- `tagLine` (optional): Riot tag (default: "NA1")

**Example:**
```bash
curl "http://localhost:3000/api/summoner?gameName=YinYatsui&tagLine=NA1"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "account": { "puuid": "...", "gameName": "YinYatsui", "tagLine": "NA1" },
    "summoner": { "id": "...", "summonerLevel": 293 },
    "matches": [ /* 20 match objects */ ]
  }
}
```

---

### GET `/api/match`
Fetches additional matches (pagination).

**Query Parameters:**
- `puuid` (required): Player UUID
- `start` (optional): Starting index (default: 20)
- `count` (optional): Matches to fetch (default: 20, max: 100)

**Example:**
```bash
curl "http://localhost:3000/api/match?puuid=PLAYER_PUUID&start=20&count=20"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matches": [ /* 20 match objects */ ],
    "hasMore": true
  }
}
```

---

### GET `/api/mastery`
Fetches top champion mastery for a summoner.

**Query Parameters:**
- `puuid` or `summonerId` (required): Player identifier
- `count` (optional): Number of champions (default: 5, max: 200)
- `platform` (optional): Platform (default: "NA1")

**Example:**
```bash
curl "http://localhost:3000/api/mastery?puuid=PLAYER_PUUID&count=40&platform=NA1"
```

**Response:**
```json
{
  "success": true,
  "mastery": [
    {
      "championId": 157,
      "championLevel": 7,
      "championPoints": 1234567,
      "chestGranted": true
    }
  ]
}
```

---

### GET `/api/champion-icon`
Proxies champion square icons from CommunityDragon CDN.

**Query Parameters:**
- `id` (required): Champion ID

**Example:**
```bash
curl "http://localhost:3000/api/champion-icon?id=157"
```

**Response:** PNG image with cache headers

---

### GET `/api/item-icon`
Proxies item icons from Data Dragon (Riot's official CDN).

**Query Parameters:**
- `id` (required): Item ID

**Example:**
```bash
curl "http://localhost:3000/api/item-icon?id=3031"  # Infinity Edge
```

**Response:** PNG image (or transparent placeholder if not found)

**Features:**
- Uses Data Dragon v15.20.1
- Fallback chain: Data Dragon → Community Dragon → placeholder
- 24-hour edge caching
- Supports standard items (trinkets may return placeholder)

---

### GET `/api/summoner-spell`
Proxies summoner spell icons with ID→name mapping.

**Query Parameters:**
- `id` (required): Summoner spell ID

**Example:**
```bash
curl "http://localhost:3000/api/summoner-spell?id=4"  # Flash
```

**Response:** PNG image (or placeholder for unknown IDs)

**Supported Spell IDs:**
- `4` - Flash
- `14` - Ignite
- `11` - Smite
- `12` - Teleport
- `7` - Heal
- `6` - Ghost
- `21` - Barrier
- `3` - Exhaust
- `1` - Cleanse
- `32` - Mark/Dash (ARAM)
- `2201`, `2202` - Arena spells

---

### GET `/api/ranked-emblem`
Proxies ranked tier emblems from Community Dragon.

**Query Parameters:**
- `tier` (required): Ranked tier name

**Example:**
```bash
curl "http://localhost:3000/api/ranked-emblem?tier=GOLD"
```

**Response:** PNG image (or placeholder for unknown tier)

**Supported Tiers:**
- `IRON`, `BRONZE`, `SILVER`, `GOLD`, `PLATINUM`
- `EMERALD`, `DIAMOND`, `MASTER`
- `GRANDMASTER`, `CHALLENGER`
- `UNRANKED` (returns placeholder)

**Features:**
- Uses Community Dragon ranked assets
- 24-hour edge caching
- Case-insensitive tier matching

---

### POST `/api/insights`
Generates AI "Champion Personality" from profile + mastery data.

**Request Body:**
```json
{
  "account": { "puuid": "...", "gameName": "YinYatsui" },
  "summoner": { "summonerLevel": 293 },
  "matches": [ /* match objects */ ],
  "mastery": [ /* mastery objects */ ]
}
```

**Response:**
```json
{
  "success": true,
  "insights": {
    "title": "Champion Personality",
    "nickname": "The Yasuo Specialist",
    "summary": "A dedicated one-trick with incredible champion mastery...",
    "strength": "1M+ mastery points on Yasuo shows deep mechanical skill...",
    "weakness": "Expanding champion pool could improve flexibility...",
    "funFact": "Average game duration of 28 minutes..."
  }
}
```

---

### POST `/api/ai`
Powers the Poro assistant's conversational AI.

**Request Body:**
```json
{
  "kind": "more" | "improve" | "compare" | "surprise" | "custom" | "match" | "followups",
  "profile": { /* profile data */ },
  "question": "optional custom question",
  "match": { /* specific match data */ }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Poro's response text..."
}
```

🤖 AI Context for Future Development
Coding Conventions
JavaScript Style:

Use ES6+ features (arrow functions, async/await, destructuring)
Functional components with React hooks (no class components)
Named exports for utilities, default exports for React components

File Naming:

Components: PascalCase (SummonerCard.jsx)
Utilities: camelCase (riotApi.js)
API routes: lowercase (route.js)

Error Handling:

Always use try-catch in async functions
Return user-friendly error messages
Log detailed errors to console for debugging

API Design:

Keep routes simple and single-purpose
Return consistent JSON format: { success: bool, data/error: object }
Use proper HTTP status codes (200, 400, 404, 500)

Common Patterns
Fetching Data:
```javascript
// Always include error handling
try {
  const res = await fetch('/api/endpoint');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  // Use data
} catch (error) {
  console.error('Error:', error);
  setError(error.message);
}
AWS Bedrock Calls:
```javascript
// Use the helper function
const insights = await generatePlayerInsights(profileData);
// It handles: stats extraction, prompt creation, API call, JSON parsing
Demo vs. Live:
```javascript
// Always check demo first for better UX
const demoData = await checkDemoAccount(gameName, tagLine);
if (demoData) return demoData; // Instant
// Otherwise fetch live
Things to Avoid

❌ Don't use localStorage or sessionStorage (Next.js SSR issues)
❌ Don't commit .env.local or API keys
❌ Don't make synchronous API calls
❌ Don't skip error boundaries
❌ Don't use inline styles (use Tailwind classes)

When Adding New Features

New AI Insight:

Add extraction logic to extractMatchStats() in awsAi.js
Update prompt in generatePlayerInsights()
Add UI display in page.js


New API Route:

Create src/app/api/[name]/route.js
Export GET or POST async function
Return NextResponse.json()


New Component:

Create in src/app/components/
Use Tailwind for styling
Keep it presentational (pass data as props)




📝 License
This project is licensed under the MIT License - see the LICENSE file for details.
TL;DR: You can use, modify, and distribute this code freely. Just include the original license and don't hold me liable.

🏆 Hackathon Submission Details
Event: Rift Rewind Hackathon
Organizers: AWS & Riot Games
Submission Deadline: November 10, 2025 @ 2:00pm PST
Judging Period: December 1-10, 2025
Winners Announced: January 9, 2026
Prize Pool: $26,000 in cash + AWS credits
Judging Criteria:

Insight Quality (20%) - Are insights clear, helpful, and relevant?
Technical Execution (20%) - Does it run smoothly and reliably?
Creativity & UX (20%) - Is it polished, intuitive, and fun?
AWS Integration (20%) - Smart use of AWS AI services?
Unique/Vibes (20%) - Does it feel fresh and memorable?

Our Competitive Advantages

Dual-Mode System - Instant demos + real-time analysis
Personality-Driven - AI-generated narratives, not just stats
Cost-Effective - Using Haiku model for 10x cost savings
Great UX - Loading states, error handling, demo buttons
Scalable - Stateless architecture, serverless functions


👤 Author
Jose Angel Rodriguez

GitHub: @josr27
Devpost: gatoraids2
Email: Joserodriguez2761@yahoo.com

Built solo for the Rift Rewind Hackathon (Oct 11 - Nov 10, 2025).

🙏 Acknowledgments

Riot Games for the League of Legends API and hosting an amazing game
AWS for Bedrock credits and excellent AI infrastructure
Anthropic for Claude - the AI that powers our insights
Next.js & Vercel for making full-stack development a breeze
The League Community for being the inspiration behind this project


📞 Support & Questions
For hackathon participants:

Join the Discord: [Rift Rewind Discord]
Check Resources: https://riftrewind.devpost.com/


For general questions:

Email: Joserodriguez2761@yahoo.com


🚀 Deployment
Coming soon! Will be deployed to Vercel with production environment variables.
Deployment checklist:

 Add production AWS credentials
 Set up Vercel environment variables
 Test all API routes in production
 Pre-fetch demo accounts for production
 Set up custom domain (optional)


---

**Last Updated:** October 16, 2025  
**Version:** 0.3.0 (Visual Polish)  
**Status:** 🚀 Production Ready

Built with ❤️ and ☕ for the League community

### Recent Updates (Oct 16)
- 🏆 **Ranked Emblem Display** - Shows competitive rank (tier, LP, W/L) on player card
- 🎮 **Match Card Overhaul** - Now displays items + summoner spells (like op.gg!)
- 🖼️ **Data Dragon Integration** - Official Riot CDN for items/spells (v15.20.1)
- ⚡ **50% API Reduction** - Poro assistant optimized with combined responses
- 📱 **Mobile Match Cards** - Hamburger-style team layout, optimized spacing
- 🐾 **Enhanced Poro Context** - Now includes full stats in dialogue prompts
- 🔄 **Graceful Fallbacks** - Transparent placeholders for missing/Arena items
- 🎯 **Better Error Handling** - Load More button hides when no matches left
- 🔧 **PUUID-based Ranked API** - Workaround for missing summoner.id field

### Previous Updates (Oct 15)
- ✨ Added interactive D3.js mastery bubble chart
- 📱 Full mobile responsive design
- 🐾 Clickable Poro assistant
- 🎯 Champion mastery integration in AI insights
- 🖼️ Server-side image proxy to fix ORB blocking
- 📊 Enhanced to analyze 200 matches for demo accounts



```