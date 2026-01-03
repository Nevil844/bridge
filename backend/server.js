const express = require('express');
const expressWs = require('express-ws');
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
const { setupChatWebSocket } = require('./routes/chat');
const modelsRouter = require('./routes/models');
const oauthRouter = require('./routes/oauth');
const waitlistRouter = require('./routes/waitlist');
const sampleQuestionsRouter = require('./routes/sampleQuestions');
const { router: transcribeRouter, setupTranscribeWebSocket } = require('./routes/transcribe');
const adminRouter = require('./routes/admin');
const notificationsRouter = require('./routes/notifications');

// Services
const integrationService = require('./db/services/integration');
const mcpManager = require('./mcp/manager');
const { ensureUserIntegrationsLoaded, loadedIntegrationsCache } = require('./utils/integrationLoader');
const { verifyUser } = require('./middleware/auth');

const app = express();
const expressWsInstance = expressWs(app); // Enable WebSocket support
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
app.use('/api/integrations', integrationsRouter); // Integration routes (including /available) - must be before oauthRouter
app.use('/api/integrations', oauthRouter); // OAuth routes also handle /api/integrations/:type/oauth-url
app.use('/api/waitlist', waitlistRouter);
app.use('/api/sample-questions', sampleQuestionsRouter);
app.use('/api/transcribe', transcribeRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notifications', notificationsRouter);

// Setup WebSocket route for real-time transcription (must be after expressWs)
setupTranscribeWebSocket(app);

// Setup WebSocket route for chat streaming (must be after expressWs)
setupChatWebSocket(app);

// Legacy integration endpoints (for backward compatibility)
app.get('/api/integrations', verifyUser, async (req, res) => {
  try {
    // Load from database (source of truth)
    const dbIntegrations = await integrationService.getUserIntegrations(req.userId);
    
    // Also ensure they're loaded in MCP manager for active use
    await ensureUserIntegrationsLoaded(req.userId);
    
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

app.post('/api/integrations', verifyUser, async (req, res) => {
  try {
    const { type, config } = req.body;
    
    if (!type || !config) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await mcpManager.addIntegration(req.userId, type, config);
    res.json({ success: true, message: 'Integration added successfully' });
  } catch (error) {
    console.error('Error adding integration:', error);
    res.status(500).json({ error: 'Failed to add integration' });
  }
});

app.delete('/api/integrations/:type', verifyUser, async (req, res) => {
  try {
    const { type } = req.params;
    
    // Remove from database first
    await integrationService.deleteIntegration(req.userId, type);
    
    // Remove from MCP manager
    await mcpManager.removeIntegration(req.userId, type);
    
    // Update cache
    if (loadedIntegrationsCache.has(req.userId)) {
      loadedIntegrationsCache.get(req.userId).delete(type);
    }
    
    res.json({ success: true, message: `${type} integration removed` });
  } catch (error) {
    console.error(`❌ Failed to disconnect ${req.params.type}:`, error);
    res.status(500).json({ error: 'Failed to remove integration', details: error.message });
  }
});

// MCP status endpoint
app.get('/api/mcp/status', verifyUser, async (req, res) => {
  try {
    // Lazy load integrations if needed
    await ensureUserIntegrationsLoaded(req.userId);
    
    const connected = await mcpManager.isUserMCPConnected(req.userId);
    const tools = connected ? await mcpManager.getUserMCPTools(req.userId) : [];
    
    res.json({
      connected,
      tools: tools.map(t => ({ name: t.name, description: t.description })),
    });
  } catch (error) {
    console.error('Error getting MCP status:', error);
    res.json({ connected: false, tools: [] });
  }
});

// Schedule notification processor to run every 5 minutes
const cron = require('node-cron');
const notificationProcessor = require('./jobs/notificationProcessor');

// Run notification processor every 5 minutes to check for pending notifications
cron.schedule('*/5 * * * *', () => {
  notificationProcessor.processNotifications().catch(err => {
    console.error('Error in scheduled notification processor:', err);
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`${appConfig.appName} backend running on http://localhost:${PORT}`);
  console.log('📅 Notification processor scheduled to run every 5 minutes');
});
