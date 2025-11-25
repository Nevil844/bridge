const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

/**
 * Zomato MCP Integration
 * Connects to the hosted Zomato MCP server using mcp-remote
 * This follows the same pattern as Claude Desktop integration
 */
class ZomatoIntegration {
  constructor() {
    this.name = 'Zomato';
    this.type = 'zomato';
    this.description = 'Discover restaurants, browse menus, create carts, and place food orders';
    this.icon = 'https://logo.clearbit.com/zomato.com';
    this.serverUrl = 'https://mcp-server.zomato.com/mcp';
  }

  /**
   * Connect to Zomato MCP server using mcp-remote
   * The MCP server handles OAuth internally - NO credentials needed!
   * @param {Object} config - Integration configuration (can be empty)
   * @returns {Promise<Object>} - MCP client and transport
   */
  async connect(config) {
    // Zomato MCP server uses mcp-remote which handles OAuth internally
    // If config exists, it means OAuth was already completed (stored in DB)
    // mcp-remote should use its cached OAuth tokens, but we don't establish connection here
    // Connection will be established lazily in getTools/callTool to avoid blocking
    console.log(`✅ Zomato MCP connection prepared (OAuth already completed, will connect on first use)`);
    
    // Return connection object - connection will be established lazily
    // This prevents blocking on connect() and allows mcp-remote to handle OAuth if needed
    return { 
      client: null, 
      transport: null,
      serverUrl: this.serverUrl,
      config: config || {},
      // Mark that OAuth was completed (config exists means integration is in DB)
      oauthCompleted: !!config && Object.keys(config).length > 0
    };
  }

  /**
   * Disconnect from Zomato MCP server
   * @param {Object} connection - Connection object with client and transport
   */
  async disconnect(connection) {
    if (connection && connection.client) {
      try {
        await connection.client.close();
      } catch (error) {
        console.error('Error disconnecting Zomato:', error.message);
      }
    }
  }

  /**
   * Get available tools from Zomato MCP
   * @param {Object} connection - Connection object with client
   * @returns {Promise<Array>} - List of available tools
   */
  async getTools(connection) {
    const { client, serverUrl } = connection;
    
    // If we have an active client, reuse it (this is the most common case after initial auth)
    if (client) {
      try {
        const response = await client.listTools();
        const tools = response.tools || [];
        console.log(`✅ Zomato: Reusing existing connection, got ${tools.length} tools`);
        // Clear any stale flags since we have a working client
        connection._connecting = false;
        connection._lastOAuthAttempt = null;
        return tools;
      } catch (error) {
        console.error('❌ Error getting Zomato tools:', error.message);
        // If client fails, clear it so we reconnect
        connection.client = null;
        connection.transport = null;
        connection._connecting = false;
      }
    }
    
    // Prevent multiple simultaneous connection attempts
    if (connection._connecting) {
      console.log(`⏳ Zomato MCP connection already in progress, waiting for it to complete...`);
      // Wait for existing connection attempt to complete (up to 30 seconds)
      let waitCount = 0;
      while (connection._connecting && waitCount < 60) {
        await new Promise(resolve => setTimeout(resolve, 500));
        waitCount++;
        
        // Check if connection completed
        if (connection.client && !connection._connecting) {
          try {
            const response = await connection.client.listTools();
            console.log(`✅ Got Zomato tools after waiting for connection`);
            return response.tools || [];
          } catch (error) {
            console.error('❌ Error getting tools after connection:', error.message);
            // Connection might have failed, break and try to reconnect
            break;
          }
        }
      }
      
      // If still connecting after timeout, check if we have a client anyway
      if (connection.client) {
        try {
          const response = await connection.client.listTools();
          return response.tools || [];
        } catch (error) {
          console.error('❌ Error getting tools after wait timeout:', error.message);
        }
      }
      
      // If we reach here, connection didn't complete in time
      console.log(`⏱️  Zomato connection wait timeout, will retry`);
      connection._connecting = false; // Reset to allow retry
    }
    
    // If OAuth was already completed (integration exists in DB), mcp-remote should use cached tokens
    // Check if we have config indicating OAuth was completed
    const oauthCompleted = connection.oauthCompleted || (connection.config && Object.keys(connection.config).length > 0);
    
    if (oauthCompleted) {
      console.log(`✅ Zomato OAuth already completed - mcp-remote should use cached tokens`);
    }
    
    // Check if OAuth was recently attempted (within last 30 seconds only, not 2 minutes)
    // This prevents rapid retries but allows tools to be fetched after OAuth completes
    // Skip this check if OAuth was already completed
    const now = Date.now();
    if (!oauthCompleted && connection._lastOAuthAttempt && (now - connection._lastOAuthAttempt) < 30000) {
      console.log(`⏳ Zomato OAuth was very recently attempted, waiting a moment...`);
      // Wait a bit, then check if we have a client now
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (connection.client) {
        try {
          const response = await connection.client.listTools();
          return response.tools || [];
        } catch (error) {
          console.error('❌ Error getting tools after OAuth wait:', error.message);
        }
      }
      // Still no client, but don't block completely - allow one retry attempt
      if ((now - connection._lastOAuthAttempt) < 30000) {
        return [];
      }
    }
    
    // Establish connection using mcp-remote (it handles OAuth internally)
    // If OAuth was already completed, mcp-remote should use cached tokens and connect quickly
    connection._connecting = true;
    // Only set _lastOAuthAttempt if OAuth wasn't already completed
    if (!oauthCompleted) {
      connection._lastOAuthAttempt = now;
    }
    
    try {
      console.log(`🔌 Establishing Zomato MCP connection via mcp-remote for tools discovery`);
      
      const transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', 'mcp-remote', serverUrl],
        env: {
          ...process.env,
          // Prevent mcp-remote from opening browser on server
          // Browser should open on client (mobile device) instead
          BROWSER: 'none',
          NO_BROWSER: '1',
        },
      });

      const newClient = new Client(
        {
          name: 'bridge-ai-zomato',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect - mcp-remote handles its own OAuth internally
      // It maintains its own cache separate from our DB
      // If OAuth is needed, mcp-remote will prompt in browser
      // We use a shorter timeout (10 seconds) to detect if OAuth is needed quickly
      const connectPromise = newClient.connect(transport);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout - OAuth may be required')), 10000)
      );
      
      try {
        await Promise.race([connectPromise, timeoutPromise]);
        console.log(`✅ Zomato MCP connected successfully for tools discovery`);
      } catch (error) {
        // If timeout, mcp-remote is likely waiting for OAuth
        // Since we prevented browser opening, we need to return OAuth URL to client
        if (oauthCompleted) {
          console.warn(`⚠️  Zomato connection timeout. mcp-remote's OAuth cache may be lost or expired.`);
          console.warn(`    Our DB shows OAuth was completed, but mcp-remote needs its own OAuth session.`);
          // Throw error with OAuth URL so client can open it
          const oauthHandler = require('../../oauth/handler');
          const authUrl = oauthHandler.getAuthUrl('zomato', connection.userId || 'default-user');
          throw new Error(`OAuth_AUTHENTICATION_REQUIRED: Zomato OAuth is required. Please open this URL in your browser: ${authUrl}`);
        }
        // If OAuth wasn't completed, return OAuth URL
        const oauthHandler = require('../../oauth/handler');
        const authUrl = oauthHandler.getAuthUrl('zomato', connection.userId || 'default-user');
        throw new Error(`OAuth_AUTHENTICATION_REQUIRED: Zomato OAuth is required. Please open this URL in your browser: ${authUrl}`);
      }
      
      // Update the connection with the real client
      connection.client = newClient;
      connection.transport = transport;
      
      // Now get the tools from MCP server
      const response = await newClient.listTools();
      const tools = response.tools || [];
      
      // Clear connection flags on success
      connection._connecting = false;
      connection._lastOAuthAttempt = null; // Reset on success
      
      console.log(`✅ Got ${tools.length} Zomato tools from MCP server`);
      return tools;
      
    } catch (error) {
      connection._connecting = false;
      console.error(`❌ Error connecting to Zomato MCP for tools:`, error.message);
      
      // Handle 502 Bad Gateway errors
      if (error.message.includes('502') || error.message.includes('Bad Gateway')) {
        console.error(`⚠️  Zomato MCP server returned 502 Bad Gateway - server may be temporarily unavailable`);
        // Return empty tools array so the UI shows as disconnected, but log the issue
        return [];
      }
      
      // If OAuth is in progress (user needs to authenticate), throw error with OAuth URL
      if (error.message.includes('Authentication') || error.message.includes('OAuth') || error.message.includes('authorize') || error.message.includes('Please authorize') || error.message.includes('OAuth_AUTHENTICATION_REQUIRED')) {
        // If error already contains OAuth URL, re-throw it
        if (error.message.includes('OAuth_AUTHENTICATION_REQUIRED')) {
          throw error;
        }
        
        // Otherwise, generate OAuth URL and throw error
        const oauthHandler = require('../../oauth/handler');
        const authUrl = oauthHandler.getAuthUrl('zomato', connection.userId || 'default-user');
        
        console.log(`🔐 Zomato OAuth required - returning URL to client.`);
        throw new Error(`OAuth_AUTHENTICATION_REQUIRED: Zomato OAuth is required. Please open this URL in your browser: ${authUrl}`);
      }
      
      // Reset OAuth attempt tracking on non-auth errors so we can retry
      connection._lastOAuthAttempt = null;
      
      // Return empty array - mcp-remote may be prompting for OAuth
      return [];
    }
  }

  /**
   * Call a tool on the Zomato MCP server
   * @param {Object} connection - Connection object with client
   * @param {string} toolName - Name of the tool to call
   * @param {Object} args - Tool arguments
   * @returns {Promise<any>} - Tool result
   */
  async callTool(connection, toolName, args) {
    const { client, serverUrl } = connection;
    
    console.log(`🔧 Zomato callTool: ${toolName}`, JSON.stringify(args, null, 2).substring(0, 200));
    
    // If we have a client, try to use it
    if (client) {
      try {
        console.log(`📞 Calling Zomato tool ${toolName} with existing client...`);
        const result = await client.callTool({ name: toolName, arguments: args });
        console.log(`✅ Zomato tool ${toolName} completed successfully`);
        console.log(`📦 Response type:`, result?.content ? 'has content' : 'no content', result?.isError ? '(error)' : '(success)');
        return result;
      } catch (error) {
        console.error(`❌ Error calling Zomato tool ${toolName}:`, error.message);
        console.error(`   Error details:`, error);
        
        // If auth error, clear client to force reconnect (mcp-remote will handle OAuth)
        if (error.message.includes('invalid_token') || error.message.includes('Authentication required') || error.message.includes('401')) {
          console.log(`🔐 Auth error detected, clearing client to force reconnect`);
          connection.client = null;
          connection.transport = null;
          // Fall through to reconnect
        } else if (error.message.includes('502') || error.message.includes('Bad Gateway')) {
          // Zomato MCP server is down or temporarily unavailable
          console.error(`⚠️  Zomato MCP server returned 502 Bad Gateway - server may be temporarily unavailable`);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'Service temporarily unavailable',
                message: 'Zomato MCP server is currently unavailable (502 Bad Gateway). Please try again in a few moments.',
                details: 'The Zomato service may be experiencing temporary issues. Please wait a moment and try again.',
              })
            }],
            isError: true
          };
        } else {
          throw error;
        }
      }
    }
    
    // Prevent multiple simultaneous connection attempts
    if (connection._connecting) {
      console.log(`⏳ Zomato MCP connection already in progress, waiting...`);
      // Wait for existing connection attempt
      let waitCount = 0;
      while (connection._connecting && waitCount < 30) {
        await new Promise(resolve => setTimeout(resolve, 500));
        waitCount++;
        if (connection.client) {
          connection._connecting = false;
          try {
            return await connection.client.callTool({ name: toolName, arguments: args });
          } catch (error) {
            console.error(`❌ Error calling tool after waiting:`, error.message);
            throw error;
          }
        }
      }
      // If still connecting after timeout, throw error
      if (connection._connecting) {
        connection._connecting = false;
        throw new Error('Zomato connection timeout - OAuth may still be in progress');
      }
    }
    
    // Establish connection using mcp-remote (it handles OAuth internally)
    connection._connecting = true;
    try {
      console.log(`🔌 Establishing Zomato MCP connection via mcp-remote for tool: ${toolName}`);
      
      const transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', 'mcp-remote', serverUrl],
        env: {
          ...process.env,
          // Prevent mcp-remote from opening browser on server
          // Browser should open on client (mobile device) instead
          BROWSER: 'none',
          NO_BROWSER: '1',
        },
      });

      const newClient = new Client(
        {
          name: 'bridge-ai-zomato',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      await newClient.connect(transport);
      
      // Update the connection with the real client
      connection.client = newClient;
      connection.transport = transport;
      connection._connecting = false;
      
      console.log(`✅ Zomato MCP connected successfully for tool call`);
      
      // Now call the tool
      console.log(`📞 Calling Zomato tool ${toolName} with new client...`);
      const result = await newClient.callTool({ name: toolName, arguments: args });
      console.log(`✅ Zomato tool ${toolName} completed successfully`);
      console.log(`📦 Response:`, JSON.stringify(result, null, 2).substring(0, 500));
      return result;
      
    } catch (error) {
      connection._connecting = false;
      console.error(`❌ Error connecting to Zomato MCP for tool ${toolName}:`, error.message);
      
      // Handle 502 Bad Gateway errors
      if (error.message.includes('502') || error.message.includes('Bad Gateway')) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'Service temporarily unavailable',
              message: 'Zomato MCP server is currently unavailable (502 Bad Gateway). Please try again in a few moments.',
              details: 'The Zomato service may be experiencing temporary issues. Please wait a moment and try again.',
            })
          }],
          isError: true
        };
      }
      
      // If OAuth is in progress, provide helpful message
      if (error.message.includes('Authentication') || error.message.includes('OAuth') || error.message.includes('authorize')) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'OAuth in progress',
              message: 'Zomato authentication is in progress. Please complete the OAuth flow in your browser. Once authenticated, you can use Zomato features.',
            })
          }],
          isError: true
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Connection failed',
            message: 'Failed to connect to Zomato MCP server. The mcp-remote tool may be prompting for OAuth authentication. Please check the browser for authentication prompts.',
            details: error.message
          })
        }],
        isError: true
      };
    }
  }

  /**
   * Get available resources from Zomato MCP
   * @param {Object} connection - Connection object with client
   * @returns {Promise<Array>} - List of available resources
   */
  async getResources(connection) {
    if (!connection || !connection.client) {
      return [];
    }

    try {
      const response = await connection.client.listResources();
      return response.resources || [];
    } catch (error) {
      console.error('❌ Error getting Zomato resources:', error.message);
      return [];
    }
  }

  /**
   * Read a resource from Zomato MCP
   * @param {Object} connection - Connection object with client
   * @param {string} resourceUri - URI of the resource to read
   * @returns {Promise<any>} - Resource content
   */
  async readResource(connection, resourceUri) {
    if (!connection || !connection.client) {
      throw new Error('Not connected to Zomato MCP');
    }

    try {
      const result = await connection.client.readResource({ uri: resourceUri });
      return result;
    } catch (error) {
      console.error(`❌ Error reading Zomato resource ${resourceUri}:`, error.message);
      throw error;
    }
  }
}

module.exports = ZomatoIntegration;
