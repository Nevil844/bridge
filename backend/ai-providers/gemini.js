const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Google Gemini AI Provider
 * Free tier: 15 requests per minute, 1 million tokens per minute
 */
class GeminiProvider {
  constructor() {
    this.apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    this.genAI = new GoogleGenerativeAI(this.apiKey);
  }

  /**
   * Get available models
   */
  getModels() {
    return [
      { id: 'models/gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'free' },
      { id: 'models/gemini-2.5-pro', name: 'Gemini 2.5 Pro', tier: 'free' },
      { id: 'models/gemini-2.0-flash', name: 'Gemini 2.0 Flash', tier: 'free' },
    ];
  }

  /**
   * Convert MCP tools to Gemini function calling format
   * Gemini doesn't accept JSON Schema fields like $schema, additionalProperties
   */
  convertTools(openAITools) {
    if (!openAITools || openAITools.length === 0) return [];

    return openAITools.map(tool => {
      const params = this.cleanSchema(tool.function.parameters);
      return {
        name: tool.function.name,
        description: tool.function.description,
        parameters: params,
      };
    });
  }

  /**
   * Remove JSON Schema fields that Gemini doesn't accept
   * Also resolves $ref references using $defs
   */
  cleanSchema(schema, defs = null) {
    if (!schema || typeof schema !== 'object') {
      return schema;
    }

    // Extract $defs from schema if present (use parent defs if not in this schema)
    const schemaDefs = schema.$defs || defs;
    
    // If this schema has a $ref, resolve it
    if (schema.$ref && schemaDefs) {
      const refPath = schema.$ref;
      // Handle #/$defs/SomeType format
      if (refPath.startsWith('#/$defs/')) {
        const defName = refPath.replace('#/$defs/', '');
        if (schemaDefs[defName]) {
          // Resolve the reference recursively (merge any additional properties)
          const resolved = { ...schemaDefs[defName] };
          // Remove $ref from resolved schema and clean it
          delete resolved.$ref;
          return this.cleanSchema(resolved, schemaDefs);
        }
      }
    }

    const cleaned = { ...schema };
    
    // Remove fields Gemini doesn't accept
    delete cleaned.$schema;
    delete cleaned.additionalProperties;
    delete cleaned.any_of;
    delete cleaned.anyOf;
    delete cleaned.$defs; // Remove $defs after resolving references
    delete cleaned.$ref; // Remove $ref after resolving
    
    // Recursively clean nested objects
    if (cleaned.properties) {
      cleaned.properties = Object.keys(cleaned.properties).reduce((acc, key) => {
        const prop = cleaned.properties[key];
        if (prop && typeof prop === 'object') {
          // Handle nested value objects (like MCP's value structure)
          if (prop.value) {
            // Check if value itself has $ref
            if (prop.value.$ref && schemaDefs) {
              const refPath = prop.value.$ref;
              if (refPath.startsWith('#/$defs/')) {
                const defName = refPath.replace('#/$defs/', '');
                if (schemaDefs[defName]) {
                  // Replace entire prop.value with resolved schema
                  const resolved = { ...schemaDefs[defName] };
                  delete resolved.$ref;
                  acc[key] = {
                    ...prop,
                    value: this.cleanSchema(resolved, schemaDefs)
                  };
                } else {
                  acc[key] = { ...prop, value: this.cleanSchema(prop.value, schemaDefs) };
                }
              } else {
                acc[key] = { ...prop, value: this.cleanSchema(prop.value, schemaDefs) };
              }
            } else {
              acc[key] = { ...prop, value: this.cleanSchema(prop.value, schemaDefs) };
            }
          } else if (prop.$ref && schemaDefs) {
            // Property itself has $ref - resolve it
            const refPath = prop.$ref;
            if (refPath.startsWith('#/$defs/')) {
              const defName = refPath.replace('#/$defs/', '');
              if (schemaDefs[defName]) {
                const resolved = { ...schemaDefs[defName] };
                delete resolved.$ref;
                acc[key] = this.cleanSchema(resolved, schemaDefs);
              } else {
                acc[key] = this.cleanSchema(prop, schemaDefs);
              }
            } else {
              acc[key] = this.cleanSchema(prop, schemaDefs);
            }
          } else {
            acc[key] = this.cleanSchema(prop, schemaDefs);
          }
        } else {
          acc[key] = prop;
        }
        return acc;
      }, {});
    }
    
    // Clean items for arrays
    if (cleaned.items) {
      if (Array.isArray(cleaned.items)) {
        cleaned.items = cleaned.items.map(item => this.cleanSchema(item, schemaDefs));
      } else {
        cleaned.items = this.cleanSchema(cleaned.items, schemaDefs);
      }
    }
    
    // Clean additionalProperties if it's an object schema
    if (cleaned.additionalProperties && typeof cleaned.additionalProperties === 'object') {
      cleaned.additionalProperties = this.cleanSchema(cleaned.additionalProperties, schemaDefs);
    }
    
    // Recursively clean oneOf, anyOf, allOf if present
    if (cleaned.oneOf) {
      cleaned.oneOf = cleaned.oneOf.map(item => this.cleanSchema(item, schemaDefs));
    }
    
    // Convert enum values to strings (Gemini requires all enum values to be strings)
    // AND ensure type is "string" when enum is present (Gemini only allows enum on STRING type)
    if (cleaned.enum && Array.isArray(cleaned.enum)) {
      cleaned.enum = cleaned.enum.map(val => {
        // Convert numbers/booleans to strings, keep strings as-is
        if (typeof val === 'number' || typeof val === 'boolean') {
          return String(val);
        }
        return val;
      });
      
      // Gemini requires enum to be on STRING type only
      // If type is missing or not "string", set it to "string"
      if (!cleaned.type || cleaned.type !== 'string') {
        cleaned.type = 'string';
      }
    }
    
    return cleaned;
  }

  /**
   * Send chat completion request
   */
  async chat(messages, model, tools = [], stream = false) {
    const modelName = model || 'gemini-1.5-flash';
    
    // Configure model with proper settings
    const modelConfig = { 
      model: modelName,
    };
    
    const geminiModel = this.genAI.getGenerativeModel(modelConfig);

    // Convert OpenAI message format to Gemini format
    const systemMessage = messages.find(m => m.role === 'system');
    const systemPrompt = systemMessage?.content || '';
    
    // Build complete chat history with tool calls and responses
    const history = [];
    const pendingToolResponses = [];
    let isFirstMessage = true;
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      if (msg.role === 'system') {
        // System messages are handled separately
        continue;
      }
      
      if (msg.role === 'user') {
        // Prepend system prompt to FIRST user message only
        const content = isFirstMessage ? `${systemPrompt}\n\nUser: ${msg.content}` : msg.content;
        isFirstMessage = false;
        
        history.push({
          role: 'user',
          parts: [{ text: content }],
        });
      } else if (msg.role === 'assistant' || msg.role === 'model') {
        // Assistant/model responses (including tool calls)
        const parts = [];
        
        if (msg.content) {
          parts.push({ text: msg.content });
        }
        
        // Add function calls if present
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          for (const toolCall of msg.tool_calls) {
            const args = JSON.parse(toolCall.function.arguments);
            parts.push({
              functionCall: {
                name: toolCall.function.name,
                args: args,
              },
            });
          }
        }
        
        if (parts.length > 0) {
          history.push({
            role: 'model',
            parts,
          });
        }
      } else if (msg.role === 'tool') {
        // Tool/function responses - collect these separately
        let responseData;
        let isError = false;
        
        try {
          // Try to parse the content
          const parsed = JSON.parse(msg.content);
          
          // Check if this is an error response
          if (parsed.error) {
            isError = true;
            responseData = parsed;
          } else if (parsed.content && Array.isArray(parsed.content) && parsed.content[0]?.text) {
            // Extract the actual data from MCP's response format
            responseData = JSON.parse(parsed.content[0].text);
          } else {
            responseData = parsed;
          }
        } catch {
          responseData = { result: msg.content };
        }
        
        // Store tool response to send as current message
        if (isError) {
          pendingToolResponses.push({
            text: `Tool ${msg.name} returned an error: ${JSON.stringify(responseData.error)}`,
          });
        } else {
          // Gemini expects response to be an object, not an array
          // If responseData is an array, wrap it in an object
          const response = Array.isArray(responseData) 
            ? { data: responseData }
            : responseData;
            
          pendingToolResponses.push({
            functionResponse: {
              name: msg.name,
              response: response,
            },
          });
        }
      }
    }

    // Start chat session with history (excluding pending tool responses)
    const chat = geminiModel.startChat({
      history,
      tools: tools.length > 0 ? [{ functionDeclarations: this.convertTools(tools) }] : undefined,
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    });
    
    // If we have pending tool responses, send them as the current message
    // Otherwise, send empty string to continue
    const currentMessage = pendingToolResponses.length > 0 ? pendingToolResponses : [{ text: '' }];

    if (stream) {
      // Streaming response - wrap in async generator to match Bedrock format
      return this.streamGeminiResponse(chat, currentMessage);
    } else {
      // Non-streaming response
      const result = await chat.sendMessage(currentMessage);
      const response = await result.response;
      const text = response.text();

      // Check for function calls
      const functionCalls = response.functionCalls();
      
      // Extract usage data from Gemini response
      // Gemini uses usageMetadata with promptTokenCount and candidatesTokenCount
      const usageMetadata = response.usageMetadata;
      const usage = usageMetadata ? {
        input_tokens: usageMetadata.promptTokenCount || 0,
        output_tokens: usageMetadata.candidatesTokenCount || 0,
      } : null;
      
      return {
        content: text,
        tool_calls: functionCalls ? functionCalls.map((fc, index) => ({
          id: `call_${index}`,
          type: 'function',
          function: {
            name: fc.name,
            arguments: JSON.stringify(fc.args),
          },
        })) : null,
        usage: usage,
      };
    }
  }

  /**
   * Stream Gemini response
   * Returns an async generator that yields chunks in the same format as Bedrock
   */
  async *streamGeminiResponse(chat, currentMessage) {
    console.log('🌊 streamGeminiResponse called, creating async generator for Gemini');
    try {
      const result = await chat.sendMessageStream(currentMessage);
      
      let fullContent = '';
      let toolCalls = null;
      let usage = null;

      // Iterate through Gemini's stream chunks
      for await (const chunk of result.stream) {
        // Gemini returns chunks with text() method
        const text = chunk.text();
        
        if (text) {
          fullContent += text;
          // Yield content chunk
          yield {
            type: 'content',
            content: text,
            done: false,
          };
        }
        
        // Check for function calls in the chunk
        const functionCalls = chunk.functionCalls && chunk.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
          toolCalls = functionCalls.map((fc, index) => ({
            id: `call_${index}`,
            type: 'function',
            function: {
              name: fc.name,
              arguments: JSON.stringify(fc.args),
            },
          }));
        }
      }

      // Get the final response to extract usage and complete tool calls
      const response = await result.response;
      
      // Extract final function calls if not already captured
      if (!toolCalls) {
        const finalFunctionCalls = response.functionCalls();
        if (finalFunctionCalls && finalFunctionCalls.length > 0) {
          toolCalls = finalFunctionCalls.map((fc, index) => ({
            id: `call_${index}`,
            type: 'function',
            function: {
              name: fc.name,
              arguments: JSON.stringify(fc.args),
            },
          }));
        }
      }
      
      // Extract usage metadata
      const usageMetadata = response.usageMetadata;
      if (usageMetadata) {
        usage = {
          input_tokens: usageMetadata.promptTokenCount || 0,
          output_tokens: usageMetadata.candidatesTokenCount || 0,
        };
      }

      // Yield final done chunk
      yield {
        type: 'done',
        content: fullContent,
        tool_calls: toolCalls,
        usage: usage,
      };
    } catch (error) {
      console.error('❌ Gemini streaming error:', error);
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
    return !!this.apiKey;
  }
}

module.exports = GeminiProvider;
