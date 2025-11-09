/**
 * Application configuration
 * Centralized app-specific settings
 */

module.exports = {
  // Application name (used in responses, UI, etc.)
  appName: process.env.APP_NAME || 'AI Assistant',
  
  // Default model
  defaultModel: process.env.DEFAULT_MODEL || 'anthropic.claude-sonnet-4-20250514-v1:0',
  
  // Conversation settings
  conversation: {
    historyLimit: parseInt(process.env.CONVERSATION_HISTORY_LIMIT || '10'),
    memorySearchLimit: parseInt(process.env.MEMORY_SEARCH_LIMIT || '3'),
  },
  
  // File upload settings
  uploads: {
    dest: 'uploads/',
    maxSize: '10mb',
  },
  
  // CORS settings
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],
    allowAllInDevelopment: process.env.NODE_ENV !== 'production',
  },
  
  // OAuth session settings
  oauth: {
    sessionExpiry: 5 * 60 * 1000, // 5 minutes
    stateExpiry: 10 * 60 * 1000, // 10 minutes
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
  },
};

