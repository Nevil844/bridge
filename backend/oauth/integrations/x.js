const axios = require('axios');
const crypto = require('crypto');

/**
 * X (Twitter) OAuth Integration
 * Handles OAuth 2.0 Authorization Code with PKCE flow for X API
 * https://developer.x.com/en/docs/authentication/oauth-2-0
 */
class XOAuth {
  constructor() {
    this.name = 'X';
    this.type = 'x';
    this.clientId = process.env.X_CLIENT_ID;
    this.clientSecret = process.env.X_CLIENT_SECRET;
    this.redirectUri = process.env.X_REDIRECT_URI || process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000/api/oauth/callback';
    
    // X API OAuth 2.0 scopes
    // https://developer.x.com/en/docs/authentication/guides/v2-authentication-mapping
    this.scopes = [
      'tweet.read',
      'tweet.write',
      'users.read',
      'offline.access', // For refresh tokens
    ].join(' ');
  }

  /**
   * Generate code verifier and code challenge for PKCE
   * @returns {Object} - { codeVerifier, codeChallenge }
   */
  generatePKCE() {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate OAuth authorization URL with PKCE
   * @param {string} state - State parameter for CSRF protection
   * @returns {Object} - Object with url and codeVerifier for PKCE
   */
  getAuthUrl(state) {
    const { codeVerifier, codeChallenge } = this.generatePKCE();
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    // Return both URL and code verifier (handler will store codeVerifier with state)
    return {
      url: `https://twitter.com/i/oauth2/authorize?${params.toString()}`,
      codeVerifier: codeVerifier,
    };
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   * @param {string} codeVerifier - PKCE code verifier
   * @returns {Promise<Object>} - Token data with accessToken, refreshToken, etc.
   */
  async exchangeCodeForToken(code, codeVerifier) {
    try {
      // Encode client credentials for Basic Auth
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post(
        'https://api.twitter.com/2/oauth2/token',
        new URLSearchParams({
          code: code,
          grant_type: 'authorization_code',
          client_id: this.clientId,
          redirect_uri: this.redirectUri,
          code_verifier: codeVerifier,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
          },
        }
      );

      if (!response.data.access_token) {
        throw new Error('No access token received from X API');
      }

      // Log successful token exchange
      console.log('✅ X OAuth token exchange successful');

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || null,
        expiresIn: response.data.expires_in || 7200, // Default 2 hours
        tokenType: response.data.token_type || 'bearer',
        scope: response.data.scope || null,
      };
    } catch (error) {
      console.error('X OAuth token exchange error:', error.response?.data || error.message);
      throw new Error(`Failed to exchange X OAuth code: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} - New token data
   */
  async refreshAccessToken(refreshToken) {
    try {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post(
        'https://api.twitter.com/2/oauth2/token',
        new URLSearchParams({
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          client_id: this.clientId,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
          },
        }
      );

      if (!response.data.access_token) {
        throw new Error('No access token received from X API refresh');
      }

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || refreshToken,
        expiresIn: response.data.expires_in || 7200,
        tokenType: response.data.token_type || 'bearer',
      };
    } catch (error) {
      console.error('X token refresh error:', error.response?.data || error.message);
      
      // Provide helpful error messages for common cases
      if (error.response?.status === 400) {
        const errorData = error.response.data;
        if (errorData.error === 'invalid_request' || errorData.error === 'invalid_grant') {
          throw new Error('Invalid refresh token. The token may have expired or been revoked. Please re-authenticate.');
        }
        if (errorData.error === 'invalid_client') {
          throw new Error('Invalid client credentials. Please check your X_CLIENT_ID and X_CLIENT_SECRET in .env');
        }
      }
      
      throw new Error(`Failed to refresh X access token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Validate access token
   * @param {string} accessToken - Access token to validate
   * @returns {Promise<Object>} - User data if token is valid
   */
  async validateToken(accessToken) {
    try {
      const response = await axios.get(
        'https://api.twitter.com/2/users/me',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          params: {
            'user.fields': 'id,name,username,description,profile_image_url',
          },
        }
      );

      return response.data.data;
    } catch (error) {
      // Enhanced error logging
      if (error.response) {
        const errorData = error.response.data;
        console.error('❌ X token validation error:', {
          status: error.response.status,
          error: errorData?.error,
          detail: errorData?.detail,
          title: errorData?.title,
        });
        
        // Check if it's the Application-Only error
        if (errorData?.detail?.includes('Application-Only')) {
          throw new Error('Token appears to be Application-Only instead of User Context. Please reconnect your X account.');
        }
      }
      throw new Error('Invalid or expired X access token');
    }
  }

  /**
   * Check if OAuth is configured
   * @returns {boolean} - True if OAuth is properly configured
   */
  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }
}

module.exports = XOAuth;

