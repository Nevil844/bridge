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
   */
  cleanSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      return schema;
    }

    const cleaned = { ...schema };
    
    // Remove fields Gemini doesn't accept
    delete cleaned.$schema;
    delete cleaned.additionalProperties;
    delete cleaned.any_of;
    delete cleaned.anyOf;
    
    // Recursively clean nested objects
    if (cleaned.properties) {
      cleaned.properties = Object.keys(cleaned.properties).reduce((acc, key) => {
        const prop = cleaned.properties[key];
        if (prop.value) {
          // Handle nested value objects
          acc[key] = this.cleanSchema(prop.value);
        } else {
          acc[key] = this.cleanSchema(prop);
        }
        return acc;
      }, {});
    }
    
    // Clean items for arrays
    if (cleaned.items) {
      cleaned.items = this.cleanSchema(cleaned.items);
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
          pendingToolResponses.push({
            functionResponse: {
              name: msg.name,
              response: responseData,
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
      // Streaming response
      const result = await chat.sendMessageStream(currentMessage);
      return result.stream;
    } else {
      // Non-streaming response
      const result = await chat.sendMessage(currentMessage);
      const response = await result.response;
      const text = response.text();

      // Check for function calls
      const functionCalls = response.functionCalls();
      
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
      };
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
