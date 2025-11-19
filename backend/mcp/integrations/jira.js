const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const axios = require('axios');

/**
 * JIRA MCP Integration
 * Uses mcp-jira Python MCP server with stored OAuth tokens (no encryption)
 * https://github.com/Warzuponus/mcp-jira
 */
class JiraIntegration {
  constructor() {
    this.name = 'Jira';
    this.type = 'jira';
    this.description = 'Create and manage issues, projects, workflows, and more';
    this.icon = 'https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon-32x32.png';
  }

  /**
   * Get cloud ID and site URL from access token
   */
  async getCloudIdFromToken(accessToken) {
    try {
      const response = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        timeout: 10000,
      });

      if (response.data && response.data.length > 0) {
        const resource = response.data[0];
        return {
          cloudId: resource.id,
          siteUrl: resource.url,
        };
      }
      throw new Error('No accessible Jira resources found');
    } catch (error) {
      throw new Error(`Failed to get cloud ID: ${error.message}`);
    }
  }

  /**
   * Connect to JIRA MCP server
   * Uses mcp-jira Python server with OAuth tokens
   */
  async connect(config) {
    if (!config || !config.token) {
      throw new Error('JIRA access token is required');
    }

    const accessToken = config.token;
    const userId = config.userId || 'default-user';

    // Get cloud ID and site URL from token
    const { cloudId, siteUrl } = await this.getCloudIdFromToken(accessToken);
    console.log(`✅ Got JIRA cloud ID: ${cloudId} for site: ${siteUrl}`);

    // Extract domain from site URL (e.g., https://bridgeai.atlassian.net -> bridgeai.atlassian.net)
    const jiraHost = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

    // Use mcp-jira Python server via uvx (like spotify-mcp)
    // mcp-jira uses JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN
    // For OAuth, we can use the access token as the API token
    const transport = new StdioClientTransport({
      command: 'uvx',
      args: [
        '--python', '3.12',
        '--from', 'git+https://github.com/Warzuponus/mcp-jira',
        'mcp-jira'
      ],
      env: {
        ...process.env,
        JIRA_URL: `https://${jiraHost}`,
        JIRA_USERNAME: 'oauth', // OAuth doesn't need username, but mcp-jira requires it
        JIRA_API_TOKEN: accessToken, // Use stored OAuth token directly
        // Optional: set project key if available
        PROJECT_KEY: config.projectKey || '',
      },
    });

    const client = new Client(
      {
        name: 'bridge-ai-jira',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    try {
      console.log(`🔌 Connecting to JIRA MCP server (mcp-jira)...`);
      await Promise.race([
        client.connect(transport),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 30000)
        )
      ]);
      console.log(`✅ Connected to JIRA MCP server`);
    } catch (error) {
      console.error(`❌ Connection failed: ${error.message}`);
      try {
        await transport.close();
      } catch (e) {
        // Ignore
      }
      throw error;
    }

    return {
      client,
      transport,
      accessToken,
      cloudId: cloudId,
      siteUrl: siteUrl,
      userId: userId,
    };
  }

  /**
   * Disconnect from JIRA MCP server
   */
  async disconnect(connection) {
    if (connection && connection.client) {
      try {
        await connection.client.close();
      } catch (error) {
        console.error('Error disconnecting JIRA:', error.message);
      }
    }
    if (connection && connection.transport) {
      try {
        await connection.transport.close();
      } catch (error) {
        // Ignore
      }
    }
  }

  /**
   * Get available tools from JIRA MCP
   */
  async getTools(connection) {
    if (!connection || !connection.client) {
      return [];
    }

    try {
      const response = await connection.client.listTools();
      const tools = response.tools || [];
      console.log(`✅ JIRA: Got ${tools.length} tools from MCP server`);
      return tools;
    } catch (error) {
      console.error('❌ Error getting JIRA tools:', error.message);
      return [];
    }
  }

  /**
   * Call a tool on the JIRA MCP server
   */
  async callTool(connection, toolName, args) {
    if (!connection || !connection.client) {
      throw new Error('Not connected to JIRA MCP');
    }

    try {
      console.log(`🔧 JIRA callTool: ${toolName}`, JSON.stringify(args, null, 2).substring(0, 500));
      const result = await connection.client.callTool({ 
        name: toolName, 
        arguments: args 
      });
      
      if (result.isError) {
        const errorText = result.content?.[0]?.text || JSON.stringify(result.content);
        console.log(`   ❌ JIRA tool ${toolName} error:`, errorText.substring(0, 300));
      } else {
        console.log(`   ✅ JIRA tool ${toolName} success`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Error calling JIRA tool ${toolName}:`, error.message);
      throw error;
    }
  }
}

module.exports = JiraIntegration;
