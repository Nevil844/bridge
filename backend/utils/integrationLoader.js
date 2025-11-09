const mcpManager = require('../mcp/manager');
const integrationService = require('../db/services/integration');

// Lazy load user integrations on-demand (multi-tenant friendly)
// Cache loaded integrations in memory to avoid repeated DB queries
const loadedIntegrationsCache = new Map(); // userId -> Set of provider names

/**
 * Ensure user integrations are loaded in MCP manager
 */
async function ensureUserIntegrationsLoaded(userId) {
  // Check if already loaded in this session
  if (loadedIntegrationsCache.has(userId)) {
    return; // Already loaded
  }

  try {
    const integrations = await integrationService.getUserIntegrations(userId);
    const loadedProviders = new Set();
    
    for (const integration of integrations) {
      if (integration.isActive) {
        try {
          await mcpManager.addIntegration(userId, integration.provider, integration.credentials);
          loadedProviders.add(integration.provider);
          console.log(`✅ Loaded ${integration.provider} integration for user ${userId}`);
        } catch (error) {
          console.error(`⚠️  Failed to load ${integration.provider} integration:`, error.message);
        }
      }
    }
    
    // Cache that we've loaded integrations for this user
    loadedIntegrationsCache.set(userId, loadedProviders);
    
    if (integrations.length > 0) {
      console.log(`✅ Loaded ${integrations.length} integration(s) for user ${userId}`);
    }
  } catch (error) {
    console.error(`Error loading integrations for user ${userId}:`, error);
    // Still cache as loaded to avoid repeated failures
    loadedIntegrationsCache.set(userId, new Set());
  }
}

/**
 * Clear integration cache for a user (useful for testing or when integrations change)
 */
function clearIntegrationCache(userId) {
  if (userId) {
    loadedIntegrationsCache.delete(userId);
  } else {
    loadedIntegrationsCache.clear();
  }
}

module.exports = {
  ensureUserIntegrationsLoaded,
  clearIntegrationCache,
  loadedIntegrationsCache,
};

