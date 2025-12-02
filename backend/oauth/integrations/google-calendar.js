const axios = require('axios');

/**
 * Google Calendar OAuth Integration
 * Handles OAuth 2.0 flow for Google Calendar API
 */
class GoogleCalendarOAuth {
  constructor() {
    this.clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    this.redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI || process.env.GOOGLE_DRIVE_REDIRECT_URI || 'http://localhost:3000/api/oauth/callback';
    this.name = 'Google Calendar';
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
      'https://www.googleapis.com/auth/calendar.readonly',  // Read access to calendars
      'https://www.googleapis.com/auth/calendar.events',    // Create, update, delete events
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
      // Don't log response data as it might contain sensitive info
      console.error('Google Calendar token exchange error:', error.message);
      throw new Error('Failed to exchange code for Google Calendar access token');
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
      // Don't log response data as it might contain sensitive info
      console.error('Google Calendar token refresh error:', error.message);
      throw new Error('Failed to refresh Google Calendar access token');
    }
  }
}

module.exports = GoogleCalendarOAuth;

