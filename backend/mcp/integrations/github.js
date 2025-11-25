const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

/**
 * GitHub MCP Integration
 * Connects to the GitHub MCP server using the user's personal access token
 */
class GitHubIntegration {
  constructor() {
    this.name = 'GitHub';
    this.type = 'github';
    this.description = 'Access GitHub repositories, issues, pull requests, and more';
    this.icon = 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
  }

  /**
   * Connect to GitHub MCP server
   * @param {Object} config - Integration configuration
   * @param {string} config.token - GitHub Personal Access Token
   * @returns {Promise<Object>} - MCP client and server process
   */
  async connect(config) {
    if (!config || !config.token) {
      throw new Error('GitHub token is required');
    }

    try {
      const transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          ...process.env,
          GITHUB_PERSONAL_ACCESS_TOKEN: config.token,
        },
      });

      const client = new Client(
        {
          name: 'bridge-ai-github',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      await client.connect(transport);
      return { client, transport };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Disconnect from GitHub MCP server
   * @param {Object} connection - Connection object with client and transport
   */
  async disconnect(connection) {
    if (connection && connection.client) {
      try {
        await connection.client.close();
      } catch (error) {
        console.error('Error disconnecting GitHub:', error.message);
      }
    }
  }

  /**
   * Get available tools from GitHub MCP
   * @param {Object} connection - Connection object with client
   * @returns {Promise<Array>} - List of available tools
   */
  async getTools(connection) {
    if (!connection || !connection.client) {
      return [];
    }

    try {
      const response = await connection.client.listTools();
      return response.tools || [];
    } catch (error) {
      console.error('❌ Error getting GitHub tools:', error.message);
      return [];
    }
  }

  /**
   * Call a tool on the GitHub MCP server
   * @param {Object} connection - Connection object with client
   * @param {string} toolName - Name of the tool to call
   * @param {Object} args - Tool arguments
   * @returns {Promise<any>} - Tool result
   */
  async callTool(connection, toolName, args) {
    if (!connection || !connection.client) {
      throw new Error('Not connected to GitHub MCP');
    }

    try {
      const result = await connection.client.callTool({ name: toolName, arguments: args });
      return result;
    } catch (error) {
      console.error(`❌ Error calling GitHub tool ${toolName}:`, error.message);
      throw error;
    }
  }
}

module.exports = GitHubIntegration;

