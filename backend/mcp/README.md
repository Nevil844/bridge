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
    └── [future-integrations].js
```

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

- **GitHub** (`github.js`): Access repositories, issues, PRs, and more
  - Auth: OAuth 2.0
  - MCP Server: `@modelcontextprotocol/server-github`

## 🔧 Core Components

### `manager.js`
- Manages user integrations (add, remove, list)
- Handles MCP connections per user
- Routes tool calls to the correct integration
- Integration-agnostic design

### `tools.js`
- Converts MCP tool definitions to OpenAI function calling format
- Generates generic system prompts based on connected integrations
- No integration-specific logic

### `integrations/`
- Each file implements a specific integration
- Follows common interface: `connect`, `disconnect`, `getTools`, `callTool`
- Self-contained: all integration-specific logic stays here

## 🚀 Usage

```javascript
const mcpManager = require('./mcp/manager');

// Add integration
await mcpManager.addIntegration('user-123', 'github', { token: '...' });

// Get tools
const tools = await mcpManager.getUserMCPTools('user-123');

// Call tool
const result = await mcpManager.callUserTool('user-123', 'search_repositories', { query: 'react' });

// Remove integration
await mcpManager.removeIntegration('user-123', 'github');
```

