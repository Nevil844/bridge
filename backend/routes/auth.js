const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const userService = require('../db/services/user');
const integrationService = require('../db/services/integration');
const appConfig = require('../config/app');
const crypto = require('crypto');

const router = express.Router();
const prisma = new PrismaClient();

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
    
    // If this is a success redirect (after OAuth completion), show success page
    if (success === 'true' && userId) {
      
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
      return res.status(400).send('Missing state parameter');
    }

    // Get the redirect URI that was used for this state
    const stateData = pendingAuthStates.get(state);
    let expectedRedirectUri = null;
    if (stateData && stateData.redirectUri) {
      expectedRedirectUri = stateData.redirectUri;
    }

    if (pendingAuthStates.has(state)) {
      pendingAuthStates.delete(state);
    }

    // Exchange code for token
    const GoogleAuthOAuth = require('../oauth/integrations/google-auth');
    const googleAuth = new GoogleAuthOAuth();
    
    if (expectedRedirectUri && expectedRedirectUri !== googleAuth.redirectUri) {
      googleAuth.redirectUri = expectedRedirectUri;
    }
    
    const tokenData = await googleAuth.exchangeCodeForToken(code);
    const userInfo = await googleAuth.getUserInfo(tokenData.accessToken);

    // Check if user is invited (invite-only mode)
    const waitlistEntry = await prisma.waitlist.findUnique({
      where: { email: userInfo.email.toLowerCase().trim() },
    });

    if (!waitlistEntry || !waitlistEntry.isInvited) {
      return res.status(403).send(createErrorPage(
        'Access Restricted',
        'This app is currently invite-only. Please join the waitlist and wait for an invitation.',
        'https://join.bridge.neviljobanputra.com'
      ));
    }

    // Check if user exists and is deleted
    let user = await userService.getUserByEmail(userInfo.email);
    
    if (user && user.isDeleted) {
      return res.status(403).send(createErrorPage(
        'Account Deleted',
        'Your account has been deleted. Please contact the developer at neviljobanputra34@gmail.com if you need assistance.',
        null
      ));
    }

    // Create or update user in database
    user = await userService.getOrCreateUser(userInfo.email, userInfo.email);
    
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

    // Store session for app to poll (include access token for frontend)
    oauthSessions.set(state, {
      userId: user.id,
      email: userInfo.email,
      name: userInfo.name,
      accessToken: tokenData.accessToken, // Include token in session
      expiresAt: Date.now() + appConfig.oauth.sessionExpiry,
    });

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
 * Returns user info and access token for frontend to store
 */
router.get('/google/session', async (req, res) => {
  try {
    const { state } = req.query;
    
    if (!state) {
      return res.status(400).json({ error: 'state parameter is required' });
    }

    const session = oauthSessions.get(state);
    
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found or expired'
      });
    }

    // Check if session expired
    if (session.expiresAt < Date.now()) {
      oauthSessions.delete(state);
      return res.status(404).json({ error: 'Session expired' });
    }

    // Get access token from user's google-auth integration
    let accessToken = null;
    try {
      const integration = await integrationService.getIntegration(session.userId, 'google-auth');
      if (integration?.credentials) {
        const credentials = integration.credentials;
        if (typeof credentials === 'object' && credentials.accessToken) {
          accessToken = credentials.accessToken;
        }
      }
    } catch (error) {
      console.error('Error getting access token:', error);
    }

    res.json({
      userId: session.userId,
      email: session.email,
      name: session.name,
      accessToken: accessToken, // Include token for frontend to store
    });
  } catch (error) {
    console.error('Error checking OAuth session:', error);
    res.status(500).json({ error: 'Failed to check session' });
  }
});

/**
 * Get access token for authenticated user
 * NOTE: This endpoint uses userId-based auth temporarily (before token is stored)
 * After first use, all other endpoints require token-based auth
 */
router.get('/token', async (req, res) => {
  try {
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Verify user exists and has google-auth integration
    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const integration = await integrationService.getIntegration(userId, 'google-auth');
    if (!integration || !integration.isActive) {
      return res.status(403).json({ error: 'User has not completed Google OAuth' });
    }

    // Return access token
    const credentials = integration.credentials;
    if (typeof credentials === 'object' && credentials.accessToken) {
      res.json({
        accessToken: credentials.accessToken,
      });
    } else {
      res.status(404).json({ error: 'Access token not found' });
    }
  } catch (error) {
    console.error('Error getting access token:', error);
    res.status(500).json({ error: 'Failed to get access token' });
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
      if (integration?.metadata) {
        // Check both metadata.picture and direct picture field
        picture = integration.metadata.picture || integration.metadata.pictureUrl || null;
        name = integration.metadata.name || user.username;
        
      }
    } catch (e) {
      console.error('Error getting profile picture:', e);
      // Ignore errors but log them
    }

    res.json({
      id: user.id,
      username: name || user.username,
      email: user.email,
      picture: picture || null, // Explicitly set to null if not found
      plan: user.plan || 'free',
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * DELETE /api/auth/account
 * Delete user account and all related data
 */
const { verifyUser } = require('../middleware/auth');
router.delete('/account', verifyUser, async (req, res) => {
  try {
    const userId = req.userId;
    
    // Delete user (cascade deletes all related data: conversations, messages, integrations, memories, token usage)
    await userService.deleteUser(userId);
    
    res.json({ 
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
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
 * POST /api/auth/apple/login
 * Sign in with Apple flow (frontend already obtained Apple credential)
 *
 * - Auto-adds the user to the waitlist (if not present) and marks them as invited
 *   so App Review and Apple users can access the app without manual approval.
 * - Creates or fetches a user account.
 * - Issues an internal access token stored via the existing integrationService so
 *   the same token-based auth middleware (verifyUser) continues to work.
 *
 * After App Store review, you can gate the auto-approval behind an env flag
 * (e.g., INVITE_ONLY=true) to restore invite-only behavior.
 */
router.post('/apple/login', async (req, res) => {
  try {
    console.log('🔐 Apple login request body:', req.body);
    const { appleUserId, email, fullName, identityToken } = req.body || {};

    if (!appleUserId) {
      return res.status(400).json({ error: 'appleUserId is required' });
    }

    // Prefer email from the identityToken payload (more reliable across logins),
    // then fall back to credential.email, and only as a last resort synthesize one.
    let tokenEmail = null;
    try {
      if (identityToken) {
        const parts = identityToken.split('.');
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
          const payload = JSON.parse(payloadJson);
          tokenEmail = payload.email || null;
          console.log('📧 Apple identityToken payload email:', {
            email: payload.email,
            is_private_email: payload.is_private_email,
            email_verified: payload.email_verified,
          });
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to parse Apple identityToken payload:', e);
    }

    let effectiveEmail = email && email.trim() ? email : tokenEmail;

    if (!effectiveEmail) {
      // Last resort for environments where Apple provides no email at all.
      // This is non-routable and only used to satisfy our schema; app logic
      // should not rely on contacting this address.
      effectiveEmail = `${appleUserId}@apple.local`;
    }

    const normalizedEmail = effectiveEmail.toLowerCase().trim();

    // TODO (optional): Verify identityToken with Apple on the server for extra security.
    // For App Review and initial launch, we rely on Expo/Apple on-device verification.

    // Auto-add to waitlist and mark as invited so Apple Review can access the app.
    let waitlistEntry = await prisma.waitlist.findUnique({
      where: { email: normalizedEmail },
    });

    if (!waitlistEntry) {
      waitlistEntry = await prisma.waitlist.create({
        data: {
          email: normalizedEmail,
          isInvited: true,
        },
      });
      console.log(`✅ Created and invited waitlist entry for Apple user: ${normalizedEmail}`);
    } else if (!waitlistEntry.isInvited) {
      waitlistEntry = await prisma.waitlist.update({
        where: { email: normalizedEmail },
        data: { isInvited: true },
      });
      console.log(`✅ Marked existing waitlist entry as invited for Apple user: ${normalizedEmail}`);
    }

    // Check if user exists and is deleted
    let user = await userService.getUserByEmail(normalizedEmail);
    
    if (user && user.isDeleted) {
      return res.status(403).json({ 
        error: 'Account Deleted',
        message: 'Your account has been deleted. Please contact the developer at neviljobanputra34@gmail.com if you need assistance.'
      });
    }

    // Create or fetch user account
    if (!user) {
      user = await userService.createUser(fullName || normalizedEmail, normalizedEmail);
    } else if (fullName && !user.username) {
      user = await userService.updateUser(user.id, {
        username: fullName,
        email: normalizedEmail,
      });
    }

    // Generate an internal access token and store it via integrationService so
    // verifyUser (which looks up google-auth integration credentials.accessToken)
    // continues to function without major refactors.
    const accessToken = crypto.randomBytes(32).toString('hex');

    await integrationService.storeIntegration(
      user.id,
      'google-auth',
      { accessToken },
      {
        provider: 'apple',
        appleUserId,
        email: normalizedEmail,
        name: fullName || normalizedEmail,
        identityTokenPresent: !!identityToken,
      }
    );

    res.json({
      id: user.id,
      email: user.email,
      name: user.username,
      plan: user.plan || 'free',
      accessToken,
    });
  } catch (error) {
    console.error('Apple login error:', error);
    res.status(500).json({ error: 'Failed to sign in with Apple' });
  }
});

/**
 * Helper: Create success page HTML
 */
function createSuccessPage(userInfo, userId, state) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Bridge AI – Login Successful</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background:
              radial-gradient(circle at top left, rgba(74, 158, 255, 0.4), transparent 55%),
              radial-gradient(circle at bottom right, rgba(124, 58, 237, 0.4), transparent 55%),
              #050816;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .container {
            text-align: center;
            background: rgba(15, 23, 42, 0.96);
            padding: 32px 28px;
            border-radius: 24px;
            box-shadow:
              0 18px 60px rgba(15, 23, 42, 0.9),
              0 0 0 1px rgba(148, 163, 184, 0.12);
            max-width: 400px;
            width: 90%;
            backdrop-filter: blur(22px);
          }
          .checkmark {
            width: 64px;
            height: 64px;
            border-radius: 32px;
            margin: 0 auto 20px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at top, #4A9EFF, #2563EB);
            box-shadow: 0 12px 35px rgba(37, 99, 235, 0.7);
            color: white;
            font-size: 32px;
          }
          h1 {
            color: #E5E7EB;
            margin: 0 0 10px 0;
            font-size: 22px;
            letter-spacing: 0.03em;
          }
          p {
            color: #9CA3AF;
            margin: 0 0 20px 0;
            font-size: 14px;
            line-height: 1.6;
          }
          .user-info {
            background: rgba(15, 23, 42, 0.9);
            padding: 14px 16px;
            border-radius: 14px;
            margin: 20px 0;
            border: 1px solid rgba(148, 163, 184, 0.25);
          }
          .user-info img {
            width: 52px;
            height: 52px;
            border-radius: 999px;
            margin-bottom: 8px;
            border: 2px solid rgba(148, 163, 184, 0.5);
          }
          .user-info p {
            margin: 5px 0;
            font-size: 13px;
          }
          .email {
            color: #6B7280;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 11px;
            background: rgba(37, 99, 235, 0.12);
            color: #BFDBFE;
            margin-top: 6px;
          }
          .badge-dot {
            width: 6px;
            height: 6px;
            border-radius: 999px;
            background: #4ADE80;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="checkmark">✓</div>
          <h1>Welcome to Bridge AI</h1>
          <div class="user-info">
            ${userInfo.picture ? `<img src="${userInfo.picture}" alt="${userInfo.name}" />` : ''}
            <p><strong>${userInfo.name || userInfo.email}</strong></p>
            <p class="email">${userInfo.email}</p>
            <div class="badge">
              <span class="badge-dot"></span>
              <span>Login successful</span>
            </div>
          </div>
          <p>You can close this tab and continue in the Bridge AI app.</p>
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
function createErrorPage(title, message, registrationUrl = null) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title} – Bridge AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background:
              radial-gradient(circle at top left, rgba(74, 158, 255, 0.4), transparent 55%),
              radial-gradient(circle at bottom right, rgba(124, 58, 237, 0.4), transparent 55%),
              #050816;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .container {
            text-align: center;
            background: rgba(15, 23, 42, 0.96);
            padding: 40px 32px;
            border-radius: 24px;
            box-shadow:
              0 18px 60px rgba(15, 23, 42, 0.9),
              0 0 0 1px rgba(148, 163, 184, 0.12);
            max-width: 480px;
            width: 90%;
            backdrop-filter: blur(22px);
          }
          .icon {
            width: 72px;
            height: 72px;
            border-radius: 36px;
            margin: 0 auto 24px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at top, rgba(255, 59, 48, 0.2), rgba(220, 38, 38, 0.3));
            box-shadow: 0 12px 35px rgba(220, 38, 38, 0.4);
            color: #FCA5A5;
            font-size: 36px;
            border: 1px solid rgba(220, 38, 38, 0.3);
          }
          h1 {
            color: #E5E7EB;
            margin: 0 0 12px 0;
            font-size: 24px;
            font-weight: 600;
            letter-spacing: 0.03em;
          }
          p {
            color: #9CA3AF;
            margin: 0 0 28px 0;
            font-size: 15px;
            line-height: 1.6;
          }
          .button {
            display: inline-block;
            padding: 14px 28px;
            background: linear-gradient(135deg, #4A9EFF 0%, #2563EB 100%);
            color: white;
            text-decoration: none;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 600;
            transition: all 0.2s ease;
            box-shadow: 0 8px 24px rgba(37, 99, 235, 0.4);
            margin-top: 8px;
          }
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 32px rgba(37, 99, 235, 0.5);
          }
          .button:active {
            transform: translateY(0);
          }
          .footer {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid rgba(148, 163, 184, 0.15);
            color: #6B7280;
            font-size: 13px;
          }
          .logo {
            color: #4A9EFF;
            font-weight: 700;
            font-size: 18px;
            margin-bottom: 8px;
            letter-spacing: 0.05em;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">BRIDGE AI</div>
          <div class="icon">⚠️</div>
          <h1>${title}</h1>
          <p>${message}</p>
          ${registrationUrl ? `
            <a href="${registrationUrl}" target="_blank" class="button">
              Join Waitlist →
            </a>
          ` : ''}
          <div class="footer">
            <p style="margin: 0; font-size: 12px;">You can close this window when you're done</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

module.exports = router;

