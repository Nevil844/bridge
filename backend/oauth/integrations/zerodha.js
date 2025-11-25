const axios = require('axios');

/**
 * Zerodha/Kite OAuth Integration
 * Handles OAuth 2.0 flow for Kite Connect API
 * https://kite.trade/docs/connect/v3/user/
 */
class ZerodhaOAuth {
  constructor() {
    this.apiKey = process.env.ZERODHA_API_KEY;
    this.apiSecret = process.env.ZERODHA_API_SECRET;
    this.redirectUri = process.env.ZERODHA_REDIRECT_URI || 'http://localhost:3000/api/oauth/callback';
    this.name = 'Zerodha';
  }

  /**
   * Check if OAuth is configured
   */
  isConfigured() {
    return !!(this.apiKey && this.apiSecret);
  }

  /**
   * Generate OAuth authorization URL
   * @param {string} state - State parameter (we'll also encode this in redirect_uri since Zerodha doesn't return it)
   */
  getAuthUrl(state) {
    // Zerodha doesn't reliably return the state parameter
    // So we encode it in the redirect_uri query string instead
    const redirectUriWithState = `${this.redirectUri}?state=${state}&integration=zerodha`;
    
    const params = new URLSearchParams({
      api_key: this.apiKey,
      redirect_url: redirectUriWithState,
    });

    return `https://kite.zerodha.com/connect/login?${params.toString()}`;
  }

  /**
   * Exchange request token for access token
   * After user authorizes, Zerodha redirects with request_token
   */
  async exchangeCodeForToken(requestToken) {
    try {
      const crypto = require('crypto');
      
      // Generate checksum: api_key + request_token + api_secret
      const checksum = crypto
        .createHash('sha256')
        .update(this.apiKey + requestToken + this.apiSecret)
        .digest('hex');

      const response = await axios.post(
        'https://api.kite.trade/session/token',
        new URLSearchParams({
          api_key: this.apiKey,
          request_token: requestToken,
          checksum: checksum,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Kite-Version': '3',
          },
        }
      );

      // Zerodha returns: { data: { access_token, user_id, ... } }
      return {
        accessToken: response.data.data.access_token,
        userId: response.data.data.user_id,
        userName: response.data.data.user_name,
        email: response.data.data.email,
        expiresIn: 86400, // Zerodha tokens expire in 24 hours
      };
    } catch (error) {
      // Don't log response data as it might contain sensitive info
      console.error('Zerodha token exchange error:', error.message);
      throw new Error('Failed to exchange code for Zerodha access token');
    }
  }

  /**
   * Refresh access token
   * Note: Zerodha tokens don't have refresh tokens - users must re-authenticate daily
   */
  async refreshAccessToken(refreshToken) {
    throw new Error('Zerodha access tokens cannot be refreshed. Users must re-authenticate.');
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken) {
    try {
      const response = await axios.get('https://api.kite.trade/user/profile', {
        headers: {
          'Authorization': `token ${this.apiKey}:${accessToken}`,
          'X-Kite-Version': '3',
        },
      });
      
      return response.data.data;
    } catch (error) {
      throw new Error('Invalid or expired Zerodha access token');
    }
  }
}

module.exports = ZerodhaOAuth;

