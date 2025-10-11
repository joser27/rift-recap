# Rift Rewind 🎮

**Your Season, Your Story** - AI-powered League of Legends year-end recap for the AWS x Riot Games Hackathon.

## 📋 About

Rift Rewind uses AWS AI services and the League of Legends API to generate personalized, shareable insights about your gameplay throughout the year. Built for the [Rift Rewind Hackathon](https://riftrewind.devpost.com/).

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS
- **Backend:** Next.js API Routes (Serverless Functions)
- **APIs:** Riot Games League of Legends API
- **AI:** AWS Bedrock (Claude 3.5 Sonnet) - Coming Day 2
- **Deployment:** Vercel
- **Rate Limiting:** p-limit for efficient API calls

---

## 📁 Project Structurerift-recap/
├── .next/                          # Next.js build cache (auto-generated)
├── node_modules/                   # Dependencies (auto-generated)
├── public/                         # Static assets
│   ├── demo-data/                  # Pre-fetched demo account data (for Day 2)
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── src/                            # Source code (Next.js with /src structure)
│   ├── app/                        # Next.js App Router
│   │   ├── api/                    # Serverless API routes
│   │   │   ├── ai/
│   │   │   │   └── route.js        # AI insights endpoint (Day 2)
│   │   │   ├── match/
│   │   │   │   └── route.js        # Match data endpoint (Day 2)
│   │   │   └── summoner/
│   │   │       └── route.js        # Summoner search endpoint ✅
│   │   ├── components/             # React components
│   │   ├── favicon.ico
│   │   ├── globals.css             # Global styles
│   │   ├── layout.js               # Root layout
│   │   ├── page.js                 # Home page ✅
│   │   └── test-api.mjs            # API test script
│   └── lib/                        # Helper functions & utilities
│       └── riotApi.js              # Riot API wrapper ✅
├── .env.local                      # Environment variables (API keys) 🔒
├── .gitignore                      # Git ignore rules
├── eslint.config.mjs               # ESLint configuration
├── jsconfig.json                   # JavaScript path aliases
├── next.config.mjs                 # Next.js configuration
├── package-lock.json               # Locked dependency versions
├── package.json                    # Project dependencies & scripts
├── postcss.config.mjs              # PostCSS configuration
└── README.md                       # Project documentation


---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Riot Games Developer API Key
- AWS Account (for Bedrock AI)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/YOUR_USERNAME/rift-rewind.git
cd rift-rewind

Install dependencies:

bashnpm install

Create .env.local in the root directory:

bashRIOT_API_KEY=

# Day 2: AWS credentials
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

Get your Riot API Key:

Visit https://developer.riotgames.com/
Sign in and generate a Development API Key
Note: Keys expire every 24 hours and must be regenerated daily


Run the development server:

bashnpm run dev

Open your browser:

Navigate to http://localhost:3000
Search for a summoner (e.g., "Bosey#NA1")




🎯 Features
✅ Day 1 Complete

 Riot API integration
 Summoner search functionality
 Match history display (20 recent matches)
 Parallel API fetching (5-7 second load times)
 Responsive UI with Tailwind CSS

🚧 In Progress (Days 2-3)

 AWS Bedrock integration
 AI-generated insights ("Champion Personality", "Tilt Analysis", etc.)
 Pre-fetched demo accounts for instant demos
 Progressive insight loading

📅 Upcoming (Weeks 2-3)

 Shareable social cards (Spotify Wrapped style)
 Data visualizations (charts, graphs)
 Additional AI insights
 Mobile responsive design polish


🧪 Testing
Test the API directly:
bash# From src/app/ directory
node test-api.mjs
Test via browser:

Start dev server: npm run dev
Visit: http://localhost:3000
Enter summoner name and tag
View match history


🔑 Environment Variables
VariableDescriptionWhen AddedRIOT_API_KEYRiot Games Developer API keyDay 1 ✅AWS_ACCESS_KEY_IDAWS credentials for BedrockDay 2AWS_SECRET_ACCESS_KEYAWS credentials for BedrockDay 2AWS_REGIONAWS region (us-east-1)Day 2
Important:

.env.local is in .gitignore and will NOT be committed
Riot API keys expire every 24 hours
Regenerate your key daily at https://developer.riotgames.com/


📊 API Endpoints
GET /api/summoner
Fetch summoner profile and match history.
Query Parameters:

gameName (required): Summoner name
tagLine (optional): Riot tag (default: "NA1")

Example:
bashcurl "http://localhost:3000/api/summoner?gameName=Bosey&tagLine=NA1"
Response:
json{
  "success": true,
  "data": {
    "account": { "puuid": "...", "gameName": "Bosey", "tagLine": "NA1" },
    "summoner": { "summonerLevel": 250 },
    "matches": [ /* 20 match objects */ ]
  }
}

🏗️ Development Timeline

Day 1 (Oct 11): ✅ Riot API integration, basic UI
Day 2 (Oct 12): AWS Bedrock, first AI insight
Days 3-7: Additional insights, demo accounts
Week 2: Visualizations, shareable cards
Week 3: Polish, video, documentation
Submission: Nov 10, 2025


🐛 Known Issues & Troubleshooting
"Module not found: @/lib/riotApi"

Ensure lib/ folder is inside src/
Check jsconfig.json has "@/*": ["./src/*"]
Restart dev server after moving files

"Unknown API key"

Wait 2-5 minutes after generating a new key
Regenerate key if it still fails after 5 minutes
Keys expire every 24 hours

Rate limiting (429 errors)

Built-in retry logic handles this automatically
Using p-limit to respect 20 req/sec limit


📝 License
This project is licensed under the MIT License - see the LICENSE file for details.

🏆 Hackathon Details
Event: Rift Rewind Hackathon
Organizers: AWS & Riot Games
Deadline: November 10, 2025 @ 2:00pm PST
Prizes: $26,000+ in cash and AWS credits
Judging Criteria:

Insight Quality (20%)
Technical Execution (20%)
Creativity & UX (20%)
AWS Integration (20%)
Unique/Vibes (20%)


👤 Author
Built by Jose Angel Rodriguez for the Rift Rewind Hackathon.

GitHub: @josr27
Devpost: Nothing boo (gatoraids2)


🙏 Acknowledgments

Riot Games for the League of Legends API
AWS for Bedrock AI services
Next.js & Vercel for the framework
The League community for inspiration


