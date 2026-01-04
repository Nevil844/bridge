const { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } = require('@aws-sdk/client-bedrock-runtime');

/**
 * AWS Bedrock AI Provider
 * Provides access to various AWS Bedrock models (Claude, Llama, etc.)
 */
class BedrockProvider {
  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    const clientConfig = {
      region: this.region,
    };
    
    if (this.accessKeyId && this.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      };
    }
    
    this.client = new BedrockRuntimeClient(clientConfig);
  }

  /**
   * Get available Bedrock models
   */
  getModels() {
    return [
      { id: 'anthropic.claude-sonnet-4-5-20250929-v1:0', name: 'Claude Sonnet 4.5', tier: 'premium' },
      { id: 'anthropic.claude-sonnet-4-20250514-v1:0', name: 'Claude Sonnet 4', tier: 'premium' },
      { id: 'anthropic.claude-3-5-sonnet-20241022-v2:0', name: 'Claude 3.5 Sonnet', tier: 'premium' },
    ];
  }

  /**
   * Convert OpenAI tools to Bedrock format
   */
  convertTools(openAITools) {
    if (!openAITools || openAITools.length === 0) return [];

    // Anthropic Messages API (InvokeModel) expects plain tool specs, not union wrappers
    return openAITools
      .map((tool, index) => {
        const fn = tool.function || {};
        let name = fn.name || tool.name || `tool_${index}`;
        if (typeof name !== 'string' || name.trim() === '') {
          name = `tool_${index}`;
        }
        const description = fn.description || tool.description || '';
        const params = this.cleanSchema(fn.parameters || tool.parameters || {});
        return {
          name: name.trim(),
          description: description || '',
          // Bedrock Anthropic expects input_schema to be a JSON Schema object
          // e.g., { type: 'object', properties: { ... }, required: [] }
          input_schema: params,
        };
      })
      .filter(t => t.name && t.name.trim() !== '');
  }

  /**
   * Clean schema for Bedrock (remove unsupported fields)
   */
  cleanSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      return { type: 'object', properties: {} };
    }

    const cleaned = {
      type: schema.type || 'object',
      properties: {},
      required: schema.required || [],
    };

    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        if (value && typeof value === 'object') {
          cleaned.properties[key] = {
            type: value.type || 'string',
            description: value.description || '',
          };
          if (value.enum) {
            cleaned.properties[key].enum = value.enum;
          }
        }
      }
    }

    return cleaned;
  }

  /**
   * Convert messages to Bedrock format
   */
  convertMessages(messages) {
    const bedrockMessages = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') continue;
      
      if (msg.role === 'user') {
        // Skip user messages with empty content
        const content = (msg.content || '').trim();
        if (!content) {
          console.warn('⚠️  Skipping user message with empty content');
          continue;
        }
        bedrockMessages.push({
          role: 'user',
          content: content,
        });
      } else if (msg.role === 'assistant') {
        const content = [];
        
        // Only add text content if it's non-empty
        if (msg.content && msg.content.trim()) {
          content.push({ type: 'text', text: msg.content.trim() });
        }
        
        if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
          for (const toolCall of msg.tool_calls) {
            try {
              const args = JSON.parse(toolCall.function.arguments || '{}');
              content.push({
                type: 'tool_use',
                id: toolCall.id || `call_${Date.now()}`,
                name: toolCall.function.name,
                input: args,
              });
            } catch (e) {
              // Skip invalid tool calls
            }
          }
        }
        
        // Skip assistant messages with no content (no text and no tool calls)
        if (content.length === 0) {
          console.warn('⚠️  Skipping assistant message with no content or tool calls');
          continue;
        }
        
        bedrockMessages.push({
          role: 'assistant',
          content: content,
        });
      } else if (msg.role === 'tool') {
        // Skip tool messages with empty content
        const toolContent = (msg.content || '').trim();
        if (!toolContent) {
          console.warn('⚠️  Skipping tool message with empty content');
          continue;
        }
        
        bedrockMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id || 'unknown',
              content: toolContent,
            },
          ],
        });
      }
    }

    return bedrockMessages;
  }

  /**
   * Send chat completion request to Bedrock
   * Returns async generator for streaming, or Promise for non-streaming
   */
  chat(messages, model, tools = [], stream = false) {
    if (!this.client) {
      throw new Error('AWS Bedrock is not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env');
    }

    const modelId = model || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
    const needsRegionPrefix = /^(anthropic\.|meta\.|amazon\.|mistral\.)/i.test(modelId) && !/^us\./i.test(modelId);
    const effectiveModelId = needsRegionPrefix ? `us.${modelId}` : modelId;
    
    const systemMessage = messages.find(m => m.role === 'system');
    const systemPrompt = systemMessage?.content || '';
    const bedrockMessages = this.convertMessages(messages);
    
    const isClaude = modelId.includes('claude') || modelId.includes('anthropic');
    const isLlama = modelId.includes('llama') || modelId.includes('meta');
    const isTitan = modelId.includes('titan');
    const isMistral = modelId.includes('mistral');

    if (isClaude) {
      const requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        messages: bedrockMessages,
      };

      if (systemPrompt) {
        requestBody.system = systemPrompt;
      }

      if (tools.length > 0) {
        const convertedTools = this.convertTools(tools);
        console.log(`🔧 Bedrock: Converting ${tools.length} tools to Bedrock format`);

        if (convertedTools.length === 0) {
          console.warn(`⚠️  Bedrock: All tools were filtered out!`);
        }
        requestBody.tools = convertedTools;
      }

      // Handle streaming for Claude models - return generator directly (not wrapped in Promise)
      if (stream) {
        console.log('🔄 Bedrock: Creating stream generator...');
        const generator = this.streamClaudeResponse(effectiveModelId, requestBody);
        console.log('✅ Bedrock: Generator created, type:', typeof generator, 'has asyncIterator:', typeof generator[Symbol.asyncIterator] === 'function');
        return generator;
      }

      // Non-streaming: return Promise
      return this.chatNonStreaming(effectiveModelId, requestBody, bedrockMessages, systemPrompt, modelId, isLlama, isMistral, isTitan);
    }
    
    // For non-Claude models, always return Promise (no streaming support yet)
    return this.chatNonStreaming(effectiveModelId, null, bedrockMessages, systemPrompt, modelId, isLlama, isMistral, isTitan);
  }

  /**
   * Non-streaming chat completion (internal method)
   */
  async chatNonStreaming(effectiveModelId, requestBody, bedrockMessages, systemPrompt, modelId, isLlama, isMistral, isTitan) {
    if (modelId.includes('claude') || modelId.includes('anthropic')) {
      const response = await this.client.send(new InvokeModelCommand({
        modelId: effectiveModelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      }));

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      const content = responseBody.content
        ?.filter(c => c.type === 'text')
        .map(c => c.text)
        .join('') || '';

      const toolCalls = responseBody.content
        ?.filter(c => c.type === 'tool_use')
        .map((tc, index) => ({
          id: tc.id || `call_${index}`,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.input || {}),
          },
        })) || null;

      // Extract usage data from Bedrock response
      const usage = responseBody.usage ? {
        input_tokens: responseBody.usage.input_tokens || 0,
        output_tokens: responseBody.usage.output_tokens || 0,
      } : null;

      return {
        content,
        tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : null,
        usage: usage,
      };
    } else if (isLlama || isMistral) {
      const requestBody = {
        messages: bedrockMessages,
        temperature: 0.7,
        max_tokens: 4096,
      };

      if (systemPrompt) {
        requestBody.messages.unshift({
          role: 'system',
          content: systemPrompt,
        });
      }

      const response = await this.client.send(new InvokeModelCommand({
        modelId: effectiveModelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      }));

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const content = responseBody.generation || responseBody.content || '';

      // Extract usage data from Bedrock response (Llama/Mistral format may vary)
      const usage = responseBody.usage ? {
        input_tokens: responseBody.usage.input_tokens || responseBody.usage.prompt_tokens || 0,
        output_tokens: responseBody.usage.output_tokens || responseBody.usage.completion_tokens || 0,
      } : null;

      return {
        content,
        tool_calls: null,
        usage: usage,
      };
    } else {
      const requestBody = {
        inputText: bedrockMessages.map(m => `${m.role}: ${m.content}`).join('\n'),
        textGenerationConfig: {
          maxTokenCount: 4096,
          temperature: 0.7,
        },
      };

      if (systemPrompt) {
        requestBody.inputText = `${systemPrompt}\n\n${requestBody.inputText}`;
      }

      const response = await this.client.send(new InvokeModelCommand({
        modelId: effectiveModelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      }));

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const content = responseBody.results?.[0]?.outputText || '';

      // Extract usage data from Bedrock response (Titan format may vary)
      const usage = responseBody.usage ? {
        input_tokens: responseBody.usage.input_tokens || 0,
        output_tokens: responseBody.usage.output_tokens || 0,
      } : null;

      return {
        content,
        tool_calls: null,
        usage: usage,
      };
    }
  }

  /**
   * Stream Claude response from Bedrock
   * Returns an async generator that yields chunks
   */
  async *streamClaudeResponse(modelId, requestBody) {
    console.log('🌊 streamClaudeResponse called, creating async generator');
    try {
      const command = new InvokeModelWithResponseStreamCommand({
        modelId: modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      });

      const response = await this.client.send(command);
      
      if (!response.body) {
        throw new Error('No response body from Bedrock streaming');
      }

      let fullContent = '';
      let toolCalls = [];
      let currentToolCall = null;
      let usage = null;

      // Process the stream
      for await (const event of response.body) {
        if (event.chunk && event.chunk.bytes) {
          const chunkData = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
          
          // Handle different event types from Anthropic Messages API
          if (chunkData.type === 'content_block_start') {
            // Content block started (text or tool_use)
            if (chunkData.content_block?.type === 'tool_use') {
              const toolUse = chunkData.content_block;
              currentToolCall = {
                id: toolUse.id || `call_${toolCalls.length}`,
                type: 'function',
                function: {
                  name: toolUse.name,
                  arguments: '{}',
                },
                input: {},
              };
              toolCalls.push(currentToolCall);
            }
          } else if (chunkData.type === 'content_block_delta') {
            if (chunkData.delta?.text) {
              // Text content delta
              fullContent += chunkData.delta.text;
              yield {
                type: 'content',
                content: chunkData.delta.text,
                done: false,
              };
            } else if (chunkData.delta?.input_json && currentToolCall) {
              // Tool use input delta (partial JSON)
              try {
                const deltaInput = JSON.parse(chunkData.delta.input_json);
                currentToolCall.input = { ...currentToolCall.input, ...deltaInput };
                currentToolCall.function.arguments = JSON.stringify(currentToolCall.input);
              } catch (e) {
                // Ignore JSON parse errors for partial chunks
                console.warn('⚠️  Failed to parse tool input delta:', e.message);
              }
            }
          } else if (chunkData.type === 'content_block_stop') {
            // Content block finished
            currentToolCall = null;
          } else if (chunkData.type === 'message_delta') {
            // Message delta (usage info)
            if (chunkData.usage) {
              usage = {
                input_tokens: chunkData.usage.input_tokens || 0,
                output_tokens: chunkData.usage.output_tokens || 0,
              };
            }
          } else if (chunkData.type === 'message_stop') {
            // Message complete - final yield
            yield {
              type: 'done',
              content: fullContent,
              tool_calls: toolCalls.length > 0 ? toolCalls.map(tc => ({
                id: tc.id,
                type: tc.type,
                function: {
                  name: tc.function.name,
                  arguments: tc.function.arguments,
                },
              })) : null,
              usage: usage,
            };
            return;
          }
        }
      }

      // Final yield with complete data (fallback if message_stop not received)
      yield {
        type: 'done',
        content: fullContent,
        tool_calls: toolCalls.length > 0 ? toolCalls.map(tc => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })) : null,
        usage: usage,
      };
    } catch (error) {
      console.error('❌ Bedrock streaming error:', error);
      yield {
        type: 'error',
        error: error.message,
      };
      throw error;
    }
  }

  /**
   * Check if configured
   */
  isConfigured() {
    return !!this.client;
  }
}

module.exports = BedrockProvider;

