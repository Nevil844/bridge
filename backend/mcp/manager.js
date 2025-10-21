/**
 * MCP Manager
 * Manages user integrations and MCP connections in a generic way
 * Supports multiple integration types (GitHub, Slack, etc.)
 */

const integrationRegistry = require('./integrations/index.js');
const storage = require('../storage/integrations');

// Store for user integrations (loaded from persistent storage)
let userIntegrations = storage.loadIntegrations();

// Store for user MCP connections (client + transport) - these are in-memory only
const userConnections = new Map();

// Cache for tools to avoid repeated listTools calls
// Cache expires after 60 seconds
const toolsCache = new Map();
const TOOLS_CACHE_TTL = 60 * 1000; // 60 seconds

class MCPManager {
  /**
   * Get all integrations for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - List of user integrations
   */
  async getUserIntegrations(userId) {
    if (!userIntegrations.has(userId)) {
      return [];
    }
    return userIntegrations.get(userId);
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

    if (!userIntegrations.has(userId)) {
      userIntegrations.set(userId, []);
    }

    const integrations = userIntegrations.get(userId);
    
    // Remove existing integration of same type
    const filtered = integrations.filter(i => i.type !== type);
    
    // Get integration metadata from registry
    const integrationMeta = integrationRegistry[type];
    
    // Add new integration
    filtered.push({
      id: `${userId}-${type}-${Date.now()}`,
      type,
      name: integrationMeta.name,
      config,
      configured: true,
    });

    userIntegrations.set(userId, filtered);
    
    // Save to persistent storage
    storage.saveUserIntegrations(userId, filtered, userIntegrations);

    // Connect to MCP server
    await this.connectIntegration(userId, type, config);

    // Invalidate tools cache since we added a new integration
    this.invalidateToolsCache(userId);

    return true;
  }

  /**
   * Remove an integration for a user
   * @param {string} userId - User ID
   * @param {string} type - Integration type
   * @returns {Promise<boolean>} - Success status
   */
  async removeIntegration(userId, type) {
    console.log(`  → Removing ${type} integration for user ${userId}`);
    
    if (!userIntegrations.has(userId)) {
      console.log(`  ⚠️  No integrations found for user ${userId}`);
      return false;
    }

    const integrations = userIntegrations.get(userId);
    console.log(`  → User has ${integrations.length} integration(s)`);
    
    const filtered = integrations.filter(i => i.type !== type);
    console.log(`  → After filtering: ${filtered.length} integration(s) remain`);
    
    userIntegrations.set(userId, filtered);
    
    // Save to persistent storage
    console.log(`  → Saving to storage...`);
    const saved = storage.saveUserIntegrations(userId, filtered, userIntegrations);
    if (saved) {
      console.log(`  ✅ Saved to storage`);
    } else {
      console.log(`  ⚠️  Failed to save to storage`);
    }

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
      
      const connection = await integration.connect(config);
      
      // Store connection with integration instance
      userConnections.set(connectionKey, {
        integration,
        connection,
        type,
        userId,
      });

      return true;
    } catch (error) {
      console.error(`Failed to connect ${type}:`, error.message);
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
          console.error(`  ❌ ${integrationData.name}: Failed to get tools - ${error.message}`);
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
          console.error(`  ❌ Error listing tools for ${integrationData.type}:`, error.message);
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
          // Silently skip integrations that can't list tools
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
      const result = await integration.callTool(connection, toolName, args);
      
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
 */
async function reconnectSavedIntegrations() {
  console.log('🔄 Reconnecting saved integrations...');
  
  let reconnectedCount = 0;
  let failedCount = 0;
  
  for (const [userId, integrations] of userIntegrations.entries()) {
    console.log(`\n👤 User: ${userId} (${integrations.length} integration(s))`);
    for (const integration of integrations) {
      try {
        console.log(`   🔌 Connecting ${integration.name}...`);
        await mcpManager.connectIntegration(userId, integration.type, integration.config);
        console.log(`   ✅ ${integration.name} connected`);
        reconnectedCount++;
      } catch (error) {
        failedCount++;
        console.error(`   ❌ Failed to reconnect ${integration.name}:`, error.message);
        if (error.stack) {
          console.error(`      Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
        }
      }
    }
    
    // Invalidate tools cache after all integrations are connected
    // This ensures fresh tools are fetched on next request
    mcpManager.invalidateToolsCache(userId);
  }
  
  console.log(`\n✨ Reconnection complete: ${reconnectedCount} succeeded, ${failedCount} failed\n`);
}

// Auto-reconnect on import (when server starts)
reconnectSavedIntegrations().catch(error => {
  console.error('Error during auto-reconnection:', error);
});

module.exports = mcpManager;

