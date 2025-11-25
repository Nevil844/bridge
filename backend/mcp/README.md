# MCP (Model Context Protocol) Organization

This directory contains all MCP-related code in a clean, modular structure.

## 📁 Structure

```
mcp/
├── manager.js              # Main MCP manager (handles all integrations)
├── tools.js                # Tool conversion utilities (MCP → OpenAI format)
└── integrations/           # Integration-specific implementations
    ├── index.js            # Integration registry
    ├── github.js           # GitHub MCP integration
    ├── gmail.js            # Gmail integration (direct API)
    ├── google-drive.js     # Google Drive integration
    ├── zerodha.js          # Zerodha/Kite integration
    ├── spotify.js          # Spotify integration
    ├── zomato.js           # Zomato integration
    ├── jira.js             # Jira integration
    └── [future-integrations].js
```

## 🔌 Connection Architecture

### Connection Strategy

The MCP manager uses a **lazy connection** strategy with automatic health checks and retry logic:

1. **Lazy Connections**: Connections are established on first use, not when integration is added
   - Reduces startup time and resource usage
   - Handles OAuth flows gracefully
   - Prevents connection failures from blocking integration addition

2. **Health Checks**: Connections are verified before use and automatically reconnected if dead
   - Health check interval: 5 minutes
   - Performed by calling `getTools()` to verify connection is alive
   - Dead connections are automatically reconnected

3. **Retry Logic**: Failed connections are retried with exponential backoff
   - Max retry attempts: 3
   - Initial delay: 1 second
   - Max delay: 10 seconds
   - Exponential backoff: 1s → 2s → 4s

4. **OAuth Handling**: OAuth token expiration is detected and handled gracefully
   - OAuth errors are caught and returned as `OAuth_AUTHENTICATION_REQUIRED`
   - Frontend can prompt user to re-authenticate
   - Tokens are refreshed automatically when possible

### Connection Lifecycle

```
1. User adds integration → Config stored in database
2. Integration metadata stored in memory (no connection yet)
3. First tool request → Connection established (lazy)
4. Health check every 5 minutes → Reconnect if dead
5. Tool call fails → Mark connection unhealthy, reconnect on next use
6. User removes integration → Connection closed, metadata removed
```

### Connection Types

#### 1. Local MCP Servers (e.g., GitHub)
- **Connection Method**: Spawns local process via `npx`
- **Example**: `npx -y @modelcontextprotocol/server-github`
- **Configuration**: Requires API token/credentials
- **Health Check**: Calls `listTools()` to verify process is alive
- **Failure Handling**: Process may die → detected on health check → reconnected

#### 2. Remote MCP Servers (e.g., Jira, Zerodha, Zomato)
- **Connection Method**: Uses `mcp-remote` to connect to remote server
- **Example**: `npx -y mcp-remote https://mcp.atlassian.com/v1/sse`
- **Configuration**: Requires OAuth tokens or API credentials
- **Health Check**: Calls `listTools()` to verify connection is alive
- **Failure Handling**: OAuth token expiration → detected → user prompted to re-authenticate

#### 3. Direct API Integrations (e.g., Gmail)
- **Connection Method**: Direct API calls using SDK (no MCP server)
- **Example**: Google APIs SDK
- **Configuration**: Requires OAuth tokens
- **Health Check**: Calls API to verify token is valid
- **Failure Handling**: Token expiration → refresh token → reconnect

### Configuration

#### Environment Variables

Each integration may require specific environment variables. Common ones:

```bash
# GitHub
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...

# Google Services (Gmail, Drive)
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GOOGLE_DRIVE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_SECRET=...

# Zerodha
ZERODHA_API_KEY=...

# Jira (Atlassian)
ATLASSIAN_MCP_SERVER_URL=https://mcp.atlassian.com/v1/sse  # Optional, defaults to Atlassian's server

# Encryption (for storing credentials)
ENCRYPTION_KEY=your-32-character-encryption-key-here
```

#### Integration Configuration

Each integration stores its configuration in the database (encrypted):

```javascript
// Example: GitHub integration config
{
  token: 'ghp_...',  // Encrypted in database
  userId: 'user-123'  // Added automatically
}

// Example: Jira integration config (OAuth)
{
  accessToken: '...',      // OAuth access token
  refreshToken: '...',     // OAuth refresh token
  serverUrl: '...',        // Optional: custom MCP server URL
  userId: 'user-123'
}

// Example: Zerodha integration config
{
  token: '...',            // Kite API access token
  userId: 'user-123'
}
```

### Connection State Management

Connections are stored in memory with the following structure:

```javascript
{
  integration: IntegrationInstance,  // Integration class instance
  connection: ConnectionObject,            // MCP client/transport (null if not connected)
  type: 'github',                         // Integration type
  userId: 'user-123',                     // User ID
  config: { ... },                        // Stored configuration
  lastHealthCheck: 1234567890,           // Timestamp of last health check
  connectionAttempts: 0,                  // Number of connection attempts
  isConnecting: false                     // Flag to prevent concurrent connections
}
```

**Important**: Connections are **in-memory only** and are lost on server restart. They are re-established on first use after restart.

### Error Handling

#### OAuth Token Expiration

When OAuth tokens expire:

1. Connection health check fails
2. Error message contains `OAuth_AUTHENTICATION_REQUIRED`
3. Frontend receives error with OAuth URL
4. User completes OAuth flow
5. New tokens stored in database
6. Connection automatically re-established on next use

#### Local MCP Server Failures

When local MCP server process dies:

1. Health check detects dead connection
2. Connection marked as `null`
3. Reconnection attempted on next use
4. If reconnection fails, error logged and user notified

#### Network/Timeout Errors

- Connection timeout: 30 seconds
- Tool call timeout: 30 seconds
- Retry with exponential backoff (up to 3 attempts)
- Errors logged for debugging

### Caching

#### Tools Cache

- **TTL**: 30 minutes
- **Key**: `tools-{userId}`
- **Invalidation**: On integration add/remove
- **Purpose**: Reduce repeated `listTools()` calls

#### Integration Load Cache

- **Purpose**: Track which integrations are loaded for each user
- **Key**: `userId` → `Set<provider>`
- **Invalidation**: On integration add/remove
- **Purpose**: Avoid reloading integrations on every request

## 🔌 Adding a New Integration

### 1. Create Integration File

Create `integrations/your-integration.js`:

```javascript
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

class YourIntegration {
  constructor() {
    this.name = 'Your Service';
    this.type = 'your-service';
    this.description = 'Description of what this integration does';
    this.icon = 'https://...';
  }

  async connect(config) {
    // Connect to MCP server
    // Return { client, transport }
  }

  async disconnect(connection) {
    // Clean up connection
  }

  async getTools(connection) {
    // Return available tools
  }

  async callTool(connection, toolName, args) {
    // Execute a tool
  }
}

module.exports = YourIntegration;
```

### 2. Register in `integrations/index.js`

```javascript
const YourIntegration = require('./your-integration.js');

const integrations = {
  // ... existing integrations
  'your-service': {
    class: YourIntegration,
    name: 'Your Service',
    description: 'Description',
    icon: 'https://...',
    authType: 'oauth', // or 'api_key', 'token', etc.
  },
};
```

### 3. Update Frontend (Optional)

Add to `app/(tabs)/integrations.tsx`:

```typescript
{
  id: 'your-service',
  name: 'Your Service',
  description: 'Description',
  icon: 'https://...',
  connected: false,
}
```

### 4. Add OAuth Handler (If using OAuth)

Update `backend/oauth-handler.js` to support your service's OAuth flow.

## 🎯 Design Principles

1. **Generic System**: No hardcoded integration-specific logic in the manager
2. **Modular**: Each integration is self-contained
3. **Extensible**: Easy to add new integrations without changing core code
4. **Type Agnostic**: Works with any MCP server implementation

## 📚 Current Integrations

### GitHub (`github.js`)
- **Type**: Local MCP Server
- **Auth**: Personal Access Token (OAuth 2.0)
- **MCP Server**: `@modelcontextprotocol/server-github`
- **Config**: `{ token: 'ghp_...' }`
- **Connection**: Spawns local process via `npx`

### Gmail (`gmail.js`)
- **Type**: Direct API Integration
- **Auth**: OAuth 2.0 (Google)
- **MCP Server**: None (direct Google APIs)
- **Config**: `{ token: '...', refreshToken: '...' }`
- **Connection**: Google APIs SDK

### Google Drive (`google-drive.js`)
- **Type**: Local MCP Server or Direct API
- **Auth**: OAuth 2.0 (Google)
- **MCP Server**: `@modelcontextprotocol/server-google-drive` (if using MCP)
- **Config**: `{ token: '...', refreshToken: '...' }`
- **Connection**: MCP server or Google APIs SDK

### Zerodha (`zerodha.js`)
- **Type**: Remote MCP Server
- **Auth**: OAuth 2.0 (Kite API)
- **MCP Server**: `https://mcp.kite.trade/mcp` (via `mcp-remote`)
- **Config**: `{ token: '...' }`
- **Connection**: Remote MCP server via `mcp-remote`
- **Special**: Requires interactive login tool call for session

### Spotify (`spotify.js`)
- **Type**: Local MCP Server (Python-based)
- **Auth**: OAuth 2.0
- **MCP Server**: `spotify-mcp` (via `uvx` from GitHub)
- **Source**: https://github.com/varunneal/spotify-mcp
- **Config**: `{ token: '...', refreshToken: '...', userId: '...' }`
- **Connection**: Spawns Python process via `uvx`
- **Special**: Uses cache file per user (spotipy format)

### Zomato (`zomato.js`)
- **Type**: Remote MCP Server
- **Auth**: OAuth 2.0 (handled by mcp-remote)
- **MCP Server**: Remote server (via `mcp-remote`)
- **Config**: `{ ... }` (OAuth handled by mcp-remote)
- **Connection**: Remote MCP server via `mcp-remote`

### Jira (`jira.js`)
- **Type**: Remote MCP Server (recommended) or Local MCP Server
- **Auth**: OAuth 2.0 (Atlassian) or API Token
- **MCP Server**: 
  - Remote: `https://mcp.atlassian.com/v1/sse` (default, recommended)
  - Local: `@modelcontextprotocol/server-jira` (fallback)
- **Config**: 
  - OAuth: `{ accessToken: '...', refreshToken: '...', serverUrl: '...' }`
  - API Token: `{ email: '...', apiToken: '...', instanceUrl: '...' }`
- **Connection**: Remote via `mcp-remote` (OAuth) or local process (API token)
- **Special**: Lazy connection for OAuth - connects on first use

## 🔧 Core Components

### `manager.js`
- **Lazy Connection Management**: Connections established on first use
- **Health Checks**: Automatic connection health verification and reconnection
- **Retry Logic**: Exponential backoff for failed connections
- **OAuth Handling**: Detects and handles OAuth token expiration
- **Tool Routing**: Routes tool calls to the correct integration
- **Caching**: Tools cache to reduce API calls
- **Integration-agnostic design**: No hardcoded integration logic

**Key Methods**:
- `addIntegration(userId, type, config)`: Add integration (lazy, doesn't connect)
- `removeIntegration(userId, type)`: Remove integration and disconnect
- `getUserMCPTools(userId)`: Get all tools (connects if needed)
- `callUserTool(userId, toolName, args)`: Call a tool (connects if needed)
- `ensureConnectionHealthy(userId, type)`: Health check and reconnect if needed
- `connectIntegration(userId, type, config)`: Connect with retry logic

### `tools.js`
- Converts MCP tool definitions to OpenAI function calling format
- Generates generic system prompts based on connected integrations
- Provides integration-specific instructions for AI
- No integration-specific logic

### `integrations/`
- Each file implements a specific integration
- Follows common interface: `connect`, `disconnect`, `getTools`, `callTool`
- Self-contained: all integration-specific logic stays here
- Handles OAuth flows, API authentication, and MCP server communication

## 🚀 Usage

### Basic Usage

```javascript
const mcpManager = require('./mcp/manager');

// Add integration (lazy - doesn't connect yet)
await mcpManager.addIntegration('user-123', 'github', { token: 'ghp_...' });

// Get tools (connects automatically if needed)
const tools = await mcpManager.getUserMCPTools('user-123');

// Call tool (connects automatically if needed)
const result = await mcpManager.callUserTool('user-123', 'search_repositories', { query: 'react' });

// Remove integration (disconnects)
await mcpManager.removeIntegration('user-123', 'github');
```

### Integration Flow

```javascript
// 1. User completes OAuth flow
const oauthHandler = require('./oauth/handler');
const authUrl = oauthHandler.getAuthUrl('github', userId);
// ... user authorizes ...

// 2. Exchange code for token
const token = await oauthHandler.exchangeCodeForToken('github', code);

// 3. Store in database
const integrationService = require('./db/services/integration');
await integrationService.storeIntegration(userId, 'github', { token });

// 4. Load in MCP manager (lazy - no connection yet)
await mcpManager.addIntegration(userId, 'github', { token });

// 5. First use - connection established automatically
const tools = await mcpManager.getUserMCPTools(userId);
```

### Error Handling

```javascript
try {
  const tools = await mcpManager.getUserMCPTools(userId);
} catch (error) {
  if (error.message.includes('OAuth_AUTHENTICATION_REQUIRED')) {
    // OAuth token expired - prompt user to re-authenticate
    const oauthUrl = error.message.split(': ')[1];
    // Redirect user to oauthUrl
  } else {
    // Other error - log and handle
    console.error('Failed to get tools:', error);
  }
}
```

### Health Checks

```javascript
// Health check is automatic, but you can force it:
const isHealthy = await mcpManager.ensureConnectionHealthy(userId, 'github');
if (!isHealthy) {
  // Connection is dead, user may need to re-authenticate
}
```

## 🔍 Troubleshooting

### Connection Issues

**Problem**: Integration shows as connected but tools aren't fetched

**Solutions**:
1. Check connection health: `ensureConnectionHealthy(userId, type)`
2. Check OAuth token expiration (may need re-authentication)
3. Check local MCP server process (may have died)
4. Check network connectivity for remote MCP servers
5. Review logs for connection errors

**Problem**: OAuth connections timeout

**Solutions**:
1. OAuth tokens may have expired → user needs to re-authenticate
2. Remote MCP server may be down → check server status
3. Network issues → check connectivity
4. Increase timeout (currently 30 seconds)

**Problem**: Local MCP server not starting

**Solutions**:
1. Check if `npx` is available
2. Check if MCP server package is available on npm
3. Check network connectivity (for downloading packages)
4. Check process limits (may have too many connections)

### Debugging

Enable verbose logging:

```javascript
// In manager.js, connections are logged:
console.log(`✅ Connected to ${type} MCP server for user ${userId}`);
console.log(`⚠️  Health check failed for ${type}, reconnecting...`);
console.log(`❌ Failed to connect ${type} after ${MAX_RETRY_ATTEMPTS} attempts`);
```

Check connection state:

```javascript
// Connection data structure:
const connectionData = userConnections.get(`${userId}-${type}`);
console.log({
  hasConnection: !!connectionData?.connection,
  lastHealthCheck: connectionData?.lastHealthCheck,
  connectionAttempts: connectionData?.connectionAttempts,
  isConnecting: connectionData?.isConnecting
});
```

## 🎵 Running Spotify MCP Locally

Spotify MCP uses a Python-based server that runs locally via `uvx`. Here's how to set it up:

### Prerequisites

1. **Install `uv` (Python package manager)**
   ```bash
   # macOS/Linux
   curl -LsSf https://astral.sh/uv/install.sh | sh
   
   # Or via Homebrew (macOS)
   brew install uv
   
   # Windows
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```

2. **Verify `uvx` is available**
   ```bash
   uvx --version
   # Should output: uvx 0.x.x
   ```

3. **Python 3.12** (uvx will handle this automatically, but you can verify)
   ```bash
   python3 --version
   # Should be Python 3.12 or higher
   ```

### Environment Variables

Add to your `.env` file:

```bash
# Spotify OAuth credentials (get from https://developer.spotify.com/dashboard)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# OAuth redirect URI (must match Spotify app settings)
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/oauth/callback
```

### Spotify App Setup

1. **Create a Spotify App**
   - Go to https://developer.spotify.com/dashboard
   - Click "Create an App"
   - Fill in app details
   - Note your **Client ID** and **Client Secret**

2. **Configure Redirect URI**
   - In your Spotify app settings, add redirect URI:
     - `http://127.0.0.1:3000/api/oauth/callback`
   - Or your production callback URL

3. **Required Scopes**
   The integration uses these scopes (automatically requested):
   ```
   user-read-playback-state
   user-modify-playback-state
   user-read-currently-playing
   playlist-read-private
   playlist-read-collaborative
   playlist-modify-public
   playlist-modify-private
   user-library-read
   user-library-modify
   user-read-recently-played
   user-top-read
   ```

### How It Works

1. **Connection Process**:
   - When a user connects Spotify, OAuth tokens are stored in the database
   - On first tool use, the system:
     - Creates a spotipy cache file with tokens (in `/tmp/spotify-mcp-cache/`)
     - Runs: `uvx --python 3.12 --from git+https://github.com/varunneal/spotify-mcp spotify-mcp`
     - Passes environment variables: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIPY_CACHE_PATH`

2. **Cache File Format**:
   ```json
   {
     "access_token": "BQ...",
     "token_type": "Bearer",
     "expires_in": 3600,
     "refresh_token": "AQ...",
     "scope": "...",
     "expires_at": 1234567890
   }
   ```

3. **Troubleshooting**:
   - **`uvx: command not found`**: Install `uv` (see Prerequisites)
   - **Python version error**: Ensure Python 3.12+ is available
   - **Connection timeout**: Check if `uvx` can download the package (network/firewall)
   - **OAuth errors**: Verify redirect URI matches Spotify app settings
   - **Cache file issues**: Check `/tmp/spotify-mcp-cache/` directory permissions

### Manual Testing

You can test the Spotify MCP server manually:

```bash
# Install and run spotify-mcp directly
uvx --python 3.12 --from git+https://github.com/varunneal/spotify-mcp spotify-mcp

# Or clone and run locally
git clone https://github.com/varunneal/spotify-mcp.git
cd spotify-mcp
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -e .
spotify-mcp
```

### Path Configuration

The integration automatically adds `~/.local/bin` to PATH (where `uvx` is typically installed). If `uvx` is in a different location, you may need to:

1. Add it to your system PATH, or
2. Modify `spotify.js` to use the full path to `uvx`

Example modification in `spotify.js`:
```javascript
const transport = new StdioClientTransport({
  command: '/full/path/to/uvx',  // Use full path if needed
  args: [
    '--python', '3.12',
    '--from', 'git+https://github.com/varunneal/spotify-mcp',
    'spotify-mcp'
  ],
  // ...
});
```

## 📝 Notes

- **In-Memory Connections**: Connections are stored in memory and lost on server restart. They are automatically re-established on first use.
- **Lazy Loading**: Integrations are loaded on-demand per user (multi-tenant friendly).
- **OAuth Expiration**: OAuth tokens may expire. The system detects this and prompts for re-authentication.
- **Local MCP Servers**: Local MCP server processes may die. Health checks detect this and reconnect automatically.
- **Remote MCP Servers**: Remote servers may be down or unreachable. Retry logic handles temporary failures.
- **Concurrent Connections**: The system prevents concurrent connection attempts for the same integration.
- **Tool Caching**: Tools are cached for 30 minutes to reduce API calls.
- **Spotify Cache Files**: Cache files are stored in `/tmp/spotify-mcp-cache/` and cleaned up automatically (or manually if needed).

