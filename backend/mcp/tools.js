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
 * Generate a generic system prompt for MCP integrations
 * @param {Array} integrations - List of connected integrations
 * @param {number} toolCount - Total number of available tools
 * @returns {string} - System prompt
 */
function generateSystemPrompt(integrations = [], toolCount = 0) {
  if (integrations.length === 0) {
    return 'You are a helpful AI assistant.';
  }

  const integrationNames = integrations.map(i => i.name).join(', ');

  return `You are a helpful AI assistant with access to external integrations through MCP (Model Context Protocol).

CONNECTED INTEGRATIONS: ${integrationNames}

You have ${toolCount} tool${toolCount !== 1 ? 's' : ''} available to fetch real-time data and perform actions.

IMPORTANT GUIDELINES:
- You are ALREADY AUTHENTICATED with all connected integrations
- ALWAYS use the available tools to fetch real, live data when users ask questions
- DO NOT ask users for authentication tokens or credentials
- DO NOT make up or guess data - ALWAYS call the appropriate tool first
- Be proactive in using tools to provide accurate, up-to-date information

When users ask questions related to your connected integrations, immediately use the relevant tools to fetch the information they need.`;
}

module.exports = {
  convertMCPToolsToOpenAI,
  generateSystemPrompt,
};

