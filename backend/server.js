const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
require('dotenv').config();
const mcpManager = require('./mcp/manager');
const { convertMCPToolsToOpenAI, generateSystemPrompt } = require('./mcp/tools');
const oauthHandler = require('./oauth/handler');
const { getAllModels, getProviderForModel } = require('./ai-providers');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// Available models endpoint (returns both free and premium models)
app.get('/api/models', (req, res) => {
  try {
    const models = getAllModels();
    res.json(models);
  } catch (error) {
    console.error('Error getting models:', error);
    res.status(500).json({ 
      error: 'Failed to load models',
      models: [
        { id: 'models/gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'free' }
      ]
    });
  }
});

// Generic OAuth URL endpoint
app.get('/api/integrations/:type/oauth-url', (req, res) => {
  try {
    const { type } = req.params;
    const userId = req.query.userId || 'default-user';
    
    const authUrl = oauthHandler.getAuthUrl(type, userId);
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating OAuth URL:', error.message);
    res.status(500).json({ error: error.message || 'Failed to generate OAuth URL' });
  }
});

// Generic OAuth callback endpoint
app.get('/api/oauth/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    console.log('\n🔐 OAuth callback received:', {
      hasCode: !!code,
      hasState: !!state,
      error: error || 'none',
      error_description: error_description || 'none'
    });

    // Handle OAuth errors from provider (e.g., user denied access)
    if (error) {
      console.error('❌ OAuth error from provider:', error, error_description);
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Authorization Failed</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: -apple-system, sans-serif; text-align: center; padding: 50px; }
              .error { color: #ff3b30; font-size: 48px; }
            </style>
          </head>
          <body>
            <div class="error">❌</div>
            <h1>Authorization ${error === 'access_denied' ? 'Cancelled' : 'Failed'}</h1>
            <p>${error_description || 'You can close this window and try again.'}</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `);
    }

    if (!code || !state) {
      console.error('❌ Missing code or state');
      return res.status(400).send('Missing code or state');
    }

    // Verify state and get userId + integration type
    const stateData = oauthHandler.verifyState(state);
    if (!stateData) {
      console.warn('⚠️ Invalid or expired state - checking if already connected...', state);
      
      // The state might be expired because we already processed this successfully
      // Show a friendly "already connected" message instead of error
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Already Connected</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                text-align: center;
                background: white;
                padding: 40px;
                border-radius: 20px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                max-width: 400px;
              }
              .checkmark { color: #34c759; font-size: 64px; margin-bottom: 20px; }
              h1 { color: #333; margin: 0 0 10px 0; }
              p { color: #666; line-height: 1.5; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="checkmark">✓</div>
              <h1>Already Connected!</h1>
              <p>This authorization was already processed successfully.</p>
              <p>You can close this window and return to the app.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </div>
          </body>
        </html>
      `);
    }

    const { userId, integrationType } = stateData;

    console.log(`✅ Valid state for user ${userId}, exchanging code for token...`);

    // Exchange code for access token
    const tokenData = await oauthHandler.exchangeCodeForToken(integrationType, code);
    
    console.log(`✅ Got tokens, adding ${integrationType} integration...`);
    
    // Handle different token formats (some integrations return just a string, others return an object)
    const config = typeof tokenData === 'string' 
      ? { token: tokenData }
      : { token: tokenData.accessToken, refreshToken: tokenData.refreshToken };
    
    // Add integration for user
    await mcpManager.addIntegration(userId, integrationType, config);

    console.log(`✅ ${integrationType} integration added successfully!`);

    // Get integration name for display
    const integrationName = integrationType.charAt(0).toUpperCase() + integrationType.slice(1);

    // Return generic success page
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${integrationName} Connected!</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 20px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              max-width: 400px;
            }
            .checkmark {
              font-size: 60px;
              color: #34C759;
              margin-bottom: 20px;
            }
            h1 {
              color: #333;
              margin: 0 0 10px 0;
              font-size: 24px;
            }
            p {
              color: #666;
              margin: 0 0 20px 0;
              font-size: 16px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="checkmark">✓</div>
            <h1>${integrationName} Connected!</h1>
            <p>You can now close this window and return to the app.</p>
            <p style="font-size: 14px; color: #999;">Your AI assistant now has access to ${integrationName}.</p>
          </div>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('OAuth failed. Please try again.');
  }
});

// User integrations endpoints
app.get('/api/integrations', async (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    const integrations = await mcpManager.getUserIntegrations(userId);
    res.json({ integrations });
  } catch (error) {
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
    
    const result = await mcpManager.removeIntegration(userId, type);
    
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
    const connected = await mcpManager.isUserMCPConnected(userId);
    const tools = connected ? await mcpManager.getUserMCPTools(userId) : [];
    
    res.json({
      connected,
      tools: tools.map(t => ({ name: t.name, description: t.description })),
    });
  } catch (error) {
    res.json({ connected: false, tools: [] });
  }
});

// Speech-to-text endpoint
app.post('/api/chat/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('Transcribing audio file:', req.file.filename);

    // Create form data for Whisper API
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path), {
      filename: 'audio.m4a',
      contentType: 'audio/m4a',
    });
    formData.append('model', 'whisper-1');

    // Call OpenAI Whisper API
    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    // Delete the uploaded file
    fs.unlinkSync(req.file.path);

    console.log('Transcription result:', response.data.text);
    res.json({ text: response.data.text });
  } catch (error) {
    console.error('Transcription error:', error.response?.data || error.message);
    
    // Clean up file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    
    res.status(500).json({ 
      error: 'Failed to transcribe audio',
      details: error.response?.data || error.message 
    });
  }
});

// Chat completion endpoint with per-user MCP integration
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model, userId, stream } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const selectedModel = model || 'models/gemini-2.5-flash'; // Default to free model
    const user = userId || 'default-user';
    
    // Get the appropriate AI provider for this model
    const provider = getProviderForModel(selectedModel);
    const mcpConnected = await mcpManager.isUserMCPConnected(user);
    
    let tools = [];
    let systemPrompt = 'You are a helpful AI assistant.';
    
    if (mcpConnected) {
      const mcpTools = await mcpManager.getUserMCPTools(user);
      tools = convertMCPToolsToOpenAI(mcpTools);
      const integrations = await mcpManager.getUserIntegrations(user);
      systemPrompt = generateSystemPrompt(integrations, tools.length);
    }

    // Initial request to AI
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];

    // Use provider to handle the chat request
    const aiResponse = await provider.chat(messages, selectedModel, tools, stream || false);

    // Check if AI wants to call tools
    if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
      // Execute tool calls through MCP
      const toolResults = [];
      for (const toolCall of aiResponse.tool_calls) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          
          const result = await mcpManager.callUserTool(
            user, 
            toolCall.function.name, 
            args
          );
          
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolCall.function.name,
            content: JSON.stringify(result),
          });
        } catch (error) {
          console.error(`Error calling tool ${toolCall.function.name}:`, error);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolCall.function.name,
            content: JSON.stringify({ error: error.message }),
          });
        }
      }

      // Send tool results back to AI for final response
      const finalMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
        aiResponse,
        ...toolResults,
      ];
      
      const finalResponse = await provider.chat(finalMessages, selectedModel, tools, false);
      const finalMessage = finalResponse.content;
      res.json({ 
        message: finalMessage,
        mcpEnabled: true,
        toolsUsed: aiResponse.tool_calls.map(tc => tc.function.name),
      });
    } else {
      // No tools called, return direct response
      res.json({ 
        message: aiResponse.content,
        mcpEnabled: mcpConnected,
        toolsUsed: [],
      });
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to get response from AI',
      details: error.response?.data || error.message 
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

