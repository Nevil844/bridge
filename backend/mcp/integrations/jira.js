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
    
    // Validate npx availability on startup (warn but don't fail)
    this.validateNpxAvailability();
  }

  /**
   * Validate that npx is available (for better error messages on EC2)
   */
  validateNpxAvailability() {
    if (this.remoteCommand === 'npx' && !process.env.ATLASSIAN_MCP_COMMAND) {
      try {
        const { execSync } = require('child_process');
        execSync('which npx', { timeout: 2000, stdio: 'ignore' });
      } catch (error) {
        console.warn('⚠️  npx not found in PATH. JIRA MCP may fail to connect.');
        console.warn('   On EC2, ensure Node.js is installed: sudo yum install nodejs npm (Amazon Linux)');
        console.warn('   Or set ATLASSIAN_MCP_COMMAND to the full path of npx');
      }
    }
  }

  /**
   * Connect builds a lazy connection descriptor – we do NOT spin up the remote process here.
   * @param {Object} config
   */
  async connect(config = {}) {
    if (!config.token) {
      throw new Error('Jira OAuth token missing – reconnect Jira from settings.');
    }

    // CRITICAL: Verify token is valid before passing to mcp-remote
    // On EC2, mcp-remote can't do OAuth, so we must have a valid token
    let verifiedTenant = {};
    try {
      verifiedTenant = await this.getCloudIdFromToken(config.token);
      console.log(
        `✅ Jira token verified for site ${verifiedTenant.siteUrl || 'unknown-site'} (${verifiedTenant.cloudId})`
      );
    } catch (error) {
      console.error(`❌ Jira token verification failed: ${error.message}`);
      console.error('   On EC2, mcp-remote cannot do OAuth - token must be valid');
      console.error('   Please reconnect Jira to get a fresh token');
      // On EC2, we should fail here rather than let mcp-remote try OAuth
      if (process.env.NODE_ENV === 'production' || process.env.BACKEND_URL) {
        throw new Error(`Invalid Jira token. On EC2, token must be valid. Please reconnect: ${error.message}`);
      }
      // Non-fatal in development – Atlassian Remote MCP may still complete OAuth locally
      console.warn('   Continuing anyway (development mode) - mcp-remote may attempt OAuth');
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
        console.error('   💡 Network error detected. On EC2, check:');
        console.error('      - Security groups allow outbound HTTPS (port 443)');
        console.error('      - Internet gateway is attached to VPC');
        console.error('      - DNS resolution is working (try: nslookup mcp.atlassian.com)');
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Jira MCP unreachable',
                message: 'The Atlassian remote MCP server is not reachable right now. Please retry shortly. On EC2, check network connectivity and security groups.',
              }),
            },
          ],
        };
      }
      
      // Handle npx/node not found errors
      if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        console.error('   💡 npx/node not found. On EC2, ensure Node.js is installed.');
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Jira MCP setup error',
                message: 'npx is not available. On EC2, ensure Node.js and npm are installed and in PATH. You can also set ATLASSIAN_MCP_COMMAND to the full path of npx.',
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
    console.log(`   Command: ${this.remoteCommand} ${[...this.remoteArgs, serverUrl].join(' ')}`);
    console.log(`   Environment: ATLASSIAN_ACCESS_TOKEN=${connection.token ? '***' : 'missing'}, ATLASSIAN_CLOUD_ID=${connection.cloudId || 'missing'}`);
    
    // Log backend URL for debugging (important for OAuth redirects on EC2)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    console.log(`   Backend URL: ${backendUrl} (used for OAuth redirects)`);

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
      
      // Log mcp-remote output for debugging (especially important on EC2)
      if (text.includes('wait-for-auth') || text.includes('127.0.0.1')) {
        console.warn('⚠️  mcp-remote is trying to do OAuth on localhost (this won\'t work on EC2)');
        console.warn('   Ensure ATLASSIAN_ACCESS_TOKEN is set and valid');
        console.warn('   Output:', text.substring(0, 200));
      }
      
      const match = text.match(/https:\/\/mcp\.atlassian\.com\/[^\s]+/);

      if (match) {
        connection.pendingAuthUrl = match[0];
        console.log(`🔐 Jira OAuth link captured: ${connection.pendingAuthUrl}`);
        console.warn('⚠️  mcp-remote is requesting OAuth - this should not happen if token is valid');
        authPromiseReject?.(new Error(`${OAUTH_ERROR}: ${connection.pendingAuthUrl}`));
      }
    };

    const authPromise = new Promise((_, reject) => {
      authPromiseReject = reject;
    });

    transport.process?.stdout?.on('data', authLinkListener);
    transport.process?.stderr?.on('data', authLinkListener);

    try {
      // On EC2, mcp-remote may take longer to initialize, especially if it's trying to do OAuth
      // Increase timeout to 30 seconds to allow time for token validation
      const connectionTimeout = 30000;
      
      await Promise.race([
        client.connect(transport),
        authPromise,
        new Promise((_, reject) =>
          setTimeout(() => {
            // Check if mcp-remote is stuck in "wait-for-auth" (common on EC2)
            console.error('❌ Connection timeout after 30s');
            console.error('   This usually means mcp-remote is waiting for OAuth on localhost');
            console.error('   On EC2, ensure ATLASSIAN_ACCESS_TOKEN is valid and not expired');
            reject(new Error('Connection timeout - mcp-remote may be waiting for OAuth. On EC2, ensure token is valid.'));
          }, connectionTimeout)
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

      // Enhanced error logging for EC2 debugging
      const errorMessage = error.message || String(error);
      console.error('❌ JIRA MCP connection failed:', errorMessage);
      
      // Check for common EC2 issues
      if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
        console.error('   💡 This usually means npx/node is not in PATH. On EC2, ensure Node.js is installed and in PATH.');
        console.error('   💡 You can set ATLASSIAN_MCP_COMMAND to the full path of npx if needed.');
      }
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
        console.error('   💡 Network connectivity issue. Check EC2 security groups and outbound internet access.');
        console.error('   💡 Ensure the EC2 instance can reach mcp.atlassian.com');
      }
      if (errorMessage.includes('timeout')) {
        console.error('   💡 Connection timeout. This may indicate network issues or firewall blocking.');
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
    const env = {
      ...process.env,
      ATLASSIAN_ACCESS_TOKEN: connection.token || '',
      ATLASSIAN_CLOUD_ID: connection.cloudId || '',
      ATLASSIAN_SITE_URL: connection.siteUrl || '',
      // Prevent mcp-remote from opening browser (critical for EC2)
      BROWSER: 'none',
      NO_BROWSER: '1',
      // Additional flags to prevent interactive OAuth on EC2
      CI: 'true',
      // Tell mcp-remote to use provided token instead of doing OAuth
      // (mcp-remote should detect ATLASSIAN_ACCESS_TOKEN and skip OAuth)
    };
    
    // Log what we're passing (without exposing token)
    console.log(`   Environment variables for mcp-remote:`, {
      ATLASSIAN_ACCESS_TOKEN: connection.token ? '***set***' : 'missing',
      ATLASSIAN_CLOUD_ID: connection.cloudId || 'missing',
      ATLASSIAN_SITE_URL: connection.siteUrl || 'missing',
      BROWSER: env.BROWSER,
      NO_BROWSER: env.NO_BROWSER,
      CI: env.CI,
    });
    
    return env;
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
