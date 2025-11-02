/**
 * Zomato MCP OAuth Integration
 * Simple implementation - MCP server handles OAuth internally
 */
class ZomatoOAuth {
  constructor() {
    this.name = 'Zomato';
    this.type = 'zomato';
    this.description = 'OAuth handled internally by MCP server';
    this.mcpServerUrl = 'https://mcp-server.zomato.com/mcp';
  }

  /**
   * Generate OAuth authorization URL
   * @param {string} state - State parameter for CSRF protection
   * @returns {string} - Authorization URL
   */
  getAuthUrl(state) {
    // For Zomato, return the actual OAuth URL so user can authenticate
    // The MCP server will handle the OAuth flow
    return `https://mcp-server.zomato.com/authorize?response_type=code&client_id=5276d7f1-910b-4243-92ea-d27e758ad02b&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Foauth%2Fcallback&state=${state}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code
   * @returns {Promise<string>} - Placeholder token
   */
  async exchangeCodeForToken(code) {
    return 'mcp-server-handled';
  }

  /**
   * Validate configuration
   * @returns {boolean} - Always true
   */
  isConfigured() {
    return true;
  }
}

module.exports = ZomatoOAuth;
