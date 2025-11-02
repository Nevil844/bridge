const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const axios = require('axios');

/**
 * Zerodha/Kite MCP Integration
 * Connects to Zerodha's official MCP server for portfolio and market data
 * Based on: https://zerodha.com/z-connect/featured/connect-your-zerodha-account-to-ai-assistants-with-kite-mcp
 */
class ZerodhaIntegration {
  constructor() {
    this.name = 'Zerodha';
    this.type = 'zerodha';
    this.description = 'Access your Zerodha portfolio, market data, and trading insights';
    this.icon = 'https://zerodha.com/static/images/logo.svg';
    this.mcpServerUrl = 'https://mcp.kite.trade/mcp';
    this.apiKey = process.env.ZERODHA_API_KEY;
  }

  /**
   * Connect to Zerodha MCP server
   * @param {Object} config - Integration configuration
   * @param {string} config.token - Zerodha access token
   * @param {string} config.userId - Zerodha user ID
   * @returns {Promise<Object>} - MCP client and transport
   */
  async connect(config) {
    if (!config || !config.token) {
      throw new Error('Zerodha access token is required');
    }

    try {
      // Zerodha's hosted MCP (mcp.kite.trade) uses session-based authentication
      // via the login tool - we connect without any authorization header
      const transport = new StdioClientTransport({
        command: 'npx',
        args: [
          '-y', 
          'mcp-remote',
          this.mcpServerUrl
        ],
        env: {
          ...process.env,
        },
      });

      const client = new Client(
        {
          name: 'bridge-ai-zerodha',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      await client.connect(transport);
      
      console.log(`✅ Zerodha MCP connected with token for user: ${config.userId || 'unknown'}`);
      
      // Verify token is valid by calling Kite API directly
      try {
        const axios = require('axios');
        const profileResponse = await axios.get('https://api.kite.trade/user/profile', {
          headers: {
            'Authorization': `token ${this.apiKey}:${config.token}`,
            'X-Kite-Version': '3',
          },
        });
        console.log(`✅ Token verified - User: ${profileResponse.data.data.user_name} (${profileResponse.data.data.user_id})`);
      } catch (tokenError) {
        // Don't log response data as it might contain sensitive info
        console.error(`❌ Token verification failed: ${tokenError.message}`);
        throw new Error('Invalid or expired Zerodha token. Please reconnect Zerodha in the app.');
      }
      
      // Note: We do NOT auto-call login here. The login tool will be called 
      // by the AI when the user first asks a Zerodha question, to show the 
      // warning and get the authorization link.
      
      return { 
        client, 
        transport,
        token: config.token,
        userId: config.userId,
      };
    } catch (error) {
      console.error('Failed to connect to Zerodha MCP:', error.message);
      throw error;
    }
  }

  /**
   * Disconnect from Zerodha MCP server
   * @param {Object} connection - Connection object with client and transport
   */
  async disconnect(connection) {
    if (connection && connection.client) {
      try {
        await connection.client.close();
      } catch (error) {
        console.error('Error disconnecting Zerodha:', error.message);
      }
    }
  }

  /**
   * Get available tools from Zerodha MCP
   * @param {Object} connection - Connection object with client
   * @returns {Promise<Array>} - List of available tools
   */
  async getTools(connection) {
    if (!connection || !connection.client) {
      return [];
    }

    try {
      const response = await connection.client.listTools();
      
      // Just log the count, not all the details
      if (response.tools && response.tools.length > 0) {
        console.log(`   📋 Zerodha: ${response.tools.length} tools available`);
      }
      
      return response.tools || [];
    } catch (error) {
      // Zerodha requires interactive login before tools are available
      if (error.message?.includes('Invalid session ID') || error.message?.includes('session')) {
        console.log(`   ⏳ Zerodha: User needs to complete login flow (use 'login' tool)`);
        // Return the login tool as the only available tool initially
        return [{
          name: 'login',
          description: 'Login to Kite API. Call this first to get the authorization link.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        }];
      }
      
      console.error('❌ Error getting Zerodha tools:', error.message);
      return [];
    }
  }

  /**
   * Call a tool on the Zerodha MCP server
   * @param {Object} connection - Connection object with client
   * @param {string} toolName - Name of the tool to call
   * @param {Object} args - Tool arguments
   * @returns {Promise<any>} - Tool result
   */
  async callTool(connection, toolName, args) {
    if (!connection || !connection.client) {
      throw new Error('Not connected to Zerodha MCP');
    }

    try {
      console.log(`📤 Zerodha: ${toolName}(${JSON.stringify(args)})`);
      const result = await connection.client.callTool({ 
        name: toolName, 
        arguments: args 
      });
      
      // Log result status
      if (result.isError) {
        const errorText = result.content?.[0]?.text || '';
        console.log(`   ❌ Error: ${errorText}`);
        
        // If it's a login error and we're not already calling the login tool, 
        // automatically call login and return its response
        if (toolName !== 'login' && 
            (errorText.includes('log in first') || 
             errorText.includes('Failed to execute') ||
             errorText.includes('Invalid session'))) {
          console.log(`   🔐 Auto-calling login tool to get authorization link...`);
          
          const loginResult = await connection.client.callTool({
            name: 'login',
            arguments: {}
          });
          
          console.log(`   ✅ Login tool called successfully`);
          
          // Return the login response instead of the error
          // This gives the AI the authorization link to show the user
          return loginResult;
        }
      } else {
        console.log(`   ✅ Success`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Error calling Zerodha tool ${toolName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get user profile (for verification)
   * Uses Kite Connect API directly
   */
  async getUserProfile(connection) {
    try {
      const response = await axios.get('https://api.kite.trade/user/profile', {
        headers: {
          'Authorization': `token ${this.apiKey}:${connection.token}`,
          'X-Kite-Version': '3',
        },
      });
      
      return response.data.data;
    } catch (error) {
      console.error('Error fetching Zerodha profile:', error.message);
      throw error;
    }
  }
}

module.exports = ZerodhaIntegration;

