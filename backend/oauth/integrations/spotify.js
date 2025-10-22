const axios = require('axios');

/**
 * Spotify OAuth Integration
 * Handles OAuth 2.0 flow for Spotify API
 * https://developer.spotify.com/documentation/web-api/tutorials/code-flow
 */
class SpotifyOAuth {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/api/oauth/callback';
    this.name = 'Spotify';
    
    // Spotify scopes for comprehensive access
    this.scopes = [
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
      'playlist-read-private',
      'playlist-read-collaborative',
      'playlist-modify-public',
      'playlist-modify-private',
      'user-library-read',
      'user-library-modify',
      'user-read-recently-played',
      'user-top-read',
    ].join(' ');
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
      response_type: 'code',
      redirect_uri: this.redirectUri,
      state: state,
      scope: this.scopes,
      show_dialog: 'false', // Don't show dialog if already authorized
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(this.clientId + ':' + this.clientSecret).toString('base64'),
          },
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in, // Usually 3600 (1 hour)
      };
    } catch (error) {
      // Don't log response data as it might contain sensitive info
      console.error('Spotify token exchange error:', error.message);
      throw new Error('Failed to exchange code for Spotify access token');
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(this.clientId + ':' + this.clientSecret).toString('base64'),
          },
        }
      );

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      // Don't log response data as it might contain sensitive info
      console.error('Spotify token refresh error:', error.message);
      throw new Error('Failed to refresh Spotify access token');
    }
  }

  /**
   * Validate access token
   * @param {string} accessToken - Access token to validate
   */
  async validateToken(accessToken) {
    try {
      const response = await axios.get('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      return response.data;
    } catch (error) {
      throw new Error('Invalid or expired Spotify access token');
    }
  }
}

module.exports = SpotifyOAuth;

