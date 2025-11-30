/**
 * MCP Manager
 * Manages user integrations and MCP connections in a generic way
 * Supports multiple integration types (GitHub, Slack, etc.)
 */

const integrationRegistry = require('./integrations/index.js');
const integrationService = require('../db/services/integration');

// Store for user MCP connections (client + transport) - these are in-memory only
const userConnections = new Map();

// Cache for tools to avoid repeated listTools calls
// Cache expires after 5 minutes
const toolsCache = new Map();
const TOOLS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

class MCPManager {
  /**
   * Get all integrations for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - List of user integrations
   */
  async getUserIntegrations(userId) {
    try {
      const dbIntegrations = await integrationService.getUserIntegrations(userId);
      // Convert database format to manager format
      // Filter out non-MCP integrations (like "google-auth" which is just OAuth, not an MCP tool)
      // Only include integrations that are registered in the integration registry
      return dbIntegrations
        .filter(int => int.isActive)
        .filter(int => {
          // Exclude "google-auth" - it's just OAuth, not an MCP integration
          if (int.provider === 'google-auth') {
            return false;
          }
          // Only include integrations that are registered in the integration registry
          return integrationRegistry[int.provider] !== undefined;
        })
        .map(int => ({
          id: int.id,
          type: int.provider,
          name: int.provider.charAt(0).toUpperCase() + int.provider.slice(1),
          config: int.credentials,
          configured: true,
        }));
    } catch (error) {
      console.error(`Error loading integrations for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Add a new integration for a user
   * @param {string} userId - User ID
   * @param {string} type - Integration type (e.g., 'github')
   * @param {Object} config - Integration configuration
   * @returns {Promise<boolean>} - Success status
   */
  async addIntegration(userId, type, config) {
    if (!integrationRegistry[type]) {
      throw new Error(`Unknown integration type: ${type}`);
    }

    // Get integration metadata from registry
    const integrationMeta = integrationRegistry[type];
    
    // Persistence is handled by database (integrationService)
    // The database service should be called before this method
    // This method only handles in-memory MCP connections

    // Connect to MCP server
    const connected = await this.connectIntegration(userId, type, config);

    // Invalidate tools cache since we added a new integration
    // Only invalidate if the integration was successfully connected
    if (connected) {
      this.invalidateToolsCache(userId);
      return true;
    } else {
      // Connection failed - return false so caller knows it didn't work
      return false;
    }
  }

  /**
   * Remove an integration for a user
   * @param {string} userId - User ID
   * @param {string} type - Integration type
   * @returns {Promise<boolean>} - Success status
   */
  async removeIntegration(userId, type) {
    console.log(`  → Removing ${type} integration for user ${userId}`);
    
    // Persistence is handled by database (integrationService)
    // The database service should be called before this method
    // This method only handles in-memory MCP connections

    // Disconnect MCP client
    console.log(`  → Disconnecting MCP client...`);
    await this.disconnectIntegration(userId, type);
    console.log(`  ✅ MCP client disconnected`);

    // Invalidate tools cache since we removed an integration
    this.invalidateToolsCache(userId);

    return true;
  }

  /**
   * Connect to an integration's MCP server
   * @param {string} userId - User ID
   * @param {string} type - Integration type
   * @param {Object} config - Integration configuration
   * @returns {Promise<boolean>} - Success status
   */
  async connectIntegration(userId, type, config) {
    try {
      const connectionKey = `${userId}-${type}`;

      // Close existing connection if any
      if (userConnections.has(connectionKey)) {
        await this.disconnectIntegration(userId, type);
      }

      const integrationMeta = integrationRegistry[type];
      if (!integrationMeta) {
        throw new Error(`Unknown integration type: ${type}`);
      }

      // Create integration instance
      const IntegrationClass = integrationMeta.class;
      const integration = new IntegrationClass();
      
      // Pass userId in config (needed for Spotify cache file)
      const connectionConfig = { ...config, userId };
      
      console.log(`  🔌 Connecting to ${type} integration for user ${userId}...`);
      const connection = await integration.connect(connectionConfig);
      
      // Store connection with integration instance
      userConnections.set(connectionKey, {
        integration,
        connection,
        type,
        userId,
      });

      console.log(`  ✅ Successfully connected to ${type} integration`);
      return true;
    } catch (error) {
      console.error(`  ❌ Failed to connect ${type} integration:`, error.message);
      console.error(`  ❌ Error stack:`, error.stack);
      return false;
    }
  }

  /**
   * Disconnect from an integration's MCP server
   * @param {string} userId - User ID
   * @param {string} type - Integration type
   */
  async disconnectIntegration(userId, type) {
    const connectionKey = `${userId}-${type}`;
    if (userConnections.has(connectionKey)) {
      const { integration, connection } = userConnections.get(connectionKey);
      try {
        await integration.disconnect(connection);
      } catch (error) {
        console.error(`Error disconnecting ${type}:`, error);
      }
      userConnections.delete(connectionKey);
    }
  }

  /**
   * Get tools for specific integrations only
   * @param {string} userId - User ID
   * @param {Array<string>} integrationTypes - Array of integration types (e.g., ['github', 'zerodha'])
   * @returns {Promise<Array>} - List of tools from specified integrations
   */
  async getToolsForIntegrations(userId, integrationTypes) {
    console.log(`  🔍 Fetching tools for integrations: ${integrationTypes.join(', ')}...`);
    const integrations = await this.getUserIntegrations(userId);
    const tools = [];

    for (const integrationType of integrationTypes) {
      const integrationData = integrations.find(i => i.type === integrationType);
      if (!integrationData) continue;

      const connectionKey = `${userId}-${integrationType}`;
      const connectionData = userConnections.get(connectionKey);
      
      if (connectionData) {
        try {
          const { integration, connection } = connectionData;
          const integrationTools = await integration.getTools(connection);
          console.log(`  ✅ ${integrationData.name}: ${integrationTools.length} tools`);
          tools.push(...integrationTools);
        } catch (error) {
          // Handle OAuth errors gracefully - integration exists but needs OAuth
          if (error.message && error.message.includes('OAuth_AUTHENTICATION_REQUIRED')) {
            console.log(`  ⚠️  ${integrationData.name}: OAuth authentication required`);
            // Don't add tools, but don't treat as fatal error
          } else {
            console.error(`  ❌ ${integrationData.name}: Failed to get tools - ${error.message}`);
          }
        }
      } else {
        console.log(`  ⚠️  ${integrationData.name}: No active connection`);
      }
    }

    console.log(`  ✅ Total: ${tools.length} tools from ${integrationTypes.length} integration(s)`);
    return tools;
  }

  /**
   * Get all tools available to a user from all connected integrations
   * @param {string} userId - User ID
   * @param {boolean} useCache - Whether to use cached tools (default: true)
   * @returns {Promise<Array>} - List of all available tools
   */
  async getUserMCPTools(userId, useCache = true) {
    const cacheKey = `tools-${userId}`;
    
    // Check cache first (silent to reduce log spam)
    if (useCache && toolsCache.has(cacheKey)) {
      const cached = toolsCache.get(cacheKey);
      if (Date.now() - cached.timestamp < TOOLS_CACHE_TTL) {
        return cached.tools;
      }
    }

    console.log(`  🔍 Fetching fresh tools for user ${userId}...`);
    const integrations = await this.getUserIntegrations(userId);
    const allTools = [];

    for (const integrationData of integrations) {
      const connectionKey = `${userId}-${integrationData.type}`;
      const connectionData = userConnections.get(connectionKey);
      
      if (connectionData) {
        try {
          const { integration, connection } = connectionData;
          const tools = await integration.getTools(connection);
          console.log(`  ✅ ${integrationData.name}: ${tools.length} tools`);
          allTools.push(...tools);
        } catch (error) {
          // Handle OAuth errors gracefully - integration exists but needs OAuth
          if (error.message && error.message.includes('OAuth_AUTHENTICATION_REQUIRED')) {
            console.log(`  ⚠️  ${integrationData.name}: OAuth authentication required`);
            // Don't add tools, but don't treat as fatal error
          } else {
            console.error(`  ❌ Error listing tools for ${integrationData.type}:`, error.message);
          }
        }
      } else {
        console.warn(`  ⚠️  ${integrationData.name}: No active connection`);
      }
    }

    // Cache the results
    toolsCache.set(cacheKey, {
      tools: allTools,
      timestamp: Date.now(),
    });

    console.log(`  ✅ Total tools available: ${allTools.length}`);
    return allTools;
  }

  /**
   * Invalidate tools cache for a user
   * Call this when integrations are added/removed
   * @param {string} userId - User ID
   */
  invalidateToolsCache(userId) {
    const cacheKey = `tools-${userId}`;
    toolsCache.delete(cacheKey);
  }

  /**
   * Check if user has any MCP connections
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Connection status
   */
  async isUserMCPConnected(userId) {
    const integrations = await this.getUserIntegrations(userId);
    return integrations.some(i => i.configured);
  }

  /**
   * Call a tool on any connected integration
   * @param {string} userId - User ID
   * @param {string} toolName - Name of the tool to call
   * @param {Object} args - Tool arguments
   * @returns {Promise<any>} - Tool result
   */
  async callUserTool(userId, toolName, args) {
    const integrations = await this.getUserIntegrations(userId);
    
    // First, find which integration has this tool
    let targetIntegration = null;
    let targetConnectionData = null;
    
    for (const integrationData of integrations) {
      const connectionKey = `${userId}-${integrationData.type}`;
      const connectionData = userConnections.get(connectionKey);
      
      if (connectionData) {
        try {
          const { integration, connection } = connectionData;
          const tools = await integration.getTools(connection);
          
          // Check if this integration has the requested tool
          if (tools.some(tool => tool.name === toolName)) {
            targetIntegration = integrationData;
            targetConnectionData = connectionData;
            break;
          }
        } catch (error) {
          // Handle OAuth errors - these are expected for lazy connections
          if (error.message && error.message.includes('OAuth_AUTHENTICATION_REQUIRED')) {
            // OAuth required - skip this integration for now
            continue;
          }
          // Silently skip integrations that can't list tools for other reasons
          continue;
        }
      }
    }
    
    // If no integration has this tool, throw error
    if (!targetIntegration || !targetConnectionData) {
      const availableTools = await this.getUserMCPTools(userId);
      const availableToolNames = availableTools.map(t => t.name).join(', ');
      throw new Error(`Tool "${toolName}" not found. Available tools: ${availableToolNames || 'none'}`);
    }
    
    // Call the tool on the correct integration
    try {
      const { integration, connection } = targetConnectionData;
      console.log(`🔧 Calling tool "${toolName}" on ${targetIntegration.name}`);
      
      // Add timeout for tool calls (30 seconds)
      const result = await Promise.race([
        integration.callTool(connection, toolName, args),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tool call timeout after 30 seconds')), 30000)
        )
      ]);
      
      // If Zerodha login was successful, invalidate cache to get fresh tools
      if (targetIntegration.type === 'zerodha' && toolName === 'login' && !result.isError) {
        this.invalidateToolsCache(userId);
        console.log(`   🔄 Tools cache invalidated - fresh tools will be fetched on next request`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Error calling ${targetIntegration.name} tool ${toolName}:`, error.message);
      throw error;
    }
  }
}

// Create singleton instance
const mcpManager = new MCPManager();

/**
 * Auto-reconnect all saved integrations on server startup
 * Loads integrations from database and reconnects them
 */
async function reconnectSavedIntegrations() {
  console.log('🔄 Reconnecting saved integrations from database...');
  
  try {
    // Get all users with integrations from database
    // Note: This requires a method to get all users with integrations
    // For now, we'll skip auto-reconnect on startup and let integrations load on-demand
    // This is more efficient for multi-tenant systems
    console.log('✅ Integrations will be loaded on-demand per user (multi-tenant mode)');
  } catch (error) {
    console.error('Error during auto-reconnection:', error);
  }
}

// Auto-reconnect on import (when server starts)
reconnectSavedIntegrations().catch(error => {
  console.error('Error during auto-reconnection:', error);
});

module.exports = mcpManager;

