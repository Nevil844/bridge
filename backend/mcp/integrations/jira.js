const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const axios = require('axios');
const oauthHandler = require('../../oauth/handler');

/**
 * JIRA MCP Integration
 * Uses Atlassian's Remote MCP Server via mcp-remote.
 * When OAuth is required, surfaces the authorization URL back to the chatbot
 * so the user can click it and complete login.
 * Docs: https://www.atlassian.com/blog/announcements/remote-mcp-server
 */
class JiraIntegration {
  constructor() {
    this.name = 'Jira';
    this.type = 'jira';
    this.description = 'Create and manage issues, projects, workflows, and more';
    this.icon = 'https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon-32x32.png';
    this.serverUrl = process.env.ATLASSIAN_MCP_SERVER_URL || 'https://mcp.atlassian.com/v1/sse';
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
   * Prepare connection metadata (lazy connection via mcp-remote)
   */
  async connect(config) {
    return {
      client: null,
      transport: null,
      serverUrl: config?.serverUrl || this.serverUrl,
      config,
      userId: config?.userId || 'default-user',
      oauthCompleted: !!config?.token,
      pendingAuthUrl: null,
      _connecting: false,
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
    const client = await this.ensureConnection(connection, { forTools: true });
    if (!client) {
      // OAuth needed – return authenticate tool
      return this.getOAuthToolList(connection);
    }

    try {
      const response = await client.listTools();
      const tools = response.tools || [];
      console.log(`✅ JIRA: Got ${tools.length} tools from MCP server`);
      return tools;
    } catch (error) {
      if (error.message && error.message.includes('OAuth_AUTHENTICATION_REQUIRED')) {
        return this.getOAuthToolList(connection);
      }
      console.error('❌ Error getting JIRA tools:', error.message);
      throw error;
    }
  }

  /**
   * Call a tool on the JIRA MCP server
   */
  async callTool(connection, toolName, args) {
    if (toolName === 'jira_authenticate') {
      return this.buildOAuthResponse(connection);
    }

    const client = await this.ensureConnection(connection);
    if (!client) {
      return this.buildOAuthResponse(connection);
    }

    try {
      console.log(`🔧 JIRA callTool: ${toolName}`, JSON.stringify(args, null, 2).substring(0, 500));
      const result = await client.callTool({ name: toolName, arguments: args });
      if (result.isError) {
        const errorText = result.content?.[0]?.text || JSON.stringify(result.content);
        console.log(`   ❌ JIRA tool ${toolName} error:`, errorText.substring(0, 300));
      } else {
        console.log(`   ✅ JIRA tool ${toolName} success`);
      }
      return result;
    } catch (error) {
      if (error.message && error.message.includes('OAuth_AUTHENTICATION_REQUIRED')) {
        return this.buildOAuthResponse(connection);
      }
      console.error(`❌ Error calling JIRA tool ${toolName}:`, error.message);
      throw error;
    }
  }

  /**
   * Ensure remote connection (via mcp-remote). Returns client or null if OAuth needed.
   */
  async ensureConnection(connection, { forTools = false } = {}) {
    if (!connection) {
      throw new Error('JIRA connection not initialized');
    }

    if (connection.client) {
      return connection.client;
    }

    if (connection._connecting) {
      let waitCount = 0;
      while (connection._connecting && waitCount < 60) {
        await new Promise(resolve => setTimeout(resolve, 500));
        waitCount++;
        if (connection.client) {
          return connection.client;
        }
      }
      if (connection._connecting) {
        console.warn('JIRA connection attempt timed out');
        return null;
      }
    }

    try {
      await this.connectRemote(connection);
      return connection.client;
    } catch (error) {
      if (error.message && error.message.includes('OAuth_AUTHENTICATION_REQUIRED')) {
        console.log('⚠️  JIRA: OAuth authentication required');
        return null;
      }
      if (forTools) {
        return null;
      }
      throw error;
    }
  }

  async connectRemote(connection) {
    connection._connecting = true;
    connection.pendingAuthUrl = null;

    const serverUrl = connection.serverUrl || this.serverUrl;
    console.log(`🔌 Establishing JIRA MCP connection via Atlassian Remote MCP Server...`);

    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', 'mcp-remote', serverUrl],
      env: {
        ...process.env,
        BROWSER: 'none', // Prevent launching browser on the server
        NO_BROWSER: '1',
      },
    });

    const client = new Client(
      {
        name: 'bridge-ai-jira-remote',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    const authListener = chunk => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/mcp\.atlassian\.com\/[^\s]+/);
      if (match) {
        connection.pendingAuthUrl = match[0];
      }
    };

    transport.process?.stderr?.on('data', authListener);

    try {
      await Promise.race([
        client.connect(transport),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout - OAuth may be required')), 30000)
        ),
      ]);

      console.log(`✅ JIRA MCP connected successfully via Atlassian Remote MCP Server`);
      connection.client = client;
      connection.transport = transport;
      connection._connecting = false;
      connection.pendingAuthUrl = null;
    } catch (error) {
      connection._connecting = false;
      transport.process?.stderr?.off('data', authListener);
      try {
        await transport.close();
      } catch (e) {
        // Ignore
      }

      if (
        connection.pendingAuthUrl ||
        error.message.includes('OAuth') ||
        error.message.includes('authorize') ||
        error.message.includes('Authentication required')
      ) {
        const url =
          connection.pendingAuthUrl ||
          (connection.userId ? oauthHandler.getAuthUrl('jira', connection.userId) : null) ||
          'https://mcp.atlassian.com/v1/authorize';
        connection.pendingAuthUrl = url;
        throw new Error(`OAuth_AUTHENTICATION_REQUIRED: ${url}`);
      }

      throw error;
    } finally {
      transport.process?.stderr?.off('data', authListener);
    }
  }

  getOAuthToolList(connection) {
    return [
      {
        name: 'jira_authenticate',
        description: 'Complete Jira authentication so tools can be used.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  buildOAuthResponse(connection) {
    const url =
      connection?.pendingAuthUrl ||
      (connection?.userId ? oauthHandler.getAuthUrl('jira', connection.userId) : null) ||
      'https://mcp.atlassian.com/v1/authorize';

    return {
      isError: false,
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            message: 'Please authorize Jira by opening the link below, completing login, then retry your request.',
            oauthUrl: url,
          }),
        },
      ],
    };
  }
}

module.exports = JiraIntegration;
