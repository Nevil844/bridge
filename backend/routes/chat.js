const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const conversationService = require('../db/services/conversation');
const integrationService = require('../db/services/integration');
const tokenUsageService = require('../db/services/tokenUsage');
const toolContextService = require('../db/services/toolContext');
const mcpManager = require('../mcp/manager');
const { convertMCPToolsToOpenAI, generateSystemPrompt, getIntegrationInstructions } = require('../mcp/tools');
const { getAllModels, getProviderForModel } = require('../ai-providers');
const { checkQuota } = require('../middleware/quotaEnforcement');
const { parseAIResponse } = require('../utils/responseParser');
const { executeToolCalls } = require('../utils/toolExecutor');
const { formatAIResponse, createMessagePayload } = require('../utils/messageFormatter');
const { searchRelevantMemories, formatMemoryContext, storeMessageAsMemory } = require('../utils/memoryHelper');
const appConfig = require('../config/app');

const router = express.Router();

// Configure multer for file uploads
// Supports both web (File/Blob) and mobile (React Native FormData) uploads
const upload = multer({ 
  dest: appConfig.uploads.dest,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files - be permissive for both web and mobile
    const isAudioMimeType = file.mimetype && (
      file.mimetype.startsWith('audio/') ||
      file.mimetype === 'application/octet-stream' ||
      file.mimetype === 'video/mp4' || // m4a files might be sent as mp4
      file.mimetype === 'video/quicktime' // iOS sometimes uses this
    );
    
    const hasAudioExtension = file.originalname && 
      file.originalname.match(/\.(m4a|mp3|wav|ogg|flac|aac|mp4|mov)$/i);
    
    // Accept if it's an audio mimetype, has audio extension, or no mimetype (React Native might not send it)
    if (isAudioMimeType || hasAudioExtension || !file.mimetype) {
      cb(null, true);
    } else {
      console.warn('⚠️ File rejected by filter:', {
        mimetype: file.mimetype,
        originalname: file.originalname,
      });
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

/**
 * Format tool context generically (works for any integration)
 * @param {Array} activeToolContexts - Array of active tool contexts
 * @returns {string} - Formatted tool context info
 */
function formatToolContextInfo(activeToolContexts) {
  if (!activeToolContexts || activeToolContexts.length === 0) {
    return '';
  }
  
  let toolContextInfo = '\n\n## Working Memory (Tool Context)\n';
  activeToolContexts.forEach(ctx => {
    if (ctx.state && ctx.state.context) {
      const context = ctx.state.context;
      const toolName = ctx.state.tool || ctx.toolName || 'unknown';
      // Format context generically - just show the key data points
      const contextStr = Object.entries(context)
        .filter(([key]) => key !== 'extracted' && key !== 'timestamp')
        .map(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            return `${key}: ${JSON.stringify(value)}`;
          }
          return `${key}: ${value}`;
        })
        .join(', ');
      
      if (contextStr) {
        toolContextInfo += `- ${toolName}: ${contextStr}\n`;
      }
    }
  });
  toolContextInfo += '\nUse this information - you already have it, don\'t search again!\n';
  
  return toolContextInfo;
}

const { ensureUserIntegrationsLoaded } = require('../utils/integrationLoader');

/**
 * Chat completion endpoint with per-user MCP integration
 */
router.post('/', checkQuota, async (req, res) => {
  try {
    const { message, model, userId, conversationId, stream } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const selectedModel = model || appConfig.defaultModel;
    const user = userId || 'default-user';
    
    // Create or get conversation
    let conversation;
    if (conversationId) {
      conversation = await conversationService.getConversation(conversationId, user);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
    } else {
      conversation = await conversationService.createConversation(user, 'New Chat');
    }
    
    // Search for relevant memories
    const relevantMemories = await searchRelevantMemories(
      user,
      message,
      conversation.id,
      appConfig.conversation.memorySearchLimit
    );
    const memoryContext = formatMemoryContext(relevantMemories);
    
    // Load active tool context (working memory)
    const activeToolContexts = await toolContextService.getActiveContexts(conversation.id);
    const toolContextInfo = formatToolContextInfo(activeToolContexts);
    
    // Save user message to database
    const userMsg = await conversationService.addMessage(conversation.id, 'user', message, null);
    
    // Store user message embedding for future semantic search (async, don't wait)
    storeMessageAsMemory(user, message, conversation.id, userMsg.id);
    
    // Lazy load user integrations (multi-tenant: only load for this specific user)
    await ensureUserIntegrationsLoaded(user);
    
    // Get the appropriate AI provider for this model
    const provider = getProviderForModel(selectedModel);
    const mcpConnected = await mcpManager.isUserMCPConnected(user);
    
    let tools = [];
    let systemPrompt = `You are a helpful AI assistant.`;
    const hasMemory = relevantMemories.length > 0;
    
    if (mcpConnected) {
      const integrations = await mcpManager.getUserIntegrations(user);
      
      console.log(`\n📊 Chat request for user: ${user}`);
      console.log(`   Connected integrations: ${integrations.map(i => i.name).join(', ')}`);
      console.log(`   Memory context: ${hasMemory ? 'Yes' : 'No'}`);
      
      // Create a special "list_tools" meta-tool that the AI can call
      // to discover which tools are available for each integration
      const listToolsTool = {
        type: 'function',
        function: {
          name: 'list_tools',
          description: 'List all available tools for a specific integration. Call this first to discover what actions you can perform with each integration.',
          parameters: {
            type: 'object',
            properties: {
              integration: {
                type: 'string',
                description: `The integration to list tools for. Available: ${integrations.map(i => i.type).join(', ')}`,
                enum: integrations.map(i => i.type),
              }
            },
            required: ['integration'],
          },
        },
      };
      
      // Start with only the list_tools meta-tool
      tools = [listToolsTool];
      console.log(`   Starting with list_tools meta-tool only`);
      
      systemPrompt = generateSystemPrompt(integrations, { 
        enableMemory: hasMemory, 
        enableThinking: true 
      });
    } else if (hasMemory) {
      // No integrations but has memory
      systemPrompt = generateSystemPrompt([], { 
        enableMemory: true, 
        enableThinking: false 
      });
    }

    // Get conversation history (last N messages, EXCLUDING the one we just saved)
    const history = await conversationService.getConversationHistory(
      conversation.id,
      appConfig.conversation.historyLimit
    );
    
    console.log(`📜 Got ${history.length} messages from history`);
    if (history.length > 0) {
      console.log(`   Latest history message: [${history[history.length - 1].role}] ${history[history.length - 1].content.substring(0, 50)}...`);
    }
    
    // Initial request to AI (with conversation history and memory context)
    // Filter out the current message since we'll add it separately
    const historyMessages = history
      .filter(m => m.role !== 'system')
      .filter(m => m.content !== message) // Don't duplicate current message
      .map(m => ({
        role: m.role,
        content: m.content
      }));
    
    const messages = [
      { role: 'system', content: systemPrompt + memoryContext + toolContextInfo },
      // Add conversation history (past messages)
      ...historyMessages,
      // Add current user message
      { role: 'user', content: message },
    ];
    
    console.log(`📜 Including ${historyMessages.length} historical messages + current message`);

    // Use provider to handle the chat request
    const aiResponse = await provider.chat(messages, selectedModel, tools, stream || false);

    // Check if AI wants to call tools
    if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
      // Execute tool calls through MCP (pass conversationId for working memory)
      const { results: toolResults, newTools } = await executeToolCalls(user, aiResponse.tool_calls, null, conversation.id);
      
      // Add new tools if any were loaded
      if (newTools.length > 0) {
        tools.push(...newTools);
      }
      
      // Send tool results back to AI for final response
      console.log(`\n🔄 Sending tool results back to AI...`);
      console.log(`   Available tools now: ${tools.length}`);
      
      // Reload tool context after tool execution (may have new context)
      const updatedToolContexts = await toolContextService.getActiveContexts(conversation.id);
      const updatedToolContextInfo = formatToolContextInfo(updatedToolContexts);
      
      const finalMessages = [
        { role: 'system', content: systemPrompt + memoryContext + updatedToolContextInfo },
        { role: 'user', content: message },
        { role: 'assistant', content: aiResponse.content || '', tool_calls: aiResponse.tool_calls || [] },
        ...toolResults,
      ];
      
      // Debug: Log the full conversation being sent
      console.log('\n📤 MESSAGES BEING SENT TO AI:');
      finalMessages.forEach((msg, i) => {
        if (msg.role === 'system') {
          console.log(`   ${i}. [SYSTEM] (${msg.content.length} chars)`);
        } else if (msg.role === 'user') {
          console.log(`   ${i}. [USER] ${msg.content}`);
        } else if (msg.role === 'assistant') {
          console.log(`   ${i}. [ASSISTANT] ${msg.content || '(no content)'}`);
          if (msg.tool_calls && msg.tool_calls.length > 0) {
            console.log(`      Tool calls: ${msg.tool_calls.map(tc => tc.function.name).join(', ')}`);
          }
        } else if (msg.role === 'tool') {
          const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          console.log(`   ${i}. [TOOL: ${msg.name}] ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`);
        }
      });
      
      const finalResponse = await provider.chat(finalMessages, selectedModel, tools, false);
      
      // Debug: Log the AI's response
      console.log('\n📥 AI RESPONSE RECEIVED:');
      console.log(`   Content: ${finalResponse.content?.substring(0, 300)}${finalResponse.content?.length > 300 ? '...' : ''}`);
      if (finalResponse.tool_calls && finalResponse.tool_calls.length > 0) {
        console.log(`   Tool calls requested: ${finalResponse.tool_calls.map(tc => tc.function.name).join(', ')}`);
      }
      
      console.log(`📨 AI final response received`);
      console.log(`   Has tool calls: ${!!finalResponse.tool_calls}`);
      console.log(`   Has usage data: ${!!finalResponse.usage}`);
      if (finalResponse.usage) {
        console.log(`   Usage:`, JSON.stringify(finalResponse.usage));
      }
      
      // Loop until AI sends internal: 1 with actual data or no more tool calls
      let currentResponse = finalResponse;
      
      // Reload tool context for loop (may have been updated)
      const loopToolContexts = await toolContextService.getActiveContexts(conversation.id);
      const loopToolContextInfo = formatToolContextInfo(loopToolContexts);
      
      let conversationMessages = [
        { role: 'system', content: systemPrompt + memoryContext + loopToolContextInfo },
        { role: 'user', content: message },
        { role: 'assistant', content: aiResponse.content || '', tool_calls: aiResponse.tool_calls || [] },
        ...toolResults,
      ];
      let allToolCalls = [...aiResponse.tool_calls.map(tc => tc.function.name)];
      let roundNumber = 2;
      const maxRounds = 10; // Prevent infinite loops
      
      while (roundNumber <= maxRounds) {
        // Check if AI wants to call more tools
        if (currentResponse.tool_calls && currentResponse.tool_calls.length > 0) {
          console.log(`🔧 ROUND ${roundNumber} - AI making additional tool calls: ${currentResponse.tool_calls.map(tc => tc.function.name).join(', ')}`);
          
          // Execute the additional tool calls (pass conversationId for working memory)
          const { results: additionalResults } = await executeToolCalls(user, currentResponse.tool_calls, null, conversation.id);
          
          // Reload tool context after additional tool execution
          const additionalToolContexts = await toolContextService.getActiveContexts(conversation.id);
          const additionalToolContextInfo = formatToolContextInfo(additionalToolContexts);
          
          // Update system prompt with latest tool context
          conversationMessages[0] = { 
            role: 'system', 
            content: systemPrompt + memoryContext + additionalToolContextInfo 
          };
          
          // Add to conversation history
          conversationMessages.push(
            { role: 'assistant', content: currentResponse.content || '', tool_calls: currentResponse.tool_calls || [] },
            ...additionalResults
          );
          
          allToolCalls.push(...currentResponse.tool_calls.map(tc => tc.function.name));
          
          // Debug: Log the full conversation being sent
          console.log(`\n📤 ROUND ${roundNumber + 1} - MESSAGES BEING SENT TO AI:`);
          conversationMessages.forEach((msg, i) => {
            if (msg.role === 'system') {
              console.log(`   ${i}. [SYSTEM] (${msg.content.length} chars)`);
            } else if (msg.role === 'user') {
              console.log(`   ${i}. [USER] ${msg.content}`);
            } else if (msg.role === 'assistant') {
              console.log(`   ${i}. [ASSISTANT] ${msg.content || '(no content)'}`);
              if (msg.tool_calls && msg.tool_calls.length > 0) {
                console.log(`      Tool calls: ${msg.tool_calls.map(tc => tc.function.name).join(', ')}`);
              }
            } else if (msg.role === 'tool') {
              const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
              console.log(`   ${i}. [TOOL: ${msg.name}] ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`);
            }
          });
          
          // Get next response
          currentResponse = await provider.chat(conversationMessages, selectedModel, tools, false);
          
          // Debug: Log the AI's response
          console.log(`\n📥 ROUND ${roundNumber + 1} - AI FINAL RESPONSE:`);
          console.log(`   Content: ${currentResponse.content?.substring(0, 300)}${currentResponse.content?.length > 300 ? '...' : ''}`);
          if (currentResponse.tool_calls && currentResponse.tool_calls.length > 0) {
            console.log(`   Tool calls requested: ${currentResponse.tool_calls.map(tc => tc.function.name).join(', ')}`);
          }
          console.log(`   Has usage data: ${!!currentResponse.usage}`);
          if (currentResponse.usage) {
            console.log(`   Usage:`, JSON.stringify(currentResponse.usage));
          }
          
          // Parse response for internal reasoning
          const parsed = parseAIResponse(currentResponse.content);
          
          // If AI sent internal: 1 with actual data, or no more tool calls, break
          if (!parsed.isInternal || (!currentResponse.tool_calls || currentResponse.tool_calls.length === 0)) {
            console.log(`✅ AI sent final response (internal: ${parsed.isInternal ? 0 : 1})`);
            break;
          }
          
          // Log if AI sent internal reasoning but still wants more tools
          if (parsed.isInternal && currentResponse.tool_calls && currentResponse.tool_calls.length > 0) {
            console.log(`⚠️ AI sent internal reasoning (internal=0), continuing to round ${roundNumber + 2}`);
            console.log(`   Thinking: ${parsed.thinking}`);
            console.log(`   Action: ${parsed.action}`);
          }
          
          roundNumber++;
        } else {
          // No more tool calls, break
          break;
        }
      }
      
      // Parse final response
      const parsed = parseAIResponse(currentResponse.content);
      
      // Log if AI sent internal reasoning
      if (parsed.isInternal) {
        console.log('⚠️ AI sent internal reasoning (internal=0), but no final response');
        console.log('   Thinking:', parsed.thinking);
        console.log('   Action:', parsed.action);
      }
      
      // Only save to database if this is a final response (internal=1)
      if (!parsed.isInternal) {
        const contentToSave = parsed.response || currentResponse.content;
        
        await conversationService.addMessage(
          conversation.id,
          'assistant',
          contentToSave,
          createMessagePayload(parsed, selectedModel, currentResponse.usage, allToolCalls)
        );
        
        // Track token usage
        if (currentResponse.usage) {
          console.log('📊 Tracking token usage:', {
            user,
            model: selectedModel,
            input: currentResponse.usage.input_tokens,
            output: currentResponse.usage.output_tokens,
            total: (currentResponse.usage.input_tokens || 0) + (currentResponse.usage.output_tokens || 0)
          });
          
          try {
            await tokenUsageService.trackUsage(
              user,
              selectedModel,
              currentResponse.usage.input_tokens || 0,
              currentResponse.usage.output_tokens || 0
            );
            
            console.log('✅ Token usage tracked successfully');
          } catch (error) {
            console.error('❌ Error tracking token usage:', error);
          }
        } else {
          console.log('⚠️ No usage data in AI response');
          console.log('   Response keys:', Object.keys(currentResponse));
          console.log('   Full response structure:', JSON.stringify(currentResponse, null, 2).substring(0, 500));
        }
      }
      
      // Format response for UI
      const formatted = formatAIResponse(currentResponse, allToolCalls, relevantMemories);
      
      res.json({ 
        message: formatted.message,
        conversationId: conversation.id,
        mcpEnabled: true,
        toolsUsed: allToolCalls,
        thinking: formatted.thinking
      });
    } else {
      // No tools called, parse response for internal reasoning
      const parsed = parseAIResponse(aiResponse.content);
      
      // Log if AI sent internal reasoning
      if (parsed.isInternal) {
        console.log('⚠️ AI sent internal reasoning (internal=0), but no final response');
        console.log('   Thinking:', parsed.thinking);
        console.log('   Action:', parsed.action);
      }
      
      // Only save to database if this is a final response (internal=1)
      if (!parsed.isInternal) {
        const contentToSave = parsed.response || aiResponse.content;
        
        await conversationService.addMessage(
          conversation.id,
          'assistant',
          contentToSave,
          createMessagePayload(parsed, selectedModel, aiResponse.usage, [])
        );
        
        // Track token usage
        if (aiResponse.usage) {
          console.log('📊 Tracking token usage (no tools):', {
            user,
            model: selectedModel,
            input: aiResponse.usage.input_tokens,
            output: aiResponse.usage.output_tokens,
            total: (aiResponse.usage.input_tokens || 0) + (aiResponse.usage.output_tokens || 0)
          });
          
          try {
            await tokenUsageService.trackUsage(
              user,
              selectedModel,
              aiResponse.usage.input_tokens || 0,
              aiResponse.usage.output_tokens || 0
            );
            
            console.log('✅ Token usage tracked successfully');
          } catch (error) {
            console.error('❌ Error tracking token usage:', error);
          }
        } else {
          console.log('⚠️ No usage data in AI response (no tools)');
          console.log('   aiResponse keys:', Object.keys(aiResponse));
          console.log('   aiResponse.usage:', aiResponse.usage);
        }
      }
      
      // Format response for UI
      const formatted = formatAIResponse(aiResponse, [], relevantMemories);
      
      res.json({ 
        message: formatted.message,
        conversationId: conversation.id,
        mcpEnabled: mcpConnected,
        toolsUsed: [],
        thinking: formatted.thinking
      });
    }
  } catch (error) {
    console.error('❌ Chat endpoint error:', error);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    if (error.response) {
      console.error('   Response data:', error.response.data);
    }
    res.status(500).json({ 
      error: 'Failed to get response from AI',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * Speech-to-text endpoint using Amazon Transcribe (BATCH - NOT REAL-TIME)
 * For real-time transcription, use /api/transcribe/stream WebSocket endpoint
 */
// Error handler for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large',
        details: 'Maximum file size is 10MB'
      });
    }
    return res.status(400).json({ 
      error: 'File upload error',
      details: err.message 
    });
  }
  if (err) {
    return res.status(400).json({ 
      error: 'File validation error',
      details: err.message 
    });
  }
  next();
};

router.post('/transcribe', upload.single('audio'), handleMulterError, async (req, res) => {
  const startTime = Date.now();
  const TIMEOUT_MS = 65000; // 65 seconds - slightly longer than max transcription time
  
  // Set up timeout
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      console.error('⏱️ Request timeout after 65 seconds');
      res.status(504).json({ 
        error: 'Request timeout',
        details: 'Transcription took too long. Please try again with a shorter audio file.'
      });
    }
  }, TIMEOUT_MS);
  
  // Clear timeout when response is sent
  const originalEnd = res.end;
  res.end = function(...args) {
    clearTimeout(timeoutId);
    originalEnd.apply(this, args);
  };
  
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No audio file provided',
        hint: 'Ensure the file is sent as multipart/form-data with field name "audio"'
      });
    }

    console.log('🎤 Transcribing audio file:', {
      filename: req.file.originalname || req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    // Import AWS Transcribe SDK
    const { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');
    const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const { Readable } = require('stream');

    // Initialize AWS clients (uses default credential chain like Bedrock)
    const region = process.env.AWS_REGION || 'us-east-1';
    const s3Bucket = process.env.AWS_TRANSCRIBE_S3_BUCKET || process.env.AWS_S3_BUCKET;
    
    const clientConfig = {
      region: region,
    };
    
    // Only set explicit credentials if env vars are provided
    // Otherwise, SDK will use default credential chain (~/.aws/credentials, IAM role, etc.)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    const transcribeClient = new TranscribeClient(clientConfig);
    const s3Client = new S3Client(clientConfig);

    // Generate unique job name
    const jobName = `transcribe-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const s3Key = `transcriptions/${jobName}.m4a`;

    // Upload audio file to S3 (required by Transcribe)
    if (!s3Bucket) {
      // If no S3 bucket, use synchronous transcription with direct file upload
      // Note: This requires the audio file to be small (< 2MB) and in supported format
      const audioData = fs.readFileSync(req.file.path);
      
      // Use Transcribe Streaming API for real-time transcription (no S3 needed)
      // For now, we'll use a simpler approach: use AWS Transcribe with direct file
      // But Transcribe requires S3, so we'll create a temporary approach
      
      // Alternative: Use Transcribe Streaming (more complex, requires WebSocket)
      // For simplicity, let's use synchronous transcription with a small file
      
      throw new Error('AWS_TRANSCRIBE_S3_BUCKET or AWS_S3_BUCKET environment variable is required. Please set it in your .env file.');
    }

    // Upload to S3
    const audioData = fs.readFileSync(req.file.path);
    await s3Client.send(new PutObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      Body: audioData,
      ContentType: 'audio/m4a',
    }));

    console.log(`✅ Uploaded audio to S3: s3://${s3Bucket}/${s3Key}`);

    // Start transcription job
    const s3Uri = `s3://${s3Bucket}/${s3Key}`;
    const startCommand = new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      Media: { MediaFileUri: s3Uri },
      MediaFormat: 'mp4', // m4a files are treated as mp4 by Transcribe
      LanguageCode: 'en-US', // Can be made configurable
    });

    await transcribeClient.send(startCommand);
    console.log(`✅ Started transcription job: ${jobName}`);

    // Poll for job completion (max 60 seconds)
    // Start with shorter intervals for faster response
    let jobStatus = 'IN_PROGRESS';
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max
    let pollInterval = 500; // Start with 500ms for faster initial response

    while (jobStatus === 'IN_PROGRESS' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      // Increase interval after first few attempts to reduce API calls
      if (attempts > 5) {
        pollInterval = 1000; // 1 second after initial checks
      }
      
      const getCommand = new GetTranscriptionJobCommand({ TranscriptionJobName: jobName });
      const jobResult = await transcribeClient.send(getCommand);
      jobStatus = jobResult.TranscriptionJob?.TranscriptionJobStatus || 'IN_PROGRESS';
      
      attempts++;
      
      if (jobStatus === 'COMPLETED') {
        // Get transcription result from S3
        const transcriptUri = jobResult.TranscriptionJob?.Transcript?.TranscriptFileUri;
        if (!transcriptUri) {
          throw new Error('Transcription completed but no transcript URI found');
        }
        
        console.log(`📋 Transcript URI received: ${transcriptUri}`);

        // Amazon Transcribe provides a PRE-SIGNED HTTPS URL when using service-managed buckets
        // This URL is valid for 15 minutes and should be accessed directly via HTTPS
        // If OutputBucketName was specified, it might be an S3 URI instead
        let transcribedText;
        
        if (transcriptUri.startsWith('https://')) {
          // Pre-signed HTTPS URL - use it directly (no credentials needed, valid for 15 min)
          try {
            console.log(`📥 Fetching transcript via pre-signed HTTPS URL...`);
            const https = require('https');
            
            const transcriptData = await new Promise((resolve, reject) => {
              const request = https.get(transcriptUri, (response) => {
                if (response.statusCode !== 200) {
                  reject(new Error(`Failed to fetch transcript: ${response.statusCode} ${response.statusMessage}`));
                  return;
                }
                
                let data = '';
                response.on('data', (chunk) => {
                  data += chunk;
                });
                response.on('end', () => {
                  try {
                    resolve(JSON.parse(data));
                  } catch (e) {
                    reject(new Error('Failed to parse transcript JSON: ' + e.message));
                  }
                });
              });
              
              request.on('error', (error) => {
                reject(error);
              });
              
              request.setTimeout(15000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
              });
            });
            
            transcribedText = transcriptData.results.transcripts[0].transcript;
            console.log('✅ Successfully fetched transcript via pre-signed URL');
          } catch (httpsError) {
            console.error('❌ Failed to fetch transcript via HTTPS:', httpsError.message);
            throw new Error(`Failed to fetch transcript: ${httpsError.message}. The pre-signed URL may have expired (valid for 15 minutes).`);
          }
        } else if (transcriptUri.startsWith('s3://')) {
          // S3 URI - parse and use S3 GetObject (if OutputBucketName was specified)
          const s3Match = transcriptUri.match(/s3:\/\/([^\/]+)\/(.+)/);
          if (!s3Match) {
            throw new Error('Invalid S3 URI format: ' + transcriptUri);
          }
          
          const transcriptBucket = s3Match[1];
          const transcriptKey = s3Match[2].split('?')[0]; // Remove query params
          
          console.log(`📥 Downloading transcript from S3: s3://${transcriptBucket}/${transcriptKey}`);
          
          const getObjectCommand = new GetObjectCommand({
            Bucket: transcriptBucket,
            Key: transcriptKey,
          });
          
          const transcriptResponse = await s3Client.send(getObjectCommand);
          const transcriptBody = await streamToString(transcriptResponse.Body);
          const transcriptData = JSON.parse(transcriptBody);
          
          transcribedText = transcriptData.results.transcripts[0].transcript;
          console.log('✅ Successfully downloaded transcript from S3');
        } else {
          throw new Error(`Unsupported transcript URI format: ${transcriptUri}`);
        }

        // Clean up: Delete files from S3
        try {
          // Delete the audio file we uploaded
          await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: s3Key }));
          console.log(`✅ Cleaned up audio file from S3: ${s3Key}`);
          
          // Note: We don't delete the transcript from Transcribe's bucket
          // as it's in AWS's managed bucket and will be auto-cleaned by AWS
        } catch (cleanupError) {
          console.warn('⚠️ Failed to cleanup S3 audio file:', cleanupError);
        }

        // Delete local file
        fs.unlinkSync(req.file.path);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ Transcription completed in ${duration}s:`, transcribedText);
        
        if (!res.headersSent) {
          res.json({ text: transcribedText });
        }
        return;
      } else if (jobStatus === 'FAILED') {
        throw new Error(jobResult.TranscriptionJob?.FailureReason || 'Transcription job failed');
      }
    }

    if (jobStatus !== 'COMPLETED') {
      throw new Error('Transcription job timed out');
    }
  } catch (error) {
    // Clear timeout on error
    clearTimeout(timeoutId);
    
    console.error('❌ Transcription error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      duration: ((Date.now() - startTime) / 1000).toFixed(1) + 's',
    });
    
    // Clean up file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.warn('⚠️ Failed to cleanup file:', e.message);
      }
    }
    
    // Determine appropriate status code
    let statusCode = 500;
    if (error.message.includes('required') || error.message.includes('not configured')) {
      statusCode = 400;
    } else if (error.message.includes('timeout')) {
      statusCode = 504;
    } else if (error.message.includes('credentials') || error.message.includes('permission')) {
      statusCode = 403;
    }
    
    // Ensure response hasn't been sent
    if (!res.headersSent) {
      res.status(statusCode).json({ 
        error: 'Failed to transcribe audio',
        details: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    }
  }
});

// Helper function to convert stream to string
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

module.exports = router;


