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
 * Handle streaming chat response
 */
async function handleStreamingResponse(req, res, provider, messages, selectedModel, tools, conversation, user, message, systemPrompt, memoryContext, toolContextInfo, mcpConnected) {
  try {
    // Set up Server-Sent Events (SSE) headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'start', conversationId: conversation.id })}\n\n`);

    // Get streaming response from provider
    console.log('📡 Requesting stream from provider...');
    const streamResult = provider.chat(messages, selectedModel, tools, true);
    
    // Check if provider returned a stream (async iterable) or a Promise
    const hasAsyncIterator = streamResult && typeof streamResult[Symbol.asyncIterator] === 'function';
    const isPromise = streamResult && typeof streamResult.then === 'function';
    console.log(`🔍 Stream check: hasAsyncIterator=${hasAsyncIterator}, isPromise=${isPromise}, type=${typeof streamResult}, constructor=${streamResult?.constructor?.name}`);
    
    // If it's a promise, await it first to see if it resolves to a generator
    let stream = streamResult;
    if (isPromise) {
      console.log('⏳ Result is a Promise, awaiting...');
      const resolved = await streamResult;
      console.log(`✅ Promise resolved, type=${typeof resolved}, hasAsyncIterator=${resolved && typeof resolved[Symbol.asyncIterator] === 'function'}`);
      stream = resolved;
    }
    
    // Check again after awaiting Promise (if it was one)
    const finalHasAsyncIterator = stream && typeof stream[Symbol.asyncIterator] === 'function';
    if (!finalHasAsyncIterator) {
      // Provider doesn't support streaming, fall back to non-streaming
      console.log('⚠️  Provider does not support streaming, falling back to non-streaming');
      const aiResponse = stream; // stream is already the response (not a generator)
      
      // Ensure we have content before saving
      const content = aiResponse?.content || '';
      if (!content) {
        console.error('❌ No content in response:', aiResponse);
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'No content received from AI' })}\n\n`);
        res.end();
        return;
      }
      
      // Handle as regular response
      const parsed = parseAIResponse(content);
      if (!parsed.isInternal) {
        await conversationService.addMessage(
          conversation.id,
          'assistant',
          parsed.response || content,
          createMessagePayload(parsed, selectedModel, aiResponse.usage, [])
        );
        
        if (aiResponse.usage) {
          await tokenUsageService.trackUsage(
            user,
            selectedModel,
            aiResponse.usage.input_tokens || 0,
            aiResponse.usage.output_tokens || 0
          );
        }
      }
      
      const formatted = formatAIResponse(aiResponse, [], []);
      res.write(`data: ${JSON.stringify({ 
        type: 'done', 
        message: formatted.message,
        thinking: formatted.thinking,
        conversationId: conversation.id,
        mcpEnabled: mcpConnected,
        toolsUsed: []
      })}\n\n`);
      res.end();
      return;
    }
    
    let fullContent = '';
    let isJsonResponse = false; // Track if we're receiving JSON
    let toolCalls = null;
    let usage = null;
    let hasError = false;
    let lastParsedIndex = 0; // Track where we last successfully parsed JSON
    let processedThinkingObjects = new Set(); // Track which thinking objects we've already sent
    let hasShownThinking = false; // Track if we've shown any thinking already
    const { parseAIResponse } = require('../utils/responseParser');

    // Process streaming chunks
    console.log('🌊 Starting to process stream chunks...');
    try {
      // Try to iterate the stream - this will fail if it's not an async iterable
      const iterator = stream[Symbol.asyncIterator]();
      console.log('✅ Got iterator, starting iteration...');
      
      while (true) {
        const { done, value: chunk } = await iterator.next();
        if (done) {
          console.log('✅ Iterator done');
          break;
        }
        
        console.log(`📦 Received chunk type: ${chunk?.type}`);
        if (chunk?.type === 'error') {
          hasError = true;
          res.write(`data: ${JSON.stringify({ type: 'error', error: chunk.error })}\n\n`);
          break;
        } else if (chunk.type === 'content') {
          // Send content chunk to client
          fullContent += chunk.content;
          
          // Detect if this is a JSON response
          if (!isJsonResponse) {
            const trimmedStart = fullContent.trimStart();
            isJsonResponse = trimmedStart.startsWith('{') || trimmedStart.startsWith('```json');
            if (isJsonResponse) {
              console.log('🔍 Detected JSON response, will extract response field');
            }
          }
          
          // If it's JSON, try to detect and send thinking events in real-time
          if (isJsonResponse) {
            // Try to find complete JSON objects in the buffered content
            // Look for JSON objects that end with } or are in markdown code blocks
            let searchStart = lastParsedIndex;
            
            while (true) {
              // Try to find a complete JSON object from searchStart
              // First, try to find JSON in markdown code blocks
              const codeBlockMatch = fullContent.slice(searchStart).match(/```json\s*\n([\s\S]*?)\n```/);
              if (codeBlockMatch) {
                const jsonStr = codeBlockMatch[1];
                const objectStart = searchStart + fullContent.slice(searchStart).indexOf('```json');
                const objectEnd = objectStart + codeBlockMatch[0].length;
                const objectKey = `${objectStart}-${objectEnd}`;
                
                if (!processedThinkingObjects.has(objectKey)) {
                  // Just mark as processed, don't send thinking yet
                  // We'll send it properly after 'done' chunk with full tool call info
                  processedThinkingObjects.add(objectKey);
                  lastParsedIndex = Math.max(lastParsedIndex, objectEnd);
                }
                
                searchStart = objectEnd;
                continue;
              }
              
              // Try to find standalone JSON objects (starting with { and ending with })
              // We need to find balanced braces
              let braceCount = 0;
              let jsonStart = -1;
              
              for (let i = searchStart; i < fullContent.length; i++) {
                if (fullContent[i] === '{') {
                  if (braceCount === 0) {
                    jsonStart = i;
                  }
                  braceCount++;
                } else if (fullContent[i] === '}') {
                  braceCount--;
                  if (braceCount === 0 && jsonStart >= 0) {
                    // Found a complete JSON object
                    const jsonStr = fullContent.slice(jsonStart, i + 1);
                    const objectKey = `${jsonStart}-${i + 1}`;
                    
                    if (!processedThinkingObjects.has(objectKey)) {
                      // Just mark as processed, don't send thinking yet
                      // We'll send it properly after 'done' chunk with full tool call info
                      processedThinkingObjects.add(objectKey);
                      lastParsedIndex = Math.max(lastParsedIndex, i + 1);
                    }
                    
                    searchStart = i + 1;
                    break;
                  }
                }
              }
              
              // If we didn't find a complete object, break and wait for more content
              if (braceCount !== 0 || jsonStart === -1) {
                break;
              }
            }
            
            continue;
          }
          
          // Not JSON - just accumulate for final response (no chat streaming until final)
          console.log(`📝 Accumulating chunk (${chunk.content.length} chars)...`);
        } else if (chunk.type === 'done') {
          // Final chunk with complete data
          fullContent = chunk.content || fullContent;
          toolCalls = chunk.tool_calls;
          usage = chunk.usage;

          // Parse the full content to extract clean response (handles JSON format)
          const parsedContent = parseAIResponse(fullContent);
          const cleanContent = parsedContent.response || fullContent;
          
          // DON'T send chat chunks if this is internal reasoning (internal: 0)
          // Only send if internal: 1 (final response to user)
          if (isJsonResponse && cleanContent !== fullContent && !parsedContent.isInternal) {
            // We have clean content from JSON and it's a final response - send it
            console.log(`📝 Sending complete response from JSON (${cleanContent.length} chars)`);
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: cleanContent })}\n\n`);
          }
          
          // Update fullContent with clean version
          fullContent = cleanContent;

          if (toolCalls && toolCalls.length > 0) {
            console.log(`⚠️  Tool calls detected in streaming response - executing before finalizing response`);
            
            // Send thinking event with full context (thinking, action, tools)
            if (!hasShownThinking) {
              res.write(`data: ${JSON.stringify({ 
                type: 'thinking',
                thinking: {
                  thinking: parsedContent.thinking || '',
                  action: parsedContent.action || '',
                  toolCalls: toolCalls.map(tc => tc.function.name)
                }
              })}\n\n`);
              hasShownThinking = true;
            }
            
            const { results: toolResults } = await executeToolCalls(user, toolCalls, null, conversation.id);
            
            // Reset for next round of tool calls
            hasShownThinking = false;

            const noActiveDeviceError = toolResults.some(result => {
              if (!result || !result.content) return false;
              try {
                const parsed = typeof result.content === 'string' ? JSON.parse(result.content) : result.content;
                if (parsed?.isError && Array.isArray(parsed.content)) {
                  return parsed.content.some(item => typeof item.text === 'string' && item.text.includes('NO_ACTIVE_DEVICE'));
                }
                if (parsed?.error && typeof parsed.error === 'string' && parsed.error.includes('NO_ACTIVE_DEVICE')) {
                  return true;
                }
                const textContent = parsed?.content;
                if (Array.isArray(textContent)) {
                  return textContent.some(item => typeof item.text === 'string' && item.text.includes('NO_ACTIVE_DEVICE'));
                }
              } catch (e) {
                return false;
              }
              return false;
            });

            if (noActiveDeviceError) {
              const deviceMessage = 'Spotify could not play because no active device was found. Please open Spotify on one of your devices and try again, then ask me once more.';
              
              res.write(`data: ${JSON.stringify({ 
                type: 'done', 
                message: deviceMessage,
                conversationId: conversation.id,
                mcpEnabled: mcpConnected,
                toolsUsed: toolCalls.map(tc => tc.function.name)
              })}\n\n`);
              res.end();
              return;
            }
            
            // Summarize list_tools results to keep context size manageable
            const summarizedInitialResults = toolResults.map(result => {
              if (result.name === 'list_tools') {
                try {
                  const parsed = JSON.parse(result.content);
                  return {
                    ...result,
                    content: JSON.stringify({
                      integration: parsed.integration,
                      count: parsed.count,
                      message: `${parsed.count} tools loaded for ${parsed.integration}`
                    })
                  };
                } catch (e) {
                  return result;
                }
              }
              return result;
            });
            
            let conversationMessages = [
              { role: 'system', content: systemPrompt + memoryContext + toolContextInfo },
              { role: 'user', content: message },
              { role: 'assistant', content: fullContent, tool_calls: toolCalls },
              ...summarizedInitialResults,
            ];
            
            let currentResponse = await provider.chat(conversationMessages, selectedModel, tools, false);
            let allToolCalls = [...toolCalls.map(tc => tc.function.name)];
            let roundNumber = 2;
            const maxRounds = 10;
            
            // Loop to handle multiple rounds of tool calls
            while (roundNumber <= maxRounds) {
              const parsedResponse = parseAIResponse(currentResponse.content);
              
              // Check if AI wants to call more tools
              if (currentResponse.tool_calls && currentResponse.tool_calls.length > 0) {
                console.log(`🔧 Round ${roundNumber}: ${currentResponse.tool_calls.map(tc => tc.function.name).join(', ')}`);
                
                // Send thinking event for this round
                res.write(`data: ${JSON.stringify({ 
                  type: 'thinking',
                  thinking: {
                    thinking: parsedResponse.thinking || '',
                    action: parsedResponse.action || '',
                    toolCalls: currentResponse.tool_calls.map(tc => tc.function.name)
                  }
                })}\n\n`);
                
                // Execute the additional tool calls
                const { results: additionalResults } = await executeToolCalls(user, currentResponse.tool_calls, null, conversation.id);
                
                // Reload tool context
                const additionalToolContexts = await toolContextService.getActiveContexts(conversation.id);
                const additionalToolContextInfo = formatToolContextInfo(additionalToolContexts);
                
                // Update system prompt with latest tool context
                conversationMessages[0] = { 
                  role: 'system', 
                  content: systemPrompt + memoryContext + additionalToolContextInfo 
                };
                
                // Filter/summarize tool results to keep context size manageable
                const summarizedResults = additionalResults.map(result => {
                  if (result.name === 'list_tools') {
                    // list_tools returns massive tool definitions - summarize it
                    try {
                      const parsed = JSON.parse(result.content);
                      return {
                        ...result,
                        content: JSON.stringify({
                          integration: parsed.integration,
                          count: parsed.count,
                          message: `${parsed.count} tools loaded for ${parsed.integration}`
                        })
                      };
                    } catch (e) {
                      return result;
                    }
                  }
                  return result;
                });
                
                // Add to conversation history
                conversationMessages.push(
                  { role: 'assistant', content: currentResponse.content || '', tool_calls: currentResponse.tool_calls || [] },
                  ...summarizedResults
                );
                
                allToolCalls.push(...currentResponse.tool_calls.map(tc => tc.function.name));
                
                // Get next response
                currentResponse = await provider.chat(conversationMessages, selectedModel, tools, false);
                roundNumber++;
              } else {
                // No more tool calls, this is the final response
                break;
              }
            }
            
            // Send final response
            const parsedFinal = parseAIResponse(currentResponse.content);
            const finalCleanContent = parsedFinal.response || currentResponse.content;

            if (!parsedFinal.isInternal) {
              await conversationService.addMessage(
                conversation.id,
                'assistant',
                finalCleanContent,
                createMessagePayload(parsedFinal, selectedModel, currentResponse.usage, allToolCalls)
              );
              
              if (currentResponse.usage) {
                await tokenUsageService.trackUsage(
                  user,
                  selectedModel,
                  currentResponse.usage.input_tokens || 0,
                  currentResponse.usage.output_tokens || 0
                );
              }
            }

            res.write(`data: ${JSON.stringify({ 
              type: 'done', 
              message: finalCleanContent,
              conversationId: conversation.id,
              mcpEnabled: mcpConnected,
              toolsUsed: allToolCalls
            })}\n\n`);
            res.end();
            return;
          }

          // No tool calls - send final response if not internal
          if (!parsedContent.isInternal) {
            await conversationService.addMessage(
              conversation.id,
              'assistant',
              fullContent,
              createMessagePayload(parsedContent, selectedModel, usage, [])
            );
            
            if (usage) {
              await tokenUsageService.trackUsage(
                user,
                selectedModel,
                usage.input_tokens || 0,
                usage.output_tokens || 0
              );
            }
          }

          res.write(`data: ${JSON.stringify({ 
            type: 'done', 
            message: parsedContent.isInternal ? '' : fullContent,
            thinking: parsedContent.isInternal ? {
              isInternal: parsedContent.isInternal,
              thinking: parsedContent.thinking || '',
              action: parsedContent.action || '',
              toolCalls: parsedContent.toolCalls || [],
              data: parsedContent.data || null
            } : undefined,
            conversationId: conversation.id,
            mcpEnabled: mcpConnected,
            toolsUsed: []
          })}\n\n`);
          res.end();
          return;
        }
      }
    } catch (streamError) {
      console.error('❌ Error processing stream:', streamError);
      hasError = true;
      res.write(`data: ${JSON.stringify({ type: 'error', error: streamError.message })}\n\n`);
    }

    // If we get here without a 'done' event, send what we have
    if (!hasError && fullContent) {
      const parsedFallback = parseAIResponse(fullContent);
      
      if (!parsedFallback.isInternal) {
        await conversationService.addMessage(
          conversation.id,
          'assistant',
          parsedFallback.response || fullContent,
          createMessagePayload(parsedFallback, selectedModel, usage, [])
        );
        
        if (usage) {
          await tokenUsageService.trackUsage(
            user,
            selectedModel,
            usage.input_tokens || 0,
            usage.output_tokens || 0
          );
        }
      }

      // Use the clean content, not formatted (which might have JSON)
      const finalMessage = parsedFallback.response || fullContent;
      res.write(`data: ${JSON.stringify({ 
        type: 'done', 
        message: finalMessage,
        thinking: parsedFallback.isInternal ? {
          isInternal: parsedFallback.isInternal,
          thinking: parsedFallback.thinking || '',
          action: parsedFallback.action || '',
          toolCalls: [],
          data: parsedFallback.data
        } : undefined,
        conversationId: conversation.id,
        mcpEnabled: mcpConnected,
        toolsUsed: []
      })}\n\n`);
    }
    
    res.end();
  } catch (error) {
    console.error('❌ Streaming error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Streaming failed', details: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
}

/**
 * Chat completion endpoint with per-user MCP integration
 */
router.post('/', checkQuota, async (req, res) => {
  try {
    const { message, model, userId, conversationId, stream } = req.body;
    console.log('📥 Chat request received:', { 
      hasMessage: !!message, 
      model, 
      userId, 
      conversationId, 
      stream: stream !== undefined ? stream : 'undefined (defaults to false)' 
    });

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
      
      console.log(`📊 User: ${user}, Integrations: ${integrations.map(i => i.name).join(', ')}, Memory: ${hasMemory ? 'Yes' : 'No'}`);
      
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

    // Handle streaming responses
    if (stream) {
      console.log('🔄 Streaming enabled, calling handleStreamingResponse');
      return handleStreamingResponse(req, res, provider, messages, selectedModel, tools, conversation, user, message, systemPrompt, memoryContext, toolContextInfo, mcpConnected);
    }

    // Use provider to handle the chat request (non-streaming)
    const aiResponse = await provider.chat(messages, selectedModel, tools, false);

    // Check if AI wants to call tools
    if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
      // Execute tool calls through MCP (pass conversationId for working memory)
      const { results: toolResults, newTools } = await executeToolCalls(user, aiResponse.tool_calls, null, conversation.id);
      
      // Add new tools if any were loaded
      if (newTools.length > 0) {
        tools.push(...newTools);
      }
      
      // Reload tool context after tool execution (may have new context)
      const updatedToolContexts = await toolContextService.getActiveContexts(conversation.id);
      const updatedToolContextInfo = formatToolContextInfo(updatedToolContexts);
      
      const finalMessages = [
        { role: 'system', content: systemPrompt + memoryContext + updatedToolContextInfo },
        { role: 'user', content: message },
        { role: 'assistant', content: aiResponse.content || '', tool_calls: aiResponse.tool_calls || [] },
        ...toolResults,
      ];
      
      const finalResponse = await provider.chat(finalMessages, selectedModel, tools, false);
      
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
          console.log(`🔧 Round ${roundNumber}: ${currentResponse.tool_calls.map(tc => tc.function.name).join(', ')}`);
          
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
          
          // Get next response
          currentResponse = await provider.chat(conversationMessages, selectedModel, tools, false);
          
          // Parse response for internal reasoning
          const parsed = parseAIResponse(currentResponse.content);
          
          // If AI sent internal: 1 with actual data, or no more tool calls, break
          if (!parsed.isInternal || (!currentResponse.tool_calls || currentResponse.tool_calls.length === 0)) {
            break;
          }
          
          roundNumber++;
        } else {
          // No more tool calls, break
          break;
        }
      }
      
      // Parse final response
      const parsed = parseAIResponse(currentResponse.content);
      
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
          try {
            await tokenUsageService.trackUsage(
              user,
              selectedModel,
              currentResponse.usage.input_tokens || 0,
              currentResponse.usage.output_tokens || 0
            );
          } catch (error) {
            console.error('❌ Error tracking token usage:', error);
          }
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
          try {
            await tokenUsageService.trackUsage(
              user,
              selectedModel,
              aiResponse.usage.input_tokens || 0,
              aiResponse.usage.output_tokens || 0
            );
          } catch (error) {
            console.error('❌ Error tracking token usage:', error);
          }
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


