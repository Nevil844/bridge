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

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// Available models endpoint
app.get('/api/models', (req, res) => {
  const models = [
    { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    { id: 'openai/gpt-4', name: 'GPT-4' },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
    { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet' },
    { id: 'google/gemini-pro', name: 'Gemini Pro' },
    { id: 'meta-llama/llama-3-8b-instruct', name: 'Llama 3 8B' },
  ];
  res.json(models);
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
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).send('Missing code or state');
    }

    // Verify state and get userId + integration type
    const stateData = oauthHandler.verifyState(state);
    if (!stateData) {
      return res.status(400).send('Invalid or expired state');
    }

    const { userId, integrationType } = stateData;

    // Exchange code for access token
    const accessToken = await oauthHandler.exchangeCodeForToken(integrationType, code);
    
    // Add integration for user
    await mcpManager.addIntegration(userId, integrationType, { token: accessToken });

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
    
    await mcpManager.removeIntegration(userId, type);
    res.json({ success: true, message: 'Integration removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove integration' });
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

    const selectedModel = model || 'openai/gpt-3.5-turbo';
    const user = userId || 'default-user';

    const mcpConnected = await mcpManager.isUserMCPConnected(user);
    
    let tools = [];
    let systemPrompt = 'You are a helpful AI assistant.';
    
    if (mcpConnected) {
      console.log(`\n=== MCP Connected for user: ${user} ===`);
      
      const mcpTools = await mcpManager.getUserMCPTools(user);
      console.log(`Found ${mcpTools.length} MCP tools:`, mcpTools.map(t => t.name));
      
      tools = convertMCPToolsToOpenAI(mcpTools);
      console.log(`Converted to ${tools.length} OpenAI tools`);
      console.log('Tools structure:', JSON.stringify(tools.slice(0, 2), null, 2)); // Show first 2
      
      const integrations = await mcpManager.getUserIntegrations(user);
      systemPrompt = generateSystemPrompt(integrations, tools.length);
    } else {
      console.log(`\n=== No MCP connection for user: ${user} ===`);
    }

    // Initial request to AI
    const requestBody = {
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      stream: stream || false,
    };

    // Add tools if available
    if (tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
      console.log(`Sending ${tools.length} tools to AI model: ${selectedModel}`);
    } else {
      console.log('No tools available, sending without function calling');
    }

    console.log('Request body:', JSON.stringify({
      ...requestBody,
      messages: requestBody.messages.map(m => ({ role: m.role, content: m.content?.substring(0, 100) })),
      tools: tools.length > 0 ? `${tools.length} tools` : undefined,
    }, null, 2));

    if (stream) {
      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'AI MCP App',
          },
          responseType: 'stream',
        }
      );

      // Pipe the stream to the client
      response.data.on('data', (chunk) => {
        res.write(chunk);
      });

      response.data.on('end', () => {
        res.end();
      });

      response.data.on('error', (error) => {
        console.error('Stream error:', error);
        res.end();
      });

      return;
    }

    // Non-streaming response
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'AI MCP App',
        },
      }
    );

    const aiResponse = response.data.choices[0].message;
    
    console.log('AI response:', {
      has_tool_calls: !!aiResponse.tool_calls,
      tool_calls_count: aiResponse.tool_calls?.length || 0,
      content_preview: aiResponse.content?.substring(0, 100),
    });

    // Check if AI wants to call tools
    if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
      console.log(`AI requested ${aiResponse.tool_calls.length} tool call(s)`);
      
      // Execute tool calls through MCP
      const toolResults = [];
      for (const toolCall of aiResponse.tool_calls) {
        try {
          console.log(`Executing tool: ${toolCall.function.name}`);
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
      const finalResponse = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: selectedModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
            aiResponse,
            ...toolResults,
          ],
          tools,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'AI MCP App',
          },
        }
      );

      const finalMessage = finalResponse.data.choices[0].message.content;
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

