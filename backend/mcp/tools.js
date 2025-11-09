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
 * Generate enhanced system prompt with structured response format
 * @param {Array} integrations - List of connected integrations
 * @param {Object} options - Additional options (enableMemory, enableThinking)
 * @returns {string} - System prompt
 */
function generateSystemPrompt(integrations = [], options = {}) {
  const { enableMemory = false, enableThinking = true } = options;
  
  let prompt = '';
  
  if (integrations.length === 0) {
    prompt = 'You are a helpful AI assistant.';
  } else {
  const integrationList = integrations.map(i => i.type).join(', ');
    prompt = `You are a helpful AI assistant with access to: ${integrationList}.

When the user talks about an integration, use list_tools to discover available actions.`;
  }

  if (enableThinking) {
    prompt += `

## Response Format

Use this JSON format for responses:

\`\`\`json
{
  "internal": 0 or 1,
  "thinking": "Your reasoning process",
  "action": "What you did",
  "response": "Your answer to the user",
  "data": {}
}
\`\`\`

## Internal Flag Usage

**Use internal: 0 (HIDDEN) when:**
- You're still thinking or planning
- You're calling tools but don't have results yet
- You're waiting for tool responses

**Use internal: 1 (VISIBLE) ONLY when:**
- You have the ACTUAL DATA the user asked for
- You've verified the tool results
- You can provide a complete answer with real information

**NEVER use internal: 1 with placeholder text.**
**ALWAYS use internal: 1 with actual data from tool results.**

## Guidelines

**When you have all the information needed:**
- Set internal: 1
- Provide a complete answer with ACTUAL DATA from tool results
- Use "thinking" field to explain your reasoning process
- Format the data nicely for the user

**When you need more information:**
- Set internal: 1 (it's a final response, just asking for clarification)
- Ask the user a clarifying question
- Explain what information you need and why

**When using tools:**
- Step 1: Set internal: 0, call the tool, wait for results
- Step 2: Extract ALL data from tool results
- Step 3: Verify the data is what the user asked for
- Step 4: Set internal: 1, provide the ACTUAL DATA in the response field
- Extract ALL information from tool results before responding
- Use information from tool results in subsequent operations - don't ask the user for what you already have
- If tool results contain the information you need, use it immediately

**Data Verification:**
- Always check tool results contain the requested information
- If data is missing or incomplete, either ask for clarification OR try another tool
- Never send empty or placeholder responses with internal: 1

**Conversation continuity:**
- You have access to conversation history, memory, and working memory (tool context)
- Reference previous context when relevant
- Build on earlier interactions naturally
- Check conversation history and working memory BEFORE asking the user for any information
- Use information you've already obtained - don't ask again

The user can see your "thinking" process in an expandable section, so use it to show your reasoning transparently.`;
  }

  if (enableMemory) {
    prompt += `

## Memory Context

Relevant context from past conversations has been included above.
Use this to provide personalized, context-aware responses.
Reference previous interactions when relevant.`;
  }

  return prompt;
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
- User is authenticated via OAuth - you have access to their account
- When user says "my repo", "my commits", "my issues" - they mean items they own
- Use information from tool results in subsequent operations
- Check conversation history and working memory before asking for information`,

    gmail: `GMAIL USAGE:
- User is authenticated via OAuth
- You can read, search, send emails, and manage labels
- Use list_emails to see recent emails, search_emails for specific queries`,

    'google-drive': `GOOGLE DRIVE USAGE:
- User is authenticated via OAuth
- You can list files, read content, and search
- Use list_files to browse, get_file to read content`,

    spotify: `SPOTIFY USAGE:
- User is authenticated via OAuth with Spotify Premium
- Control playback, manage playlists, search music, get currently playing

- PLAYBACK COMMANDS:
  When user says "play <song>" or "play <song> by <artist>":
  ALWAYS use SpotifySearchAndPlay with { query: '<song> <artist>' }
  
  This is the ONLY tool you should use for playing songs.
  It will automatically search and play the song in one step.`,

    zomato: `ZOMATO USAGE:
- User is authenticated via OAuth (handled internally by mcp-remote)
- Search restaurants, browse menus, manage cart, and place orders
- Use get_restaurants_for_keyword to search restaurants by food item or location
- Use menu tools to browse restaurant menus
- Use add_to_cart to add items to cart
- Use place_order only when user explicitly requests to place an order
- Check conversation history for restaurant IDs when adding items to cart

The MCP server maintains its own OAuth session via mcp-remote`,
  };

  return instructions[integrationType] || `${integrationType.toUpperCase()} USAGE:\n- User is authenticated and ready to use`;
}

module.exports = {
  convertMCPToolsToOpenAI,
  generateSystemPrompt,
  getIntegrationInstructions,
};
