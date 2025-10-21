const axios = require('axios');

/**
 * Gmail OAuth Integration
 * Handles OAuth 2.0 flow for Gmail API
 */
class GmailOAuth {
  constructor() {
    this.clientId = process.env.GMAIL_CLIENT_ID;
    this.clientSecret = process.env.GMAIL_CLIENT_SECRET;
    this.redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/oauth/callback';
    this.name = 'Gmail';
  }

  /**
   * Check if OAuth is configured
   */
  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(state) {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',  // Read access to Gmail
      'https://www.googleapis.com/auth/gmail.send',      // Send emails
      'https://www.googleapis.com/auth/gmail.labels',    // Manage labels
      'https://www.googleapis.com/auth/gmail.modify',    // Modify emails (archive, trash, etc.)
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline', // Get refresh token
      prompt: 'consent', // Force consent screen to get refresh token
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      // Return both access token and refresh token
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      console.error('Gmail token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange code for Gmail access token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      console.error('Gmail token refresh error:', error.response?.data || error.message);
      throw new Error('Failed to refresh Gmail access token');
    }
  }
}

module.exports = GmailOAuth;

