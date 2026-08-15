# Bridge AI Backend

Express API for Bridge AI: multi-provider AI chat, per-user MCP/OAuth integrations, semantic memory, voice transcription, credit-based plans, and an admin console — backed by PostgreSQL (Prisma + pgvector).

## Architecture

```
backend/
├── server.js               # Express app, route mounting, WebSocket setup, cron jobs
├── routes/                 # REST + WebSocket endpoints (see below)
├── mcp/
│   ├── manager.js          # Per-user MCP connection manager (lazy connect, health checks, retry)
│   ├── tools.js             # MCP → OpenAI-style tool format conversion, system prompt generation
│   └── integrations/        # One file per MCP-backed integration
├── oauth/
│   ├── handler.js           # Generic OAuth 2.0 state/exchange handler
│   └── integrations/        # One file per OAuth provider (client id/secret from env)
├── ai-providers/           # Gemini, OpenRouter, Bedrock adapters + embeddings
├── db/
│   ├── index.js             # Prisma client singleton
│   └── services/            # conversation, integration, memory, toolContext, user, tokenUsage, admin, deviceToken, notification
├── config/                  # app config, credit system, plan limits, expert/character personas
├── middleware/              # auth (token-based user resolution), admin gate, quota enforcement
├── jobs/                    # scheduled notification processing (node-cron)
├── services/                # push notification + notification sender
└── prisma/                  # schema.prisma + SQL migrations
```

Credentials are never hardcoded. Every OAuth/API integration reads its client id/secret from environment variables (see the root [README](../README.md#3-environment-variables) for the full list) and stores per-user tokens encrypted in Postgres (`UserIntegration.credentials`, encrypted with `ENCRYPTION_KEY`).

## Setup

```bash
npm install

# Create backend/.env (see root README for the full variable list)

npx prisma generate
npx prisma migrate dev

npm run dev   # nodemon, auto-reload
# or
npm start     # plain node
```

Useful scripts:

```bash
npm run db:studio          # Prisma Studio (browse the DB)
npm run db:reset           # WARNING: wipes and re-runs migrations
npm run test:models        # exercises every configured AI model end-to-end (see backend/scripts/README.md)
```

## API Routes

All routes are mounted under `/api/*` in `server.js`. Endpoints that touch user data require an `Authorization: Bearer <google-access-token>` header — `middleware/auth.js` resolves the real user from that token server-side; the userId is never trusted from request params.

| Route file | Mounted at | Handles |
|---|---|---|
| `routes/auth.js` | `/api/auth` | Google OAuth login, session polling, current user, account deletion |
| `routes/chat.js` | `/api/chat` | Chat (REST + streaming WebSocket), tool-calling loop, memory injection |
| `routes/models.js` | `/api/models` | List available AI models across all configured providers |
| `routes/integrations.js` | `/api/integrations`, `/api/user-integrations` | Add/list/remove a user's integrations |
| `routes/oauth.js` | `/api/oauth`, `/api/integrations` | Generic OAuth URL + callback for every integration provider |
| `routes/conversations.js` | `/api/conversations` | Conversation and message CRUD |
| `routes/memory.js` | `/api/memory` | Vector storage, semantic + hybrid search over past messages |
| `routes/usage.js` | `/api/usage` | Per-user token/credit usage and plan limits |
| `routes/transcribe.js` | `/api/transcribe` | Voice upload + real-time streaming transcription (AWS Transcribe) |
| `routes/notifications.js` | `/api/notifications` | Device token registration for push notifications |
| `routes/waitlist.js` | `/api/waitlist` | Waitlist signups for invite-gated access |
| `routes/sampleQuestions.js` | `/api/sample-questions` | Suggested prompts based on connected integrations |
| `routes/admin.js` | `/api/admin` | Dashboard stats, user/plan management, waitlist approvals, integration toggles, notification composer — requires DB-backed admin membership |

## MCP & OAuth Integrations

See `mcp/README.md` and `oauth/README.md` for the connection architecture (lazy connect, health checks, retry/backoff) and the steps to add a new integration. Currently wired: GitHub, Gmail, Google Drive, Google Calendar, Jira, Slack, Spotify, X, YouTube, Zerodha, Zomato.

## Database

See `db/README.md` for the service layer and `prisma/README.md` for schema/migration details. Key models: `User`, `Conversation`, `Message`, `ToolContext`, `MemoryVector` (pgvector), `UserIntegration` (encrypted credentials), `TokenUsage`, `Admin`, `Notification`, `DeviceToken`, `Waitlist`.

## Security Notes

1. All user identity is resolved server-side from the Google access token — request bodies/params never set `userId` directly.
2. Integration credentials are encrypted at rest with `ENCRYPTION_KEY`.
3. Admin access is DB-driven (`Admin` table via `db/services/admin.js`), not an email allowlist.
4. Access is invite-gated: login succeeds only for emails present and approved on the `Waitlist` table.
