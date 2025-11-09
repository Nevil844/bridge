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
const upload = multer({ dest: appConfig.uploads.dest });

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
 * Speech-to-text endpoint
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
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

module.exports = router;

