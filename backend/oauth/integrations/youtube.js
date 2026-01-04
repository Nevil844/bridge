const axios = require('axios');

/**
 * YouTube OAuth Integration
 * Handles OAuth 2.0 flow for YouTube Data API v3
 * https://developers.google.com/youtube/v3/guides/auth
 */
class YouTubeOAuth {
  constructor() {
    // Reuse Google OAuth credentials (same as Gmail/Drive)
    this.clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    this.redirectUri = process.env.YOUTUBE_REDIRECT_URI || process.env.GMAIL_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/oauth/callback';
    this.name = 'YouTube';
    
    // YouTube scopes - only readonly needed for all current tools
    // All 13 tools are read-only operations:
    // - Search videos/channels (public data)
    // - Get video info/metadata (public data)
    // - List/download subtitles (readonly)
    // - List playlists/subscriptions (readonly with mine: true)
    // - Get channel info/videos (readonly)
    this.scopes = 'https://www.googleapis.com/auth/youtube.readonly';
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
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes,
      access_type: 'offline', // Get refresh token
      prompt: 'consent', // Force consent screen to get refresh token
      state: state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (!response.data.access_token) {
        throw new Error('No access token in YouTube OAuth response');
      }

      // Get user info to store with token
      let userInfo = null;
      try {
        const userResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
          headers: {
            'Authorization': `Bearer ${response.data.access_token}`,
          },
        });
        if (userResponse.data.items && userResponse.data.items.length > 0) {
          userInfo = userResponse.data.items[0].snippet;
        }
      } catch (error) {
        console.error('Failed to fetch YouTube user info:', error.message);
      }

      const tokenData = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || null,
        userId: userInfo?.channelId || null,
        username: userInfo?.title || null,
        expiresIn: response.data.expires_in || null,
      };
      
      return tokenData;
    } catch (error) {
      console.error('YouTube token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange code for YouTube access token');
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const response = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      console.error('YouTube token refresh error:', error.response?.data || error.message);
      throw new Error('Failed to refresh YouTube access token');
    }
  }

  /**
   * Validate access token
   * @param {string} accessToken - Access token to validate
   */
  async validateToken(accessToken) {
    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      throw new Error('Invalid or expired YouTube access token');
    }
  }
}

module.exports = YouTubeOAuth;

