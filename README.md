<p align="center">
  <img src="assets/images/feature-graphic.png" alt="Bridge AI" width="600" />
</p>

<h1 align="center">Bridge AI</h1>

<p align="center">
  A mobile assistant that chats across GPT, Claude, and Gemini — and can actually act on GitHub, Gmail, Slack, Spotify, Jira, and seven other apps you already use, connected through OAuth and the Model Context Protocol.
</p>

<p align="center">
  <a href="https://apps.apple.com/sg/app/bridge-ai-assistant/id6757355127"><img src="https://img.shields.io/badge/App_Store-Download-000000?logo=apple&logoColor=white" alt="Download on the App Store"></a>
  <a href="https://play.google.com/store/apps/details?id=com.nevil84.bridgeai"><img src="https://img.shields.io/badge/Google_Play-Download-000000?logo=googleplay&logoColor=white" alt="Get it on Google Play"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-2563EB.svg" alt="MIT License"></a>
</p>

---

Ask it to summarize a GitHub PR, draft and send an email, add a calendar event, order food, check your portfolio, or queue a playlist — in one conversation, without leaving the app. Each user connects their own accounts; nothing is shared across accounts, and credentials never touch the client.

## What's inside

**Multi-provider chat.** Gemini, OpenRouter, and AWS Bedrock (Claude) all live behind one streaming interface. The model list comes from `/api/models` at runtime, so it's never stale.

**Eleven real integrations.** GitHub, Gmail, Google Drive, Google Calendar, Jira, Slack, Spotify, X, YouTube, Zerodha, and Zomato — each behind its own OAuth flow, connected lazily on first use with health checks and automatic retry.

**Memory that's actually semantic.** Every conversation is embedded into Postgres via `pgvector`, so the assistant can recall relevant context from weeks-old chats instead of just the last few messages.

**Voice in, not just text.** Real-time speech-to-text over a WebSocket to AWS Transcribe, plus on-device recognition for quick dictation.

**A real product shell around it.** Credit-metered Free / Pro / Power / Enterprise plans priced off actual per-model token costs, an admin console for users and approvals, push notifications, and an invite-gated waitlist for launch.

**26 personas.** A dozen professional "expert" system prompts (tax, legal, medical, career...) and fourteen character personas — all resolved server-side, never shipped to the client.

## How it fits together

```
Mobile App (Expo / React Native)
    │  REST + WebSocket
    ▼
Backend API (Express)
    ├── routes/          REST + WebSocket endpoints
    ├── mcp/manager.js   per-user MCP connections — lazy, health-checked, auto-reconnect
    ├── oauth/handler.js generic OAuth 2.0 flow, one module per provider
    ├── ai-providers/    Gemini, OpenRouter, Bedrock adapters + embeddings
    ├── db/              Prisma client + service layer (Postgres + pgvector)
    └── jobs/            scheduled notification processing
    │
    ▼
GitHub · Google · Slack · Spotify · Zerodha · Zomato · Jira · X · YouTube · AWS
```

| | |
|---|---|
| **Frontend** | React Native, Expo Router, TypeScript, Reanimated, `expo-speech-recognition` |
| **Backend** | Express + `express-ws`, Prisma, PostgreSQL (`pgvector`), MCP SDK |
| **AI** | Gemini, OpenRouter, AWS Bedrock (Claude) |
| **Infra** | AWS (Transcribe, S3, Bedrock), Expo Push Notifications, `node-cron` |

## Running it yourself

**Prerequisites:** Node.js 18+, PostgreSQL 14+ with `pgvector`, and a Google OAuth client (login is Google-only). Everything else — AI providers, individual integrations — is optional; each one just won't appear if its credentials aren't set.

```bash
# Backend
cd backend
npm install
# create backend/.env — see the variable list below
npx prisma generate
npx prisma migrate dev
npm run dev

# Frontend, from the project root
npm install
npm start   # then press 'i' for iOS, 'a' for Android, or scan the QR in Expo Go
```

Point `config/api.ts` at your backend before running on a physical device.

<details>
<summary><strong>Environment variables</strong></summary>

```bash
# Core
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/bridge_ai?schema=public
ENCRYPTION_KEY=            # 32-char key used to encrypt stored integration credentials
NODE_ENV=development

# Login (required)
GOOGLE_AUTH_CLIENT_ID=
GOOGLE_AUTH_CLIENT_SECRET=

# AI providers — enable any/all
GOOGLE_GEMINI_API_KEY=
OPENROUTER_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=

# Voice transcription (optional, reuses the AWS credentials above)
AWS_TRANSCRIBE_S3_BUCKET=

# Integrations — each is independent, enable whichever you want available
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

Each integration also accepts a `..._REDIRECT_URI` override — see `backend/oauth/integrations/` for defaults.
</details>

## Security

- OAuth throughout — no manually pasted tokens for third-party integrations
- Per-user credential isolation, encrypted at rest
- The authenticated user's identity is always resolved server-side from their token; request bodies and params are never trusted for it
- State-parameter CSRF protection on every OAuth flow

More detail in [`backend/README.md`](./backend/README.md).

## License

[MIT](./LICENSE)
