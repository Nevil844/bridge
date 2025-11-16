const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

/**
 * JIRA MCP Integration
 * Connects to JIRA MCP server using Atlassian Remote MCP Server (OAuth) or direct MCP (API token)
 * Supports both OAuth (recommended) and API token authentication
 */
class JiraIntegration {
  constructor() {
    this.name = 'Jira';
    this.type = 'jira';
    this.description = 'Create and manage issues, projects, workflows, and more';
    this.icon = 'https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon-32x32.png';
    // Atlassian Remote MCP Server URL (OAuth-based)
    // Official URL: https://mcp.atlassian.com/v1/sse
    // Users can also provide their own instance URL if they have a custom MCP server
    this.serverUrl = process.env.ATLASSIAN_MCP_SERVER_URL || 'https://mcp.atlassian.com/v1/sse';
  }

  /**
   * Connect to JIRA MCP server
   * Defaults to OAuth via Atlassian Remote MCP Server (recommended)
   * Falls back to API token if provided
   * @param {Object} config - Integration configuration
   * @param {string} config.serverUrl - Remote MCP server URL (optional, defaults to Atlassian's)
   * @param {string} config.email - JIRA email (for API token auth, optional)
   * @param {string} config.apiToken - JIRA API token (for API token auth, optional)
   * @param {string} config.instanceUrl - JIRA instance URL (for API token auth, optional)
   * @returns {Promise<Object>} - MCP client and transport
   */
  async connect(config) {
    if (!config) {
      throw new Error('JIRA configuration is required');
    }

    // Check if we have OAuth tokens (accessToken or token)
    const hasOAuthTokens = !!(config.accessToken || config.token);
    const hasApiToken = config.email && config.apiToken && config.instanceUrl;

    // If we have OAuth tokens, use official Jira MCP server with OAuth
    // Otherwise fall back to API token or mcp-remote
    if (hasOAuthTokens) {
      // Decrypt token if needed
      let accessToken = config.accessToken || config.token;
      
      // Try to decrypt if it's encrypted
      try {
        if (accessToken.includes(':')) {
          const crypto = require('crypto');
          const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'change-this-to-a-secure-32-char-key!!';
          const parts = accessToken.split(':');
          if (parts.length >= 2) {
            const iv = Buffer.from(parts.shift(), 'hex');
            const encryptedText = parts.join(':');
            const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            accessToken = decrypted;
          }
        }
      } catch (e) {
        // If decryption fails, use token as-is (might already be plain text)
      }

      // Try to get cloud ID and site info from access token
      // Then use official Jira MCP server with OAuth token
      try {
        const axios = require('axios');
        
        // Get accessible resources (cloud IDs) from access token
        const resourcesResponse = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
          timeout: 10000,
        });

        if (resourcesResponse.data && resourcesResponse.data.length > 0) {
          // Use the first accessible resource (usually the main Jira site)
          const resource = resourcesResponse.data[0];
          const cloudId = resource.id;
          const siteUrl = resource.url;
          
          console.log(`✅ Got JIRA cloud ID: ${cloudId} for site: ${siteUrl}`);
          
          // Try using official Jira MCP server with OAuth token
          // The server might support OAuth via environment variables
          const transport = new StdioClientTransport({
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-jira'],
            env: {
              ...process.env,
              ATLASSIAN_ACCESS_TOKEN: accessToken,
              ATLASSIAN_CLOUD_ID: cloudId,
              ATLASSIAN_SITE_URL: siteUrl,
              ATLASSIAN_REFRESH_TOKEN: config.refreshToken || '',
            },
          });

          const client = new Client(
            {
              name: 'bridge-ai-jira-oauth',
              version: '1.0.0',
            },
            {
              capabilities: {},
            }
          );

          await client.connect(transport);
          console.log(`✅ Connected to JIRA MCP server with OAuth token`);
          return { client, transport, config, userId: config.userId, cloudId, siteUrl };
        } else {
          throw new Error('No accessible Jira resources found for this access token');
        }
      } catch (error) {
        console.error(`⚠️  Failed to connect with OAuth token:`, error.message);
        console.error(`   Falling back to mcp-remote...`);
        // Fall through to mcp-remote
      }
    }

    // Use mcp-remote for Atlassian Remote MCP Server (OAuth-based)
    // This is used when we don't have tokens yet or OAuth token method failed
    if (!hasApiToken) {
      const serverUrl = config.serverUrl || this.serverUrl;
      const hasOAuthTokens = !!(config.accessToken || config.token || (config.refreshToken && config.accessToken));
      
      console.log(`✅ JIRA MCP connection prepared (OAuth via Atlassian Remote MCP Server, will connect on first use)`);
      console.log(`   OAuth tokens present: ${hasOAuthTokens ? 'Yes' : 'No'}`);
      console.log(`   Config keys: ${config ? Object.keys(config).join(', ') : 'none'}`);
      if (config.token) console.log(`   Has accessToken (as 'token'): Yes`);
      if (config.accessToken) console.log(`   Has accessToken: Yes`);
      if (config.refreshToken) console.log(`   Has refreshToken: Yes`);
      
      return {
        client: null,
        transport: null,
        serverUrl: serverUrl,
        config: config,
        userId: config.userId,
        oauthCompleted: hasOAuthTokens
      };
    }

    // Direct MCP server with API token authentication (fallback)

    try {
      const transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-jira'],
        env: {
          ...process.env,
          JIRA_EMAIL: config.email,
          JIRA_API_TOKEN: config.apiToken,
          JIRA_INSTANCE_URL: config.instanceUrl,
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

      await client.connect(transport);
      console.log(`✅ Connected to JIRA MCP server for ${config.instanceUrl}`);
      return { client, transport };
    } catch (error) {
      throw new Error(`Failed to connect to JIRA: ${error.message}. Please ensure JIRA credentials are correct.`);
    }
  }

  /**
   * Disconnect from JIRA MCP server
   * @param {Object} connection - Connection object with client and transport
   */
  async disconnect(connection) {
    if (connection && connection.client) {
      try {
        await connection.client.close();
      } catch (error) {
        console.error('Error disconnecting JIRA:', error.message);
      }
    }
  }

  /**
   * Get available tools from JIRA MCP
   * @param {Object} connection - Connection object with client
   * @returns {Promise<Array>} - List of available tools
   */
  async getTools(connection) {
    const { client, serverUrl } = connection;
    
    // If we have an active client, reuse it
    if (client) {
      try {
        const response = await client.listTools();
        const tools = response.tools || [];
        console.log(`✅ JIRA: Reusing existing connection, got ${tools.length} tools`);
        return tools;
      } catch (error) {
        console.error('❌ Error getting JIRA tools:', error.message);
        connection.client = null;
        connection.transport = null;
      }
    }
    
    // Handle remote MCP server (OAuth-based via Atlassian Remote MCP Server)
    if (serverUrl && !client) {
      // Check if OAuth is completed - look for accessToken or token in config
      const hasOAuthTokens = connection.config && (connection.config.accessToken || connection.config.token || (connection.config.refreshToken && connection.config.accessToken));
      const oauthCompleted = connection.oauthCompleted || hasOAuthTokens;
      
      console.log(`🔍 JIRA OAuth status check:`, {
        oauthCompleted: connection.oauthCompleted,
        hasOAuthTokens: hasOAuthTokens,
        configKeys: connection.config ? Object.keys(connection.config).join(', ') : 'none',
        hasToken: !!(connection.config?.token),
        hasAccessToken: !!(connection.config?.accessToken),
        hasRefreshToken: !!(connection.config?.refreshToken),
        finalStatus: oauthCompleted
      });
      
      // Prevent multiple simultaneous connection attempts
      if (connection._connecting) {
        console.log(`⏳ JIRA MCP connection already in progress, waiting...`);
        let waitCount = 0;
        while (connection._connecting && waitCount < 60) {
          await new Promise(resolve => setTimeout(resolve, 500));
          waitCount++;
          if (connection.client) {
            try {
              const response = await connection.client.listTools();
              return response.tools || [];
            } catch (error) {
              break;
            }
          }
        }
        connection._connecting = false;
      }
      
      connection._connecting = true;
      
      try {
        console.log(`🔌 Establishing JIRA MCP connection via Atlassian Remote MCP Server...`);
        
        const transport = new StdioClientTransport({
          command: 'npx',
          args: ['-y', 'mcp-remote', serverUrl],
          env: {
            ...process.env,
            BROWSER: 'none',
            NO_BROWSER: '1',
          },
        });

        const newClient = new Client(
          {
            name: 'bridge-ai-jira-remote',
            version: '1.0.0',
          },
          {
            capabilities: {},
          }
        );

        // Set timeout for connection
        // If OAuth is already completed, give more time (mcp-remote may need to use cached tokens)
        // If OAuth not completed, use shorter timeout to detect OAuth needs quickly
        const timeoutMs = oauthCompleted ? 30000 : 10000; // 30s if OAuth done, 10s if not
        console.log(`⏱️  Connection timeout: ${timeoutMs}ms (OAuth completed: ${oauthCompleted})`);
        
        const connectPromise = newClient.connect(transport);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout - OAuth may be required')), timeoutMs)
        );
        
        try {
          await Promise.race([connectPromise, timeoutPromise]);
          console.log(`✅ JIRA MCP connected successfully via Atlassian Remote MCP Server`);
          
          connection.client = newClient;
          connection.transport = transport;
          connection._connecting = false;
          
          const response = await newClient.listTools();
          const tools = response.tools || [];
          console.log(`✅ Got ${tools.length} JIRA tools from Atlassian Remote MCP Server`);
          return tools;
        } catch (error) {
          connection._connecting = false;
          
          // If timeout or OAuth needed, return OAuth URL
          if (error.message.includes('timeout') || error.message.includes('OAuth') || error.message.includes('authentication')) {
            // Get OAuth URL from handler
            let oauthUrl;
            try {
              const oauthHandler = require('../../oauth/handler');
              oauthUrl = oauthHandler.getAuthUrl('jira', connection.userId || 'default-user');
            } catch (e) {
              // Fallback to a generic Atlassian OAuth URL
              oauthUrl = 'https://auth.atlassian.com/authorize';
            }
            throw new Error(`OAuth_AUTHENTICATION_REQUIRED: ${oauthUrl}`);
          }
          throw error;
        }
      } catch (error) {
        connection._connecting = false;
        
        if (error.message.includes('OAuth_AUTHENTICATION_REQUIRED')) {
          throw error;
        }
        
        console.error('❌ Error connecting to JIRA remote MCP:', error.message);
        
        // Catch mcp-remote errors (browser opening failures, port errors, etc.)
        // These indicate OAuth is needed - return a special "authenticate" tool like Zerodha's login tool
        if (error.message.includes('Cannot read properties of null') || 
            error.message.includes('port') ||
            error.message.includes('Browser') ||
            error.message.includes('Connection closed') ||
            error.message.includes('Fatal error')) {
          
          // Get OAuth URL
          let oauthUrl;
          try {
            const oauthHandler = require('../../oauth/handler');
            oauthUrl = oauthHandler.getAuthUrl('jira', connection.userId || 'default-user');
            console.log(`✅ JIRA OAuth credentials found`);
            console.log(`🔐 JIRA OAuth URL generation:`, {
              clientId: process.env.ATLASSIAN_CLIENT_ID ? process.env.ATLASSIAN_CLIENT_ID.substring(0, 10) + '...' : 'NOT SET',
              redirectUri: 'https://api.bridge.neviljobanputra.com/api/oauth/callback',
              scope: 'read:jira-work write:jira-work read:jira-user offline_access'
            });
            console.log(`✅ Generated JIRA OAuth URL: ${oauthUrl}`);
            console.log(`⚠️  IMPORTANT: Make sure this redirect_uri matches EXACTLY in Atlassian Developer Console:`);
            console.log(`    https://api.bridge.neviljobanputra.com/api/oauth/callback`);
          } catch (e) {
            oauthUrl = 'https://auth.atlassian.com/authorize';
          }
          
          // Return a special "authenticate" tool that the AI can call to show the OAuth URL
          // This is similar to how Zerodha returns a "login" tool
          return [{
            name: 'jira_authenticate',
            description: `JIRA authentication is required. This tool will provide the authorization link. Call this first to authenticate with JIRA.`,
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            },
            _oauthUrl: oauthUrl // Store OAuth URL in tool metadata
          }];
        }
        
        // For other errors, also return OAuth URL as fallback
        let oauthUrl;
        try {
          const oauthHandler = require('../../oauth/handler');
          oauthUrl = oauthHandler.getAuthUrl('jira', connection.userId || 'default-user');
        } catch (e) {
          oauthUrl = 'https://auth.atlassian.com/authorize';
        }
        throw new Error(`OAuth_AUTHENTICATION_REQUIRED: ${oauthUrl}`);
      }
    }

    // Direct MCP server
    if (!connection || !connection.client) {
      return [];
    }

    try {
      const response = await connection.client.listTools();
      return response.tools || [];
    } catch (error) {
      console.error('❌ Error getting JIRA tools:', error.message);
      return [];
    }
  }

  /**
   * Call a tool on the JIRA MCP server
   * @param {Object} connection - Connection object with client
   * @param {string} toolName - Name of the tool to call
   * @param {Object} args - Tool arguments
   * @returns {Promise<any>} - Tool result
   */
  async callTool(connection, toolName, args) {
    // Handle special authenticate tool (similar to Zerodha's login tool)
    if (toolName === 'jira_authenticate') {
      let oauthUrl;
      try {
        const oauthHandler = require('../../oauth/handler');
        oauthUrl = oauthHandler.getAuthUrl('jira', connection.userId || 'default-user');
      } catch (e) {
        oauthUrl = 'https://auth.atlassian.com/authorize';
      }
      
      return {
        isError: false,
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `JIRA authentication is required. Please click this link to authorize: ${oauthUrl}`,
            oauthUrl: oauthUrl,
            instructions: 'Click the link above to complete JIRA authentication. After authorizing, you can try your request again.'
          })
        }]
      };
    }
    
    const { client, serverUrl } = connection;
    
    // Log tool call with arguments for debugging
    console.log(`🔧 JIRA callTool: ${toolName}`, JSON.stringify(args, null, 2).substring(0, 500));
    
    // If we have a client, try to use it
    if (client) {
      try {
        const result = await client.callTool({ name: toolName, arguments: args });
        
        // Log result for debugging
        if (result.isError) {
          const errorText = result.content?.[0]?.text || JSON.stringify(result.content);
          console.log(`   ❌ JIRA tool ${toolName} error:`, errorText.substring(0, 300));
        } else {
          console.log(`   ✅ JIRA tool ${toolName} success`);
        }
        
        return result;
      } catch (error) {
        console.error(`❌ Error calling JIRA tool ${toolName}:`, error.message);
        
        // If auth error, clear client to force reconnect
        if (error.message.includes('invalid_token') || error.message.includes('Authentication required') || error.message.includes('401')) {
          connection.client = null;
          connection.transport = null;
        } else {
          throw error;
        }
      }
    }
    
    // Handle remote MCP server - establish connection if needed
    if (serverUrl && !client) {
      // Try to establish connection
      await this.getTools(connection);
    }

    if (!connection || !connection.client) {
      // Get OAuth URL if available
      let oauthUrl;
      try {
        const oauthHandler = require('../../oauth/handler');
        oauthUrl = oauthHandler.getAuthUrl('jira', connection.userId || 'default-user');
      } catch (e) {
        oauthUrl = 'https://auth.atlassian.com/authorize';
      }
      
      // Return error in format that AI can show to user with link (like Zerodha)
      return {
        isError: true,
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'OAuth_AUTHENTICATION_REQUIRED',
            message: `JIRA authentication is required. Please click this link to authorize: ${oauthUrl}`,
            oauthUrl: oauthUrl,
            instructions: 'Click the link above to complete JIRA authentication, then try your request again.'
          })
        }]
      };
    }

    try {
      const result = await connection.client.callTool({ name: toolName, arguments: args });
      return result;
    } catch (error) {
      console.error(`❌ Error calling JIRA tool ${toolName}:`, error.message);
      
      // Check if it's an OAuth error
      if (error.message.includes('OAuth') || error.message.includes('authentication') || error.message.includes('OAuth_AUTHENTICATION_REQUIRED')) {
        let oauthUrl;
        
        // Extract OAuth URL from error message if present
        if (error.message.includes('OAuth_AUTHENTICATION_REQUIRED:')) {
          oauthUrl = error.message.split('OAuth_AUTHENTICATION_REQUIRED:')[1].trim();
        } else {
          try {
            const oauthHandler = require('../../oauth/handler');
            oauthUrl = oauthHandler.getAuthUrl('jira', connection.userId || 'default-user');
          } catch (e) {
            oauthUrl = 'https://auth.atlassian.com/authorize';
          }
        }
        
        // Return error in format that AI can show to user with link (like Zerodha)
        return {
          isError: true,
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'OAuth_AUTHENTICATION_REQUIRED',
              message: `JIRA authentication is required. Please click this link to authorize: ${oauthUrl}`,
              oauthUrl: oauthUrl,
              instructions: 'Click the link above to complete JIRA authentication, then try your request again.'
            })
          }]
        };
      }
      
      throw error;
    }
  }
}

module.exports = JiraIntegration;

