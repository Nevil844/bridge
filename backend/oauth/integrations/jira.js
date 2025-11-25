/**
 * JIRA OAuth Integration
 * Handles OAuth 2.0 flow for Atlassian (JIRA/Confluence)
 * Uses Atlassian Remote MCP Server which handles OAuth internally via mcp-remote
 */
class JiraOAuth {
  constructor() {
    this.name = 'Jira';
    this.type = 'jira';
    this.description = 'OAuth handled by Atlassian Remote MCP Server via mcp-remote';
    this.clientId = process.env.ATLASSIAN_CLIENT_ID;
    this.clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;
    this.redirectUri = process.env.ATLASSIAN_REDIRECT_URI || 'http://localhost:3000/api/oauth/callback';
    this.scope = process.env.ATLASSIAN_SCOPE || 'read:jira-work write:jira-work read:jira-user offline_access';
  }

  /**
   * Generate OAuth authorization URL
   * @param {string} state - State parameter for CSRF protection
   * @returns {string} - Authorization URL
   */
  getAuthUrl(state) {
    // If client ID is configured, use standard Atlassian OAuth
    if (this.clientId) {
      console.log('🔐 JIRA OAuth URL generation:', {
        clientId: this.clientId ? `${this.clientId.substring(0, 10)}...` : 'not set',
        redirectUri: this.redirectUri,
        scope: this.scope,
      });

      // IMPORTANT: For Atlassian OAuth 2.0 (3LO), the redirect_uri must be:
      // 1. Exactly as configured in Atlassian Developer Console
      // 2. localhost is allowed but must match exactly
      // 3. Some apps require https even for localhost (use ngrok or similar)
      // 4. The app must be enabled for sharing in Developer Console
      // 5. User must have access to at least one Jira site
      
      const params = new URLSearchParams({
        audience: 'api.atlassian.com',
        client_id: this.clientId,
        scope: this.scope,
        redirect_uri: this.redirectUri, // URLSearchParams will encode it
        state: state,
        response_type: 'code',
        prompt: 'consent',
      });

      const authUrl = `https://auth.atlassian.com/authorize?${params.toString()}`;
      console.log('✅ Generated JIRA OAuth URL:', authUrl.substring(0, 150) + '...');
      console.log('⚠️  IMPORTANT: Make sure this redirect_uri matches EXACTLY in Atlassian Developer Console:');
      console.log('   ', this.redirectUri);
      return authUrl;
    }

    // If no client ID, mcp-remote will handle OAuth internally
    // Return a generic Atlassian auth URL that mcp-remote will use
    // The actual OAuth flow will be handled by mcp-remote when connecting
    console.log('⚠️ No JIRA client ID configured, using mcp-remote fallback');
    return `https://auth.atlassian.com/authorize?audience=api.atlassian.com&state=${state}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code
   * @returns {Promise<string|Object>} - Access token or token object
   */
  async exchangeCodeForToken(code) {
    // If client secret is configured, exchange code for token
    if (this.clientId && this.clientSecret) {
      const axios = require('axios');
      
      console.log('🔄 Exchanging JIRA authorization code for token...');
      console.log('   Redirect URI:', this.redirectUri);
      console.log('   Client ID:', this.clientId ? `${this.clientId.substring(0, 10)}...` : 'not set');
      
      try {
        const response = await axios.post(
          'https://auth.atlassian.com/oauth/token',
          {
            grant_type: 'authorization_code',
            client_id: this.clientId,
            client_secret: this.clientSecret,
            code: code,
            redirect_uri: this.redirectUri, // Must match exactly what was used in getAuthUrl
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('✅ Successfully exchanged JIRA code for token');
        return {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          expiresIn: response.data.expires_in,
        };
      } catch (error) {
        console.error('❌ JIRA token exchange error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });
        
        // Provide more helpful error messages
        if (error.response?.status === 400) {
          const errorData = error.response.data;
          if (errorData.error === 'invalid_grant') {
            throw new Error('Invalid authorization code. The code may have expired or already been used. Please try connecting again.');
          }
          if (errorData.error === 'invalid_client') {
            throw new Error('Invalid client credentials. Please check your ATLASSIAN_CLIENT_ID and ATLASSIAN_CLIENT_SECRET in .env');
          }
          if (errorData.error === 'redirect_uri_mismatch') {
            throw new Error(`Redirect URI mismatch. The redirect URI in your request (${this.redirectUri}) does not match what's configured in your Atlassian app. Please check your Atlassian Developer Console settings.`);
          }
        }
        
        throw new Error(`Failed to exchange code for JIRA access token: ${error.response?.data?.error_description || error.message}`);
      }
    }

    // If no client secret, mcp-remote handles token exchange
    // Return a placeholder - mcp-remote will manage tokens internally
    console.log('⚠️ No JIRA client secret configured, using mcp-remote fallback');
    return 'mcp-remote-handled';
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} - New access token and expiry
   */
  async refreshAccessToken(refreshToken) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('JIRA client ID and secret are required for token refresh');
    }

    const axios = require('axios');
    
    try {
      console.log('🔄 Refreshing JIRA access token...');
      const response = await axios.post(
        'https://auth.atlassian.com/oauth/token',
        {
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Successfully refreshed JIRA access token');
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || refreshToken, // Use new refresh token if provided, otherwise keep old one
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      console.error('❌ JIRA token refresh error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      
      // Provide helpful error messages
      if (error.response?.status === 400) {
        const errorData = error.response.data;
        if (errorData.error === 'invalid_grant') {
          throw new Error('Invalid refresh token. The token may have expired or been revoked. Please re-authenticate.');
        }
        if (errorData.error === 'invalid_client') {
          throw new Error('Invalid client credentials. Please check your ATLASSIAN_CLIENT_ID and ATLASSIAN_CLIENT_SECRET in .env');
        }
      }
      
      throw new Error(`Failed to refresh JIRA access token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Validate configuration
   * @returns {boolean} - True if configured (or using mcp-remote)
   */
  isConfigured() {
    // Check if credentials are set
    const hasCredentials = !!(this.clientId && this.clientSecret);
    
    if (hasCredentials) {
      console.log('✅ JIRA OAuth credentials found');
    } else {
      console.log('⚠️ JIRA OAuth credentials not set - will use mcp-remote fallback');
      console.log('   Set ATLASSIAN_CLIENT_ID and ATLASSIAN_CLIENT_SECRET in .env for custom OAuth');
    }
    
    // Always return true - mcp-remote can handle OAuth even without our credentials
    // If credentials are provided, we use them; otherwise mcp-remote handles it
    return true;
  }
}

module.exports = JiraOAuth;

