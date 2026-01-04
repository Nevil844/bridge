const { v4: uuidv4 } = require('uuid');
const oauthIntegrations = require('./integrations/index.js');

// Store pending OAuth states (in production, use Redis or database)
const pendingOAuthStates = new Map();

/**
 * Generic OAuth Handler
 * Manages OAuth flows for all integrations
 */
class OAuthHandler {
  /**
   * Generate OAuth authorization URL for any integration
   * @param {string} integrationType - Type of integration (e.g., 'github', 'slack')
   * @param {string} userId - User ID initiating the OAuth flow
   * @returns {Promise<string>} - Authorization URL
   */
  getAuthUrl(integrationType, userId) {
    const IntegrationClass = oauthIntegrations[integrationType];
    
    if (!IntegrationClass) {
      throw new Error(`Unknown OAuth integration: ${integrationType}`);
    }

    const integration = new IntegrationClass();
    
    if (!integration.isConfigured()) {
      throw new Error(`${integration.name} OAuth is not configured. Check your environment variables.`);
    }

    // Generate unique state for CSRF protection
    const state = uuidv4();
    
    // Get auth URL (may return object with url and codeVerifier for PKCE)
    const authResult = integration.getAuthUrl(state);
    
    // Handle PKCE (X/Twitter uses PKCE)
    let authUrl;
    let codeVerifier = null;
    
    if (typeof authResult === 'object' && authResult.url) {
      authUrl = authResult.url;
      codeVerifier = authResult.codeVerifier || null;
    } else {
      authUrl = authResult;
    }
    
    // Store state with userId and integration type for callback
    pendingOAuthStates.set(state, {
      userId,
      integrationType,
      codeVerifier, // Store PKCE code verifier if present
      timestamp: Date.now(),
    });

    // Clean up old states (older than 10 minutes)
    this.cleanupOldStates();

    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} integrationType - Type of integration
   * @param {string} code - Authorization code from OAuth callback
   * @param {string} state - State parameter (used to retrieve PKCE code verifier)
   * @returns {Promise<string>} - Access token
   */
  async exchangeCodeForToken(integrationType, code, state = null) {
    const IntegrationClass = oauthIntegrations[integrationType];
    
    if (!IntegrationClass) {
      throw new Error(`Unknown OAuth integration: ${integrationType}`);
    }

    const integration = new IntegrationClass();
    
    // Get code verifier from state if available (for PKCE)
    let codeVerifier = null;
    if (state) {
      const stateData = pendingOAuthStates.get(state);
      if (stateData && stateData.codeVerifier) {
        codeVerifier = stateData.codeVerifier;
      }
    }
    
    // Integrations that use PKCE (OAuth 2.0 with PKCE)
    const pkceIntegrations = ['x'];
    
    // If this integration uses PKCE and we have a code verifier, pass it
    if (codeVerifier && pkceIntegrations.includes(integrationType)) {
      return await integration.exchangeCodeForToken(code, codeVerifier);
    }
    
    // Otherwise, call without code verifier
    return await integration.exchangeCodeForToken(code);
  }

  /**
   * Verify state parameter and get associated data
   * @param {string} state - State parameter from OAuth callback
   * @returns {Object|null} - Object with userId, integrationType, and codeVerifier (if PKCE), or null if invalid
   */
  verifyState(state) {
    const data = pendingOAuthStates.get(state);
    if (data) {
      // Don't delete yet - we need codeVerifier for token exchange
      return {
        userId: data.userId,
        integrationType: data.integrationType,
        codeVerifier: data.codeVerifier || null,
      };
    }
    return null;
  }
  
  /**
   * Delete state after token exchange (cleanup)
   * @param {string} state - State parameter
   */
  deleteState(state) {
    pendingOAuthStates.delete(state);
  }

  /**
   * Clean up states older than 10 minutes
   */
  cleanupOldStates() {
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    for (const [state, data] of pendingOAuthStates.entries()) {
      if (data.timestamp < tenMinutesAgo) {
        pendingOAuthStates.delete(state);
      }
    }
  }

  /**
   * Check if an integration is configured
   * @param {string} integrationType - Type of integration
   * @returns {boolean} - True if configured
   */
  isConfigured(integrationType) {
    const IntegrationClass = oauthIntegrations[integrationType];
    if (!IntegrationClass) return false;
    
    const integration = new IntegrationClass();
    return integration.isConfigured();
  }
}

// Create singleton instance
const oauthHandler = new OAuthHandler();

module.exports = oauthHandler;

