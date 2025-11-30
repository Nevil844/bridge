const axios = require('axios');

/**
 * Slack OAuth Integration
 * Handles OAuth 2.0 flow for Slack API
 * https://api.slack.com/authentication/oauth-v2
 */
class SlackOAuth {
  constructor() {
    this.clientId = process.env.SLACK_CLIENT_ID;
    this.clientSecret = process.env.SLACK_CLIENT_SECRET;
    this.redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:3000/api/oauth/callback';
    this.name = 'Slack';
    
    // Slack scopes for comprehensive access
    this.scopes = [
      'channels:read',        // Read public channel information
      'channels:history',      // View messages in public channels
      'chat:write',            // Send messages
      'users:read',            // View people in workspace
      'im:read',              // View basic information about direct messages
      'im:write',             // Start direct messages
      'im:history',           // View messages in direct messages
      'groups:read',          // View basic information about private channels
      'groups:history',        // View messages in private channels
    ].join(',');
  }

  /**
   * Check if OAuth is configured
   */
  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Generate OAuth authorization URL
   * @param {string} state - State parameter for CSRF protection
   */
  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      user_scope: this.scopes,  // Use user_scope to get user token (xoxp-), not bot token (xoxb-)
      redirect_uri: this.redirectUri,
      state: state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: code,
          redirect_uri: this.redirectUri,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Failed to exchange code for Slack access token');
      }

      // Extract token based on actual response structure
      // Slack OAuth v2 returns:
      // - Bot token: response.data.access_token (always present)
      // - User token: response.data.authed_user.access_token (only if user scopes granted)
      const userToken = response.data.authed_user?.access_token;
      const botToken = response.data.access_token;
      
      // Use user token if available (for sending as user), otherwise use bot token
      const accessToken = userToken || botToken;
      
      if (!accessToken) {
        console.error(`❌ No access token found in Slack OAuth response!`);
        console.error(`   - Full response: ${JSON.stringify(response.data, null, 2)}`);
        throw new Error('No access token in Slack OAuth response');
      }
      
      if (userToken) {
        console.log(`✅ Using USER token (xoxp-*) - messages will be sent as the user`);
      } else {
        console.log(`⚠️  Using BOT token (xoxb-*) - messages will be sent as a bot`);
        console.log(`   - To send as user, ensure User Token Scopes are configured in Slack app`);
        console.log(`   - Bot token requires bot to be added to channels before sending messages`);
      }
      
      const tokenData = {
        accessToken: accessToken,
        refreshToken: response.data.refresh_token || null, // Slack doesn't always provide refresh tokens
        teamId: response.data.team?.id,
        teamName: response.data.team?.name,
        userId: response.data.authed_user?.id,
        expiresIn: null, // Slack tokens don't expire by default
      };
      
      return tokenData;
    } catch (error) {
      console.error('Slack token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange code for Slack access token');
    }
  }

  /**
   * Validate access token
   * @param {string} accessToken - Access token to validate
   */
  async validateToken(accessToken) {
    try {
      const response = await axios.post(
        'https://slack.com/api/auth.test',
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data.ok) {
        throw new Error('Invalid or expired Slack access token');
      }

      return response.data;
    } catch (error) {
      throw new Error('Invalid or expired Slack access token');
    }
  }
}

module.exports = SlackOAuth;

