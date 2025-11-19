const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const axios = require('axios');
const oauthHandler = require('../../oauth/handler');

const OAUTH_ERROR = 'OAuth_AUTHENTICATION_REQUIRED';

/**
 * Jira MCP Integration
 * Rewritten to follow the hardened patterns we now use for GitHub (explicit token checks),
 * Zerodha (pre-flight verification), and Zomato (lazy mcp-remote connect with OAuth backpressure).
 *
 * References:
 * - Atlassian Remote MCP Server announcement/blog (Nov 2024) – OAuth-in-browser flow
 * - mcp-jira / jira-context-mcp OSS repos – examples of tool surfaces and issue workflows
 */
class JiraIntegration {
  constructor() {
    this.name = 'Jira';
    this.type = 'jira';
    this.description = 'Create and manage Jira projects, issues, boards, and workflows';
    this.icon = 'https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon-32x32.png';

    this.serverUrl = process.env.ATLASSIAN_MCP_SERVER_URL || 'https://mcp.atlassian.com/v1/sse';
    this.remoteCommand = process.env.ATLASSIAN_MCP_COMMAND || 'npx';
    this.remoteArgs = process.env.ATLASSIAN_MCP_ARGS
      ? process.env.ATLASSIAN_MCP_ARGS.split(' ')
      : ['-y', 'mcp-remote'];
  }

  /**
   * Connect builds a lazy connection descriptor – we do NOT spin up the remote process here.
   * @param {Object} config
   */
  async connect(config = {}) {
    if (!config.token) {
      throw new Error('Jira OAuth token missing – reconnect Jira from settings.');
    }

    let verifiedTenant = {};
    try {
      verifiedTenant = await this.getCloudIdFromToken(config.token);
      console.log(
        `✅ Jira token verified for site ${verifiedTenant.siteUrl || 'unknown-site'} (${verifiedTenant.cloudId})`
      );
    } catch (error) {
      console.warn(`⚠️  Jira token verification failed: ${error.message}`);
      // Non-fatal – Atlassian Remote MCP may still complete OAuth. We'll fall back to stored config.
    }

    return {
      client: null,
      transport: null,
      serverUrl: config.serverUrl || this.serverUrl,
      userId: config.userId || 'default-user',
      token: config.token,
      siteUrl: config.siteUrl || verifiedTenant.siteUrl || null,
      cloudId: config.cloudId || verifiedTenant.cloudId || null,
      oauthCompleted: true,
      pendingAuthUrl: null,
      _connecting: false,
      _lastAuthFailure: null,
    };
  }

  /**
   * Lookup accessible Jira tenants for the token – mirrors the REST guidance from Atlassian docs.
   */
  async getCloudIdFromToken(accessToken) {
    const response = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      timeout: 10000,
    });

    if (Array.isArray(response.data) && response.data.length > 0) {
      const resource = response.data[0];
      return {
        cloudId: resource.id,
        siteUrl: resource.url,
      };
    }

    throw new Error('No accessible Jira Cloud sites tied to this token');
  }

  async disconnect(connection) {
    if (!connection) return;

    if (connection.client) {
      try {
        await connection.client.close();
      } catch (error) {
        console.error('Error closing Jira MCP client:', error.message);
      }
    }

    if (connection.transport) {
      try {
        await connection.transport.close();
      } catch {
        // ignore
      }
    }

    connection.client = null;
    connection.transport = null;
    connection._connecting = false;
  }

  async getTools(connection) {
    const client = await this.ensureConnection(connection, { forTools: true });
    if (!client) {
      return this.getOAuthToolList(connection);
    }

    try {
      const response = await client.listTools();
      const tools = response.tools || [];
      console.log(`✅ Jira: ${tools.length} MCP tools discovered`);
      return tools;
    } catch (error) {
      if (this.isOAuthError(error)) {
        return this.getOAuthToolList(connection);
      }
      console.error('❌ Jira getTools failure:', error.message);
      throw error;
    }
  }

  async callTool(connection, toolName, args = {}) {
    if (toolName === 'jira_authenticate') {
      return this.buildOAuthResponse(connection);
    }

    const client = await this.ensureConnection(connection);
    if (!client) {
      return this.buildOAuthResponse(connection);
    }

    try {
      console.log(`🔧 Jira callTool -> ${toolName}`, JSON.stringify(args).substring(0, 400));
      const result = await client.callTool({ name: toolName, arguments: args });

      if (result.isError) {
        const text = result.content?.[0]?.text || '';
        console.error(`   ❌ Jira tool error: ${text.substring(0, 300)}`);

        if (this.isSessionExpired(text) && toolName !== 'jira_authenticate') {
          console.log('   🔄 Session invalid – surfacing OAuth response');
          return this.buildOAuthResponse(connection);
        }
      } else {
        console.log(`   ✅ Jira tool ${toolName} completed`);
      }

      return result;
    } catch (error) {
      console.error(`❌ Jira callTool exception (${toolName}):`, error.message);

      if (this.isOAuthError(error)) {
        return this.buildOAuthResponse(connection);
      }

      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Jira MCP unreachable',
                message: 'The Atlassian remote MCP server is not reachable right now. Please retry shortly.',
              }),
            },
          ],
        };
      }

      throw error;
    }
  }

  async getResources(connection) {
    const client = await this.ensureConnection(connection, { forTools: true });
    if (!client) {
      return [];
    }

    try {
      const response = await client.listResources();
      return response.resources || [];
    } catch (error) {
      console.error('❌ Jira listResources failed:', error.message);
      return [];
    }
  }

  async readResource(connection, resourceUri) {
    const client = await this.ensureConnection(connection);
    if (!client) {
      throw new Error('Jira authentication required before reading resources');
    }

    return client.readResource({ uri: resourceUri });
  }

  async ensureConnection(connection, { forTools = false } = {}) {
    if (!connection) {
      throw new Error('Jira connection not initialized');
    }

    if (connection.client) {
      return connection.client;
    }

    if (connection._connecting) {
      let waitCycles = 0;
      while (connection._connecting && waitCycles < 40) {
        await new Promise(resolve => setTimeout(resolve, 500));
        waitCycles += 1;

        if (connection.client && !connection._connecting) {
          return connection.client;
        }
      }

      if (connection._connecting) {
        console.warn('Jira connection attempt still in progress after 20s, aborting wait.');
        connection._connecting = false;
      }
    }

    try {
      await this.connectRemote(connection);
      return connection.client;
    } catch (error) {
      if (this.isOAuthError(error)) {
        console.log('🔐 Jira OAuth required');
        return null;
      }

      if (forTools) {
        console.warn('⚠️  Jira ensureConnection (for tools) failed:', error.message);
        return null;
      }

      throw error;
    }
  }

  async connectRemote(connection) {
    connection._connecting = true;
    connection.pendingAuthUrl = null;

    const serverUrl = connection.serverUrl || this.serverUrl;
    const env = this.prepareRemoteEnv(connection);

    console.log(`🔌 Connecting to Atlassian remote MCP (${serverUrl})...`);

    const transport = new StdioClientTransport({
      command: this.remoteCommand,
      args: [...this.remoteArgs, serverUrl],
      env,
    });

    const client = new Client(
      {
        name: 'bridge-ai-jira',
        version: '2.0.0',
      },
      {
        capabilities: {},
      }
    );

    let authPromiseReject = null;

    const authLinkListener = chunk => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/mcp\.atlassian\.com\/[^\s]+/);

      if (match) {
        connection.pendingAuthUrl = match[0];
        console.log(`🔐 Jira OAuth link captured: ${connection.pendingAuthUrl}`);
        authPromiseReject?.(new Error(`${OAUTH_ERROR}: ${connection.pendingAuthUrl}`));
      }
    };

    const authPromise = new Promise((_, reject) => {
      authPromiseReject = reject;
    });

    transport.process?.stdout?.on('data', authLinkListener);
    transport.process?.stderr?.on('data', authLinkListener);

    try {
      await Promise.race([
        client.connect(transport),
        authPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout - OAuth may be required')), 15000)
        ),
      ]);

      console.log('✅ Jira MCP connected');
      connection.client = client;
      connection.transport = transport;
      connection._connecting = false;
      connection.pendingAuthUrl = null;
    } catch (error) {
      await this.safeCloseTransport(transport, authLinkListener);
      connection.client = null;
      connection.transport = null;
      connection._connecting = false;

      if (this.isOAuthError(error) || connection.pendingAuthUrl) {
        const url =
          connection.pendingAuthUrl ||
          oauthHandler.getAuthUrl('jira', connection.userId || 'default-user');
        throw new Error(`${OAUTH_ERROR}: ${url}`);
      }

      throw error;
    } finally {
      transport.process?.stdout?.off('data', authLinkListener);
      transport.process?.stderr?.off('data', authLinkListener);
    }
  }

  async safeCloseTransport(transport, listener) {
    transport.process?.stdout?.off('data', listener);
    transport.process?.stderr?.off('data', listener);
    try {
      await transport.close();
    } catch {
      // ignore
    }
  }

  prepareRemoteEnv(connection) {
    return {
      ...process.env,
      ATLASSIAN_ACCESS_TOKEN: connection.token || '',
      ATLASSIAN_CLOUD_ID: connection.cloudId || '',
      ATLASSIAN_SITE_URL: connection.siteUrl || '',
      BROWSER: 'none',
      NO_BROWSER: '1',
    };
  }

  isOAuthError(error) {
    return (
      !error
      ? false
      : error.message?.includes(OAUTH_ERROR) ||
        error.message?.includes('OAuth') ||
        error.message?.includes('authorize') ||
        error.message?.includes('Authentication required')
    );
  }

  isSessionExpired(text = '') {
    return (
      text.includes('Unauthorized') ||
      text.includes('invalid token') ||
      text.includes('expired') ||
      text.includes('OAuth')
    );
  }

  getOAuthToolList() {
    return [
      {
        name: 'jira_authenticate',
        description: 'Complete Jira OAuth to unlock MCP tools.',
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
      oauthHandler.getAuthUrl('jira', connection?.userId || 'default-user');

    return {
      isError: false,
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            message:
              'Authenticate with Jira by opening the link below, completing login, then ask your question again.',
            oauthUrl: url,
          }),
        },
      ],
    };
  }
}

module.exports = JiraIntegration;
