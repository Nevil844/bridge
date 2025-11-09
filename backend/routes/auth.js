const express = require('express');
const { v4: uuidv4 } = require('uuid');
const userService = require('../db/services/user');
const integrationService = require('../db/services/integration');
const appConfig = require('../config/app');

const router = express.Router();

// Store pending auth states (in production, use Redis or database)
const pendingAuthStates = new Map();

// Store temporary sessions for OAuth completion (in production, use Redis or database)
// Maps state -> { userId, email, expiresAt }
const oauthSessions = new Map();

// Clean up expired states and sessions periodically
setInterval(() => {
  const tenMinutesAgo = Date.now() - appConfig.oauth.stateExpiry;
  
  // Clean up pending auth states
  for (const [state, data] of pendingAuthStates.entries()) {
    if (data.timestamp < tenMinutesAgo) {
      pendingAuthStates.delete(state);
    }
  }
  
  // Clean up expired OAuth sessions
  const now = Date.now();
  for (const [state, session] of oauthSessions.entries()) {
    if (session.expiresAt < now) {
      oauthSessions.delete(state);
    }
  }
}, appConfig.oauth.cleanupInterval);

/**
 * Get OAuth URL for user authentication
 */
router.get('/google/url', (req, res) => {
  try {
    // Dynamic import to avoid hardcoding Google Auth
    const GoogleAuthOAuth = require('../oauth/integrations/google-auth');
    const googleAuth = new GoogleAuthOAuth();
    
    if (!googleAuth.isConfigured()) {
      return res.status(500).json({ 
        error: 'Google OAuth is not configured. Please set GOOGLE_AUTH_CLIENT_ID and GOOGLE_AUTH_CLIENT_SECRET in your .env file.',
        setupGuide: 'https://console.cloud.google.com/apis/credentials'
      });
    }

    // Allow frontend to specify redirect URI (for mobile/web flexibility)
    const requestedRedirectUri = req.query.redirectUri;
    let redirectUri = googleAuth.redirectUri;
    
    // If frontend provides a redirect URI, use it (but validate it's from our backend)
    if (requestedRedirectUri) {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
      
      // Allow redirect URIs that match our backend
      const isValidRedirectUri = 
        requestedRedirectUri.startsWith(backendUrl) || 
        requestedRedirectUri.startsWith('http://localhost:3000') ||
        requestedRedirectUri.startsWith('http://127.0.0.1:3000') ||
        requestedRedirectUri.match(/^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)\d+\.\d+:3000/) ||
        requestedRedirectUri.includes('/api/auth/google/callback');
      
      if (isValidRedirectUri) {
        redirectUri = requestedRedirectUri;
        console.log('📱 Using frontend-provided redirect URI:', redirectUri);
      } else {
        console.warn('⚠️ Invalid redirect URI requested:', requestedRedirectUri, '- using default');
      }
    }

    // Generate unique state for CSRF protection
    const state = uuidv4();
    
    // Store state with timestamp and redirect URI
    pendingAuthStates.set(state, {
      timestamp: Date.now(),
      redirectUri: redirectUri,
    });

    // Create a new GoogleAuth instance with the custom redirect URI
    const customGoogleAuth = new GoogleAuthOAuth();
    if (redirectUri !== googleAuth.redirectUri) {
      customGoogleAuth.redirectUri = redirectUri;
    }
    const authUrl = customGoogleAuth.getAuthUrl(state);
    
    res.json({ 
      authUrl, 
      state,
      redirectUri: redirectUri,
      clientId: googleAuth.clientId ? `${googleAuth.clientId.substring(0, 20)}...` : 'not set',
    });
  } catch (error) {
    console.error('Error generating auth URL:', error.message);
    res.status(500).json({ error: error.message || 'Failed to generate auth URL' });
  }
});

/**
 * OAuth callback handler
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error, error_description, success, email, userId } = req.query;
    
    console.log('\n🔐 OAuth Callback Received:', {
      hasCode: !!code,
      hasState: !!state,
      state: state,
      success: success,
      userId: userId,
      email: email,
      error: error,
    });
    
    // If this is a success redirect (after OAuth completion), show success page
    if (success === 'true' && userId) {
      console.log('✅ Success redirect - session should already be stored');
      
      if (state && oauthSessions.has(state)) {
        console.log('✅ Session found for state:', state);
      } else {
        console.log('⚠️ Session NOT found for state:', state);
      }
      
      // Fetch user info to display
      const user = await userService.getUserById(userId);
      const userInfo = {
        email: email || user?.email || '',
        name: user?.username || email || '',
        picture: '',
      };
      
      // Try to get picture from integration metadata
      try {
        const integration = await integrationService.getIntegration(userId, 'google-auth');
        if (integration?.metadata?.picture) {
          userInfo.picture = integration.metadata.picture;
        }
        if (integration?.metadata?.name) {
          userInfo.name = integration.metadata.name;
        }
      } catch (e) {
        // Ignore errors
      }
      
      return res.send(createSuccessPage(userInfo, userId, state));
    }
    
    // Continue with OAuth flow - handle initial OAuth callback
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    if (!state) {
      console.log('❌ Missing state parameter');
      return res.status(400).send('Missing state parameter');
    }

    // Get the redirect URI that was used for this state
    const stateData = pendingAuthStates.get(state);
    let expectedRedirectUri = null;
    if (stateData && stateData.redirectUri) {
      expectedRedirectUri = stateData.redirectUri;
      console.log('📋 Using redirect URI from state:', expectedRedirectUri);
    }

    if (pendingAuthStates.has(state)) {
      pendingAuthStates.delete(state);
      console.log('✅ State validated and removed from pending states');
    }

    // Exchange code for token
    const GoogleAuthOAuth = require('../oauth/integrations/google-auth');
    const googleAuth = new GoogleAuthOAuth();
    
    if (expectedRedirectUri && expectedRedirectUri !== googleAuth.redirectUri) {
      googleAuth.redirectUri = expectedRedirectUri;
      console.log('🔄 Updated redirect URI for token exchange:', expectedRedirectUri);
    }
    
    const tokenData = await googleAuth.exchangeCodeForToken(code);
    const userInfo = await googleAuth.getUserInfo(tokenData.accessToken);

    // Create or update user in database
    const user = await userService.getOrCreateUser(userInfo.email, userInfo.email);
    
    if (userInfo.name && !user.username) {
      await userService.updateUser(user.id, {
        username: userInfo.name,
        email: userInfo.email,
      });
    }

    // Store Google tokens as an integration
    await integrationService.storeIntegration(
      user.id,
      'google-auth',
      {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresIn: tokenData.expiresIn,
      },
      {
        googleId: userInfo.id,
        name: userInfo.name,
        picture: userInfo.picture,
        verifiedEmail: userInfo.verifiedEmail,
      }
    );

    // Store session for app to poll
    console.log('💾 Storing OAuth session for state:', state);
    oauthSessions.set(state, {
      userId: user.id,
      email: userInfo.email,
      name: userInfo.name,
      expiresAt: Date.now() + appConfig.oauth.sessionExpiry,
    });
    console.log('✅ Session stored. Total sessions:', oauthSessions.size);

    // Redirect to callback URL with user info
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const successUrl = `${backendUrl}/api/auth/google/callback?success=true&email=${encodeURIComponent(userInfo.email)}&userId=${user.id}&state=${state}`;
    
    res.redirect(successUrl);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).send(createErrorPage('Login Failed', 'An error occurred during authentication. Please try again.'));
  }
});

/**
 * Check OAuth session status (for polling after browser dismiss)
 */
router.get('/google/session', async (req, res) => {
  try {
    const { state } = req.query;
    
    console.log('\n🔍 Session check requested:', {
      state: state,
      totalSessions: oauthSessions.size,
    });
    
    if (!state) {
      return res.status(400).json({ error: 'state parameter is required' });
    }

    const session = oauthSessions.get(state);
    
    if (!session) {
      console.log('❌ Session not found for state:', state);
      return res.status(404).json({ 
        error: 'Session not found or expired',
        debug: {
          requestedState: state,
          availableStates: Array.from(oauthSessions.keys()),
          totalSessions: oauthSessions.size,
        }
      });
    }

    // Check if session expired
    if (session.expiresAt < Date.now()) {
      console.log('⏰ Session expired for state:', state);
      oauthSessions.delete(state);
      return res.status(404).json({ error: 'Session expired' });
    }

    console.log('✅ Session found:', {
      userId: session.userId,
      email: session.email,
    });

    res.json({
      userId: session.userId,
      email: session.email,
      name: session.name,
    });
  } catch (error) {
    console.error('Error checking OAuth session:', error);
    res.status(500).json({ error: 'Failed to check session' });
  }
});

/**
 * Get current user info
 */
router.get('/me', async (req, res) => {
  try {
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const user = await userService.getUserById(userId);
    
    if (!user) {
      // Try to find by username/email
      const userByUsername = await userService.getUserByUsername(userId);
      const userByEmail = await userService.getUserByEmail(userId);
      const foundUser = userByUsername || userByEmail;
      
      if (!foundUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Try to get profile picture
      let picture = null;
      let name = foundUser.username;
      try {
        const integration = await integrationService.getIntegration(foundUser.id, 'google-auth');
        if (integration?.metadata?.picture) {
          picture = integration.metadata.picture;
        }
        if (integration?.metadata?.name) {
          name = integration.metadata.name;
        }
      } catch (e) {
        // Ignore errors
      }
      
      return res.json({
        id: foundUser.id,
        username: name || foundUser.username,
        email: foundUser.email,
        picture: picture,
        plan: foundUser.plan || 'free',
        createdAt: foundUser.createdAt,
      });
    }

    // Try to get profile picture for the user
    let picture = null;
    let name = user.username;
    try {
      const integration = await integrationService.getIntegration(user.id, 'google-auth');
      if (integration?.metadata?.picture) {
        picture = integration.metadata.picture;
      }
      if (integration?.metadata?.name) {
        name = integration.metadata.name;
      }
    } catch (e) {
      // Ignore errors
    }

    res.json({
      id: user.id,
      username: name || user.username,
      email: user.email,
      picture: picture,
      plan: user.plan || 'free',
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * Test endpoint to verify callback is accessible
 */
router.get('/google/test', (req, res) => {
  res.json({ 
    message: 'Callback endpoint is accessible',
    timestamp: new Date().toISOString(),
    totalSessions: oauthSessions.size,
    availableStates: Array.from(oauthSessions.keys()),
  });
});

/**
 * Helper: Create success page HTML
 */
function createSuccessPage(userInfo, userId, state) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Login Successful</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
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
          .user-info {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
          }
          .user-info img {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            margin-bottom: 10px;
          }
          .user-info p {
            margin: 5px 0;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="checkmark">✓</div>
          <h1>Login Successful!</h1>
          <div class="user-info">
            ${userInfo.picture ? `<img src="${userInfo.picture}" alt="${userInfo.name}" />` : ''}
            <p><strong>${userInfo.name || userInfo.email}</strong></p>
            <p style="color: #999; font-size: 12px;">${userInfo.email}</p>
          </div>
          <p>You can now close this window and return to the app.</p>
          <script>
            try {
              localStorage.setItem('oauth_userId', '${userId}');
              localStorage.setItem('oauth_email', '${userInfo.email}');
              localStorage.setItem('oauth_state', '${state || ''}');
            } catch (e) {
              console.error('Failed to store in localStorage:', e);
            }
            setTimeout(() => {
              try {
                window.close();
              } catch (e) {}
            }, 2000);
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

