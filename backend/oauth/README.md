# OAuth Organization

This directory contains all OAuth-related code in a clean, modular structure.

## 📁 Structure

```
oauth/
├── handler.js              # Generic OAuth handler (manages all OAuth flows)
└── integrations/           # Integration-specific OAuth implementations
    ├── index.js            # OAuth integrations registry
    ├── github.js           # GitHub OAuth 2.0 implementation
    └── [future-oauth].js   # Slack, Google, etc.
```

## 🔌 Adding a New OAuth Integration

### 1. Create Integration File

Create `integrations/your-service.js`:

```javascript
const axios = require('axios');

class YourServiceOAuth {
  constructor() {
    this.name = 'Your Service';
    this.type = 'your-service';
    this.clientId = process.env.YOUR_SERVICE_CLIENT_ID;
    this.clientSecret = process.env.YOUR_SERVICE_CLIENT_SECRET;
    this.callbackUrl = process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000/api/oauth/callback';
  }

  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      scope: 'read write',  // Your scopes
      state: state,
    });
    return `https://your-service.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code) {
    const response = await axios.post(
      'https://your-service.com/oauth/token',
      {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        grant_type: 'authorization_code',
      },
      { headers: { Accept: 'application/json' } }
    );
    return response.data.access_token;
  }

  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }
}

module.exports = YourServiceOAuth;
```

### 2. Register in `integrations/index.js`

```javascript
const YourServiceOAuth = require('./your-service.js');

const oauthIntegrations = {
  // ... existing integrations
  'your-service': YourServiceOAuth,
};
```

### 3. Add Environment Variables

Update `.env`:

```bash
YOUR_SERVICE_CLIENT_ID=your_client_id_here
YOUR_SERVICE_CLIENT_SECRET=your_client_secret_here
```

### 4. That's It! ✨

The generic OAuth handler will automatically work with your new integration:

- **OAuth URL**: `GET /api/integrations/your-service/oauth-url?userId=123`
- **Callback**: `GET /api/oauth/callback?code=...&state=...`

## 🎯 Design Principles

1. **Generic Handler**: No integration-specific logic in the handler
2. **Modular**: Each OAuth provider is self-contained
3. **Extensible**: Easy to add new providers without changing core code
4. **Secure**: State parameter for CSRF protection, automatic cleanup

## 📚 Current Integrations

- **GitHub** (`github.js`): OAuth 2.0 with `repo` and `read:org` scopes
  - Env vars: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

## 🔧 Core Components

### `handler.js`
- Manages OAuth state for CSRF protection
- Routes OAuth requests to correct integration
- Generic: works with any OAuth provider
- Methods:
  - `getAuthUrl(type, userId)`: Get authorization URL
  - `exchangeCodeForToken(type, code)`: Exchange code for token
  - `verifyState(state)`: Verify and retrieve state data
  - `cleanupOldStates()`: Remove expired states

### `integrations/`
- Each file implements OAuth for one service
- Standard interface: `getAuthUrl()`, `exchangeCodeForToken()`, `isConfigured()`
- All service-specific logic stays here

## 🚀 Usage in Server

```javascript
const oauthHandler = require('./oauth/handler');

// Get OAuth URL (generic endpoint)
app.get('/api/integrations/:type/oauth-url', (req, res) => {
  const { type } = req.params;
  const userId = req.query.userId;
  const authUrl = oauthHandler.getAuthUrl(type, userId);
  res.json({ authUrl });
});

// Handle callback (works for all integrations)
app.get('/api/oauth/callback', async (req, res) => {
  const { code, state } = req.query;
  const { userId, integrationType } = oauthHandler.verifyState(state);
  const token = await oauthHandler.exchangeCodeForToken(integrationType, code);
  // Use token...
});
```

## 🔐 Security Features

- **State Parameter**: Unique UUID for each OAuth flow (CSRF protection)
- **Automatic Cleanup**: Old states (>10 minutes) are automatically removed
- **Validation**: OAuth state is verified before token exchange
- **Environment Variables**: Sensitive credentials never hardcoded

## 📖 OAuth Flow

1. **User clicks "Connect"** in app
2. **Frontend requests OAuth URL**: `GET /api/integrations/github/oauth-url?userId=123`
3. **Backend generates state**: Unique UUID stored with userId + integrationType
4. **Backend returns auth URL**: GitHub authorization page
5. **User authorizes**: In browser
6. **GitHub redirects to callback**: With `code` and `state`
7. **Backend verifies state**: Retrieves userId + integrationType
8. **Backend exchanges code**: Gets access token from GitHub
9. **Backend adds integration**: Stores token and connects MCP
10. **Success page displayed**: User returns to app

---

**Code Quality:** ✅ No linting errors  
**Security:** ✅ CSRF protection with state parameter  
**Maintainability:** ✅ Clean, modular, extensible architecture

