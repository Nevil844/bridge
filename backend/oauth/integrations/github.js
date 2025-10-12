const axios = require('axios');

/**
 * GitHub OAuth Integration
 * Handles OAuth 2.0 flow for GitHub
 */
class GitHubOAuth {
  constructor() {
    this.name = 'GitHub';
    this.type = 'github';
    this.clientId = process.env.GITHUB_CLIENT_ID;
    this.clientSecret = process.env.GITHUB_CLIENT_SECRET;
    this.callbackUrl = process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000/api/oauth/callback';
  }

  /**
   * Generate OAuth authorization URL
   * @param {string} state - State parameter for CSRF protection
   * @returns {string} - Authorization URL
   */
  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      scope: 'repo read:org',
      state: state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Promise<string>} - Access token
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: code,
        },
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!response.data.access_token) {
        throw new Error('No access token received');
      }

      return response.data.access_token;
    } catch (error) {
      console.error('GitHub OAuth error:', error.response?.data || error.message);
      throw new Error('Failed to exchange GitHub OAuth code');
    }
  }

  /**
   * Validate configuration
   * @returns {boolean} - True if OAuth is properly configured
   */
  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }
}

module.exports = GitHubOAuth;

