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
      
      console.log(`🔗 Connecting ${integration.name} for user: ${userId}`);
      
      const connection = await integration.connect(config);
      
      // Store connection with integration instance
      userConnections.set(connectionKey, {
        integration,
        connection,
        type,
      });

      console.log(`✅ ${integration.name} connected for user: ${userId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to connect ${type} for user ${userId}:`, error.message);
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
      console.log(`Disconnected ${type} for user: ${userId}`);
    }
  }

  /**
   * Get all tools available to a user from all connected integrations
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - List of all available tools
   */
  async getUserMCPTools(userId) {
    const integrations = await this.getUserIntegrations(userId);
    const allTools = [];

    for (const integrationData of integrations) {
      const connectionKey = `${userId}-${integrationData.type}`;
      const connectionData = userConnections.get(connectionKey);
      
      if (connectionData) {
        try {
          const { integration, connection } = connectionData;
          const tools = await integration.getTools(connection);
          allTools.push(...tools);
        } catch (error) {
          console.error(`Error listing tools for ${integrationData.type}:`, error);
        }
      }
    }

    return allTools;
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
    
    for (const integrationData of integrations) {
      const connectionKey = `${userId}-${integrationData.type}`;
      const connectionData = userConnections.get(connectionKey);
      
      if (connectionData) {
        try {
          const { integration, connection } = connectionData;
          console.log(`Calling tool ${toolName} with args:`, args);
          const result = await integration.callTool(connection, toolName, args);
          console.log(`Tool ${toolName} result:`, result);
          return result;
        } catch (error) {
          console.error(`Error calling tool ${toolName}:`, error);
          // Continue to next integration instead of throwing
          continue;
        }
      }
    }
    
    throw new Error(`No MCP client found for user ${userId} or tool ${toolName} not available`);
  }
}

// Create singleton instance
const mcpManager = new MCPManager();

/**
 * Auto-reconnect all saved integrations on server startup
 */
async function reconnectSavedIntegrations() {
  console.log('\n🔄 Reconnecting saved integrations...');
  
  let reconnectedCount = 0;
  let failedCount = 0;
  
  for (const [userId, integrations] of userIntegrations.entries()) {
    for (const integration of integrations) {
      try {
        console.log(`  → Reconnecting ${integration.name} for user ${userId}...`);
        await mcpManager.connectIntegration(userId, integration.type, integration.config);
        reconnectedCount++;
        console.log(`  ✅ ${integration.name} reconnected`);
      } catch (error) {
        failedCount++;
        console.error(`  ❌ Failed to reconnect ${integration.name}:`, error.message);
      }
    }
  }
  
  console.log(`\n✨ Reconnection complete: ${reconnectedCount} succeeded, ${failedCount} failed\n`);
}

// Auto-reconnect on import (when server starts)
reconnectSavedIntegrations().catch(error => {
  console.error('Error during auto-reconnection:', error);
});

module.exports = mcpManager;

