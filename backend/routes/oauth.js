const express = require('express');
const oauthHandler = require('../oauth/handler');
const integrationService = require('../db/services/integration');
const mcpManager = require('../mcp/manager');
const { ensureUserIntegrationsLoaded, loadedIntegrationsCache } = require('../utils/integrationLoader');

const router = express.Router();

/**
 * Generic OAuth URL endpoint
 * Mounted at /api/integrations in server.js, so route is /:type/oauth-url
 * Also works when mounted at /api/oauth as /integrations/:type/oauth-url
 */
router.get('/:type/oauth-url', (req, res) => {
  try {
    const { type } = req.params;
    const userId = req.query.userId || 'default-user';
    
    const authUrl = oauthHandler.getAuthUrl(type, userId);
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating OAuth URL:', error.message);
    res.status(500).json({ error: error.message || 'Failed to generate OAuth URL' });
  }
});

// Also support the old path for /api/oauth mount point
router.get('/integrations/:type/oauth-url', (req, res) => {
  try {
    const { type } = req.params;
    const userId = req.query.userId || 'default-user';
    
    const authUrl = oauthHandler.getAuthUrl(type, userId);
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating OAuth URL:', error.message);
    res.status(500).json({ error: error.message || 'Failed to generate OAuth URL' });
  }
});

/**
 * Generic OAuth callback endpoint
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, request_token, state, error, error_description, status, action } = req.query;
    
    // Zerodha uses request_token instead of code
    const authCode = code || request_token;

    console.log('\n🔐 OAuth callback received:', {
      hasCode: !!authCode,
      hasState: !!state,
      isZerodha: !!request_token,
      status: status || 'none',
      action: action || 'none',
      error: error || 'none',
      error_description: error_description || 'none',
      allParams: req.query
    });

    // Handle OAuth errors from provider (e.g., user denied access)
    if (error) {
      console.error('❌ OAuth error from provider:', error, error_description);
      return res.send(createErrorPage('Authorization Failed', error_description || 'You can close this window and try again.'));
    }

    if (!authCode) {
      console.error('❌ Missing authorization code');
      return res.status(400).send(createErrorPage('Authorization Failed', 'Missing authorization code'));
    }

    if (!state) {
      console.error('❌ Missing state parameter');
      return res.status(400).send(createErrorPage('Authorization Failed', 'Missing state parameter. Please try connecting again.'));
    }

    // Verify state and get userId + integration type
    const stateData = oauthHandler.verifyState(state);
    if (!stateData) {
      console.warn('⚠️ Invalid or expired state - checking if already connected...', state);
      return res.send(createSuccessPage('Already Connected', 'This authorization was already processed successfully.'));
    }

    const { userId, integrationType } = stateData;

    console.log(`✅ Valid state for user ${userId}, exchanging code for token...`);

    // Exchange code for access token
    const tokenData = await oauthHandler.exchangeCodeForToken(integrationType, authCode);
    
    console.log(`✅ Got tokens, adding ${integrationType} integration...`);
    
    // Handle different token formats (some integrations return just a string, others return an object)
    let config;
    if (typeof tokenData === 'string') {
      config = { token: tokenData };
    } else {
      config = { 
        token: tokenData.accessToken, 
        refreshToken: tokenData.refreshToken,
        // Include additional data for integrations like Zerodha
        userId: tokenData.userId,
        userName: tokenData.userName,
        email: tokenData.email,
      };
    }
    
    // Save to database first (encrypted)
    await integrationService.storeIntegration(
      userId,
      integrationType,
      config,
      { connectedAt: new Date(), viaOAuth: true }
    );

    // Add to MCP manager (for immediate use)
    // This will establish the connection with the new OAuth tokens
    await mcpManager.addIntegration(userId, integrationType, config);
    
    // Update cache to include this new integration
    if (!loadedIntegrationsCache.has(userId)) {
      loadedIntegrationsCache.set(userId, new Set());
    }
    loadedIntegrationsCache.get(userId).add(integrationType);
    
    // Invalidate tools cache to force refresh
    mcpManager.invalidateToolsCache(userId);

    console.log(`✅ ${integrationType} integration added successfully!`);

    // Get integration name for display
    const integrationName = integrationType.charAt(0).toUpperCase() + integrationType.slice(1);

    // Return generic success page
    res.send(createSuccessPage(`${integrationName} Connected!`, `Your AI assistant now has access to ${integrationName}.`));
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send(createErrorPage('OAuth Failed', 'OAuth failed. Please try again.'));
  }
});

/**
 * Helper: Create success page HTML
 */
function createSuccessPage(title, message) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            max-width: 400px;
          }
          .checkmark {
            font-size: 60px;
            color: #34C759;
            margin-bottom: 20px;
          }
          h1 {
            color: #333;
            margin: 0 0 10px 0;
            font-size: 24px;
          }
          p {
            color: #666;
            margin: 0 0 20px 0;
            font-size: 16px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="checkmark">✓</div>
          <h1>${title}</h1>
          <p>You can now close this window and return to the app.</p>
          ${message ? `<p style="font-size: 14px; color: #999;">${message}</p>` : ''}
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </div>
      </body>
    </html>
  `;
}

/**
 * Helper: Create error page HTML
 */
function createErrorPage(title, message) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, sans-serif; text-align: center; padding: 50px; }
          .error { color: #ff3b30; font-size: 48px; }
        </style>
      </head>
      <body>
        <div class="error">❌</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <script>setTimeout(() => window.close(), 3000);</script>
      </body>
    </html>
  `;
}

module.exports = router;

