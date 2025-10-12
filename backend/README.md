# AI MCP Backend - Dynamic Per-User Integrations

Express backend with **dynamic per-user MCP (Model Context Protocol) integrations**. Users connect their own integrations from the mobile app!

## Architecture

This backend supports **dynamic integrations**:

- Users add integrations from the mobile app
- Each user has their own MCP connections
- Integrations are established on-demand
- No hardcoded credentials

```
User A → Backend → MCP Manager → GitHub MCP (User A's token)
User B → Backend → MCP Manager → GitHub MCP (User B's token)
                               → Slack MCP (User B's token)
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env`:

```bash
OPENROUTER_API_KEY=sk-or-v1-your-key-here
PORT=3000
```

**Note:** No GitHub token needed! Users provide their own tokens from the mobile app.

Get OpenRouter key: https://openrouter.ai/keys

### 3. Start Server

```bash
npm start
```

## API Endpoints

### Integrations Management

#### `GET /api/integrations?userId=USER_ID`
Get user's connected integrations.

**Response:**
```json
{
  "integrations": [
    {
      "id": "user-github-123",
      "type": "github",
      "name": "GitHub",
      "configured": true
    }
  ]
}
```

#### `POST /api/integrations`
Add a new integration for a user.

**Request:**
```json
{
  "userId": "user123",
  "type": "github",
  "config": {
    "token": "ghp_xxxxxxxxxxxx"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Integration added successfully"
}
```

#### `DELETE /api/integrations/:type?userId=USER_ID`
Remove an integration.

**Example:** `DELETE /api/integrations/github?userId=user123`

### MCP Status

#### `GET /api/mcp/status?userId=USER_ID`
Check if user has MCP integrations connected.

**Response:**
```json
{
  "connected": true,
  "tools": [
    {"name": "search_repositories", "description": "..."},
    {"name": "get_file_contents", "description": "..."}
  ]
}
```

### Chat

#### `POST /api/chat`
Send message to AI with user's MCP context.

**Request:**
```json
{
  "message": "Show me popular React repos",
  "model": "openai/gpt-3.5-turbo",
  "userId": "user123"
}
```

**Response:**
```json
{
  "message": "Here are popular React repositories...",
  "mcpEnabled": true
}
```

### Models

#### `GET /api/models`
Get available AI models.

## File Structure

```
backend/
├── server.js               # Main Express server
├── user-mcp-manager.js     # Per-user MCP connection manager
├── package.json            # Dependencies
└── .env                    # Your API keys
```

## How It Works

### User MCP Manager

The `user-mcp-manager.js` handles per-user MCP connections:

```javascript
// User adds GitHub integration
await mcpManager.addIntegration('user123', 'github', { token: 'ghp_xxx' });

// Creates MCP connection for that user
// Spawns GitHub MCP server with user's token
// Stores connection in memory

// When user chats, AI gets context from their integrations
const tools = await mcpManager.getUserMCPTools('user123');
```

**Key Features:**
- Separate MCP process per user per integration
- Connections are lazy-loaded
- Automatic cleanup on disconnect
- In-memory storage (can be persisted)

### Integration Flow

1. User opens mobile app → Integrations tab
2. Taps "Connect" on GitHub
3. Enters their GitHub token
4. Mobile app → `POST /api/integrations`
5. Backend creates MCP connection for that user
6. Green badge appears in chat
7. AI now has access to user's GitHub

### Chat with MCP

When user sends a message:

1. Backend checks user's integrations
2. Gets MCP tools from user's connections
3. Builds system prompt with available tools
4. Sends to OpenRouter with context
5. AI uses MCP tools to access data
6. Returns response with real information

## Adding New MCP Servers

### 1. Add Connection Method

In `user-mcp-manager.js`:

```javascript
async connectSlackMCP(userId, token) {
  const clientKey = `${userId}-slack`;
  
  const serverProcess = spawn('npx', [
    '-y',
    '@modelcontextprotocol/server-slack'
  ], {
    env: {
      ...process.env,
      SLACK_API_TOKEN: token,
    },
  });

  const transport = new StdioClientTransport({
    reader: serverProcess.stdout,
    writer: serverProcess.stdin,
  });

  const client = new Client({
    name: 'ai-mcp-app',
    version: '1.0.0',
  }, {
    capabilities: { tools: {} },
  });

  await client.connect(transport);
  
  userClients.set(clientKey, { client, process: serverProcess, type: 'slack' });
}
```

### 2. Update addIntegration

```javascript
async addIntegration(userId, type, config) {
  // ... existing code
  
  if (type === 'github') {
    await this.connectGitHubMCP(userId, config.token);
  } else if (type === 'slack') {
    await this.connectSlackMCP(userId, config.token);
  }
  
  return true;
}
```

That's it! The system will automatically:
- Manage the connection
- Include tools in AI context
- Handle disconnection
- Provide status to mobile app

## Deployment Notes

### In-Memory Storage

Currently, integrations are stored in-memory:

```javascript
const userIntegrations = new Map();
```

**For production:**
- Use a database (PostgreSQL, MongoDB, etc.)
- Encrypt user tokens
- Add authentication/sessions
- Implement token refresh

### Security Considerations

1. **Encrypt tokens** - Don't store plaintext credentials
2. **Rate limiting** - Prevent API abuse
3. **User authentication** - Implement proper auth
4. **HTTPS** - Use TLS in production
5. **Token scopes** - Request minimum necessary permissions

### Scaling

For multiple backend instances:
- Use Redis for shared state
- Consider sticky sessions for MCP connections
- Or centralize MCP connections in separate service

## Monitoring

Backend logs show:
- MCP connection status
- User integration additions/removals
- API requests
- Errors with details

Example:
```
✅ GitHub MCP connected for user: user123
Disconnected github MCP for user: user456
```

## Troubleshooting

### MCP connection fails

- Check user's token is valid
- Verify MCP server package can be installed
- Check internet connection
- Look at stderr from spawned process

### Memory issues

- MCP processes are per-user per-integration
- Consider cleanup for inactive users
- Monitor process count

### Token errors

- Ensure user provides correct scopes
- Check token hasn't expired
- Verify token has necessary permissions

## Development

```bash
# Auto-reload on changes
npm run dev

# Start normally
npm start
```

## Future Enhancements

- [ ] Persistent storage (database)
- [ ] Token encryption
- [ ] User authentication (OAuth, JWT)
- [ ] More MCP servers (Slack, Google Drive, Notion)
- [ ] Token refresh flows
- [ ] Admin panel for monitoring
- [ ] Rate limiting
- [ ] Caching layer

---

This backend is designed to be simple, extensible, and production-ready with minimal changes!
