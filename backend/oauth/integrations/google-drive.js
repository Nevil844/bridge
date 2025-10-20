const axios = require('axios');

/**
 * Google Drive OAuth Integration
 * Handles OAuth 2.0 flow for Google Drive API
 */
class GoogleDriveOAuth {
  constructor() {
    this.clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    this.redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || 'http://localhost:3000/api/oauth/callback';
    this.name = 'Google Drive';
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
      'https://www.googleapis.com/auth/drive.readonly',  // Read access
      'https://www.googleapis.com/auth/drive.metadata.readonly', // Metadata access
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
      console.error('Google Drive token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange code for Google Drive access token');
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
      console.error('Google Drive token refresh error:', error.response?.data || error.message);
      throw new Error('Failed to refresh Google Drive access token');
    }
  }
}

module.exports = GoogleDriveOAuth;

