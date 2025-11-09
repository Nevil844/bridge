const express = require('express');
const cors = require('cors');
require('dotenv').config();
const appConfig = require('./config/app');

// API routes
const conversationsRouter = require('./routes/conversations');
const integrationsRouter = require('./routes/integrations');
const memoryRouter = require('./routes/memory');
const usageRouter = require('./routes/usage');
const authRouter = require('./routes/auth');
const chatRouter = require('./routes/chat');
const modelsRouter = require('./routes/models');
const oauthRouter = require('./routes/oauth');
const waitlistRouter = require('./routes/waitlist');

// Services
const integrationService = require('./db/services/integration');
const mcpManager = require('./mcp/manager');
const { ensureUserIntegrationsLoaded, loadedIntegrationsCache } = require('./utils/integrationLoader');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = appConfig.cors.allowAllInDevelopment
  ? {} // Allow all origins in development
  : {
      origin: appConfig.cors.allowedOrigins.length > 0 
        ? appConfig.cors.allowedOrigins 
        : process.env.FRONTEND_URL || 'http://localhost:8081',
      credentials: true,
      optionsSuccessStatus: 200
    };

app.use(cors(corsOptions));
app.use(express.json({ limit: appConfig.uploads.maxSize }));

// Mount API routes
app.use('/api/conversations', conversationsRouter);
app.use('/api/user-integrations', integrationsRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/usage', usageRouter);
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/models', modelsRouter);
app.use('/api/oauth', oauthRouter);
app.use('/api/integrations', oauthRouter); // OAuth routes also handle /api/integrations/:type/oauth-url
app.use('/api/waitlist', waitlistRouter);

// Legacy integration endpoints (for backward compatibility)
app.get('/api/integrations', async (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    
    // Load from database (source of truth)
    const dbIntegrations = await integrationService.getUserIntegrations(userId);
    
    // Also ensure they're loaded in MCP manager for active use
    await ensureUserIntegrationsLoaded(userId);
    
    // Return database integrations (more complete info)
    res.json({ 
      integrations: dbIntegrations.map(int => ({
        type: int.provider,
        name: int.provider,
        isActive: int.isActive,
        connectedAt: int.createdAt,
      }))
    });
  } catch (error) {
    console.error('Error getting integrations:', error);
    res.status(500).json({ error: 'Failed to get integrations' });
  }
});

app.post('/api/integrations', async (req, res) => {
  try {
    const { userId, type, config } = req.body;
    
    if (!userId || !type || !config) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await mcpManager.addIntegration(userId, type, config);
    res.json({ success: true, message: 'Integration added successfully' });
  } catch (error) {
    console.error('Error adding integration:', error);
    res.status(500).json({ error: 'Failed to add integration' });
  }
});

app.delete('/api/integrations/:type', async (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    const { type } = req.params;
    
    console.log(`\n🗑️  Disconnect request: ${type} for user ${userId}`);
    
    // Remove from database first
    await integrationService.deleteIntegration(userId, type);
    
    // Remove from MCP manager
    const result = await mcpManager.removeIntegration(userId, type);
    
    // Update cache
    if (loadedIntegrationsCache.has(userId)) {
      loadedIntegrationsCache.get(userId).delete(type);
    }
    
    console.log(`✅ Successfully disconnected ${type}:`, result);
    
    res.json({ success: true, message: `${type} integration removed` });
  } catch (error) {
    console.error(`❌ Failed to disconnect ${req.params.type}:`, error);
    res.status(500).json({ error: 'Failed to remove integration', details: error.message });
  }
});

// MCP status endpoint
app.get('/api/mcp/status', async (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    
    // Lazy load integrations if needed
    await ensureUserIntegrationsLoaded(userId);
    
    const connected = await mcpManager.isUserMCPConnected(userId);
    const tools = connected ? await mcpManager.getUserMCPTools(userId) : [];
    
    res.json({
      connected,
      tools: tools.map(t => ({ name: t.name, description: t.description })),
    });
  } catch (error) {
    console.error('Error getting MCP status:', error);
    res.json({ connected: false, tools: [] });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ${appConfig.appName} backend running on http://localhost:${PORT}`);
  console.log(`📊 Multi-tenant mode: Integrations loaded on-demand per user`);
});
