/**
 * MCP Tools Utility
 * Converts MCP tool definitions to OpenAI function calling format
 */

/**
 * Convert MCP tools to OpenAI function calling format
 * @param {Array} mcpTools - Array of MCP tool definitions
 * @returns {Array} - Array of OpenAI function definitions
 */
function convertMCPToolsToOpenAI(mcpTools) {
  if (!Array.isArray(mcpTools)) {
    return [];
  }

  return mcpTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema || { type: 'object', properties: {} },
    },
  }));
}

/**
 * Generate minimal system prompt listing available integrations
 * @param {Array} integrations - List of connected integrations
 * @returns {string} - System prompt
 */
function generateSystemPrompt(integrations = []) {
  if (integrations.length === 0) {
    return 'You are a helpful AI assistant.';
  }

  const integrationList = integrations.map(i => i.type).join(', ');

  return `You are a helpful AI assistant with access to: ${integrationList}.

When the user talks about an integration, use list_tools to discover available actions.`;
}

/**
 * Get integration-specific instructions
 * These are added to the context only when tools for that integration are loaded
 * @param {string} integrationType - Integration type (e.g., 'zerodha', 'github')
 * @returns {string} - Integration-specific instructions
 */
function getIntegrationInstructions(integrationType) {
  const instructions = {
    zerodha: `ZERODHA USAGE:
- User is authenticated via OAuth
- If any tool fails with "Please log in first" or "Failed to execute":
  1. Call the login tool (no arguments)
  2. Show the user the warning and authorization link from the response
  3. Tell them to click the link and ask again after authorizing
- Try calling data tools directly first (get_profile, get_holdings, etc.)
- Only call login if a tool fails with a login error`,

    github: `GITHUB USAGE:
- User is authenticated via OAuth
- You have full access to their repositories, issues, and code
- Use search_repositories to find repos, get_file_contents to read files`,

    gmail: `GMAIL USAGE:
- User is authenticated via OAuth
- You can read, search, send emails, and manage labels
- Use list_emails to see recent emails, search_emails for specific queries`,

    'google-drive': `GOOGLE DRIVE USAGE:
- User is authenticated via OAuth
- You can list files, read content, and search
- Use list_files to browse, get_file to read content`,
  };

  return instructions[integrationType] || `${integrationType.toUpperCase()} USAGE:\n- User is authenticated and ready to use`;
}

module.exports = {
  convertMCPToolsToOpenAI,
  generateSystemPrompt,
  getIntegrationInstructions,
};
