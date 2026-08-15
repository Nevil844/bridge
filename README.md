# 🌉 Bridge AI

A mobile AI assistant (React Native/Expo + Express) that chats across multiple model providers and can act on your behalf inside the apps you already use — GitHub, Gmail, Google Drive/Calendar, Jira, Slack, Spotify, X, YouTube, Zerodha, and Zomato — via OAuth and the Model Context Protocol (MCP).

## ✨ Features

- **Multi-provider AI chat** — Gemini (free tier), OpenRouter (GPT-family and others), and AWS Bedrock (Claude), streamed live over WebSocket. The model list is fetched from `/api/models`, not hardcoded.
- **11 live integrations** — GitHub, Gmail, Google Drive, Google Calendar, Jira, Slack, Spotify, X, YouTube, Zerodha, Zomato. Each connects via its own OAuth flow; credentials are encrypted at rest and never touch the mobile app.
- **Semantic memory** — Postgres + pgvector-backed recall across conversations, used to give the AI relevant context automatically.
- **Voice input** — real-time speech-to-text via AWS Transcribe streaming, plus on-device speech recognition.
- **Credits & plans** — Free / Pro / Power / Enterprise tiers, usage metered from real per-model token pricing.
- **Admin console** — dashboard, user/plan management, waitlist approvals, integration toggles, and push notification composer.
- **Experts & characters** — 26 selectable personas (professional experts and character personas) with server-side-only system prompts.
- **Invite-gated launch** — login is blocked at the OAuth callback until an email is approved on the waitlist.
- **Dark mode, animated UI** — glowing orb chat interface, smooth theming.

## 🏗️ Architecture

```
Mobile App (Expo / React Native)
    │  REST + WebSocket
    ▼
Backend API (Express, backend/server.js)
    ├── routes/          — REST + WebSocket endpoints (chat, auth, admin, memory, usage...)
    ├── mcp/manager.js    — per-user MCP connections (lazy, health-checked, auto-reconnect)
    ├── oauth/handler.js  — generic OAuth 2.0 flow, per-provider modules in oauth/integrations/
    ├── ai-providers/     — Gemini, OpenRouter, Bedrock adapters + embeddings
    ├── db/                — Prisma client + service layer (Postgres + pgvector)
    └── jobs/              — scheduled notification processing
    │
    ▼
External APIs (GitHub, Google, Slack, Spotify, Zerodha, Zomato, Jira, X, YouTube, AWS)
```

Each user's integration credentials and MCP connections are isolated per-user; nothing is shared across accounts.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ with the `pgvector` extension
- A Google Cloud OAuth Client ID/Secret (required — login is Google OAuth only)
- API keys/OAuth apps for whichever AI providers and integrations you want active (all are optional except Google login)

### 1. Backend

```bash
cd backend
npm install

# Create backend/.env — see "Environment Variables" below
npx prisma generate
npx prisma migrate dev

npm run dev   # or: npm start
```

Backend runs on `http://localhost:3000`.

### 2. Frontend

```bash
# From the project root
npm install
npm start

# Press 'i' for iOS simulator, 'a' for Android, or scan the QR code in Expo Go
```

Update `config/api.ts` with your backend's URL before running on a physical device.

### 3. Environment Variables

`backend/.env` — nothing is hardcoded; every credential below is read from `process.env`:

```bash
# Core
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/bridge_ai?schema=public
ENCRYPTION_KEY=            # 32-char key used to encrypt stored integration credentials
NODE_ENV=development

# Login (required)
GOOGLE_AUTH_CLIENT_ID=
GOOGLE_AUTH_CLIENT_SECRET=

# AI providers (enable any/all)
GOOGLE_GEMINI_API_KEY=
OPENROUTER_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=

# Voice transcription (optional, uses the same AWS credentials)
AWS_TRANSCRIBE_S3_BUCKET=

# Integrations (enable whichever you want available — each is independent)
GITHUB_CLIENT_ID= / GITHUB_CLIENT_SECRET=
GMAIL_CLIENT_ID= / GMAIL_CLIENT_SECRET=
GOOGLE_DRIVE_CLIENT_ID= / GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_CALENDAR_CLIENT_ID= / GOOGLE_CALENDAR_CLIENT_SECRET=
ATLASSIAN_CLIENT_ID= / ATLASSIAN_CLIENT_SECRET=   # Jira
SLACK_CLIENT_ID= / SLACK_CLIENT_SECRET=
SPOTIFY_CLIENT_ID= / SPOTIFY_CLIENT_SECRET=
X_CLIENT_ID= / X_CLIENT_SECRET=
YOUTUBE_CLIENT_ID= / YOUTUBE_CLIENT_SECRET=
ZERODHA_API_KEY= / ZERODHA_API_SECRET=
```

Each integration also accepts a `..._REDIRECT_URI` override; see the relevant file in `backend/oauth/integrations/` for defaults.

## 🛠️ Tech Stack

**Frontend:** React Native, Expo Router, TypeScript, Reanimated, AsyncStorage, expo-speech-recognition

**Backend:** Express + express-ws, Prisma + PostgreSQL (pgvector), MCP SDK, AWS SDK (Bedrock, Transcribe, S3), Google APIs SDK, node-cron

## 🔒 Security Notes

- OAuth throughout — no manually pasted tokens for third-party integrations
- Per-user credential isolation and encryption at rest
- All userId resolution happens server-side from the authenticated token, never from request parameters
- State-parameter CSRF protection on every OAuth flow

## 📄 License

[MIT](./LICENSE)
