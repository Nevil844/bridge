const axios = require('axios');

/**
 * Google OAuth Integration for User Authentication
 * Handles OAuth 2.0 flow for Google Sign-In
 */
class GoogleAuthOAuth {
  constructor() {
    this.clientId = process.env.GOOGLE_AUTH_CLIENT_ID || process.env.GOOGLE_DRIVE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_AUTH_CLIENT_SECRET || process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    this.redirectUri = process.env.GOOGLE_AUTH_REDIRECT_URI || `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/google/callback`;
    this.name = 'Google Sign-In';
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
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
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

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        idToken: response.data.id_token,
      };
    } catch (error) {
      console.error('Google Auth token exchange error:', error.message);
      throw new Error('Failed to exchange code for Google access token');
    }
  }

  /**
   * Get user info from Google using access token
   */
  async getUserInfo(accessToken) {
    try {
      const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return {
        id: response.data.id,
        email: response.data.email,
        name: response.data.name,
        picture: response.data.picture,
        verifiedEmail: response.data.verified_email,
      };
    } catch (error) {
      console.error('Google Auth user info error:', error.message);
      throw new Error('Failed to get user info from Google');
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
      console.error('Google Auth token refresh error:', error.message);
      throw new Error('Failed to refresh Google access token');
    }
  }
}

module.exports = GoogleAuthOAuth;

