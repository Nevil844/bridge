const axios = require('axios');

/**
 * OpenRouter AI Provider
 * Paid service with access to multiple premium models
 */
class OpenRouterProvider {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseURL = 'https://openrouter.ai/api/v1';
  }

  /**
   * Get available models (all premium)
   */
  getModels() {
    return [
      { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', tier: 'premium' },
      { id: 'openai/gpt-4', name: 'GPT-4', tier: 'premium' },
      { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', tier: 'premium' },
      { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', tier: 'premium' },
      { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet', tier: 'premium' },
      { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', tier: 'premium' },
      { id: 'google/gemini-pro', name: 'Gemini Pro (OpenRouter)', tier: 'premium' },
      { id: 'meta-llama/llama-3-8b-instruct', name: 'Llama 3 8B', tier: 'premium' },
      { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B', tier: 'premium' },
    ];
  }

  /**
   * Convert tools (already in OpenAI format)
   */
  convertTools(openAITools) {
    return openAITools;
  }

  /**
   * Send chat completion request
   */
  async chat(messages, model, tools = [], stream = false) {
    const requestBody = {
      model: model || 'openai/gpt-3.5-turbo',
      messages,
      stream,
    };

    if (tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    const response = await axios.post(
      `${this.baseURL}/chat/completions`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Bridge AI',
        },
        responseType: stream ? 'stream' : 'json',
      }
    );

    if (stream) {
      // Wrap axios stream in async generator to match Bedrock/Gemini format
      return this.streamOpenRouterResponse(response.data);
    } else {
      return response.data.choices[0].message;
    }
  }

  /**
   * Stream OpenRouter response
   * Returns an async generator that yields chunks in the same format as Bedrock/Gemini
   */
  async *streamOpenRouterResponse(axiosStream) {
    console.log('🌊 streamOpenRouterResponse called, creating async generator for OpenRouter');
    try {
      let fullContent = '';
      let toolCalls = null;
      let buffer = '';

      // Listen to the axios stream (SSE format)
      for await (const chunk of axiosStream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              // Stream complete
              yield {
                type: 'done',
                content: fullContent,
                tool_calls: toolCalls,
                usage: null, // OpenRouter doesn't provide usage in stream
              };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              
              if (delta?.content) {
                fullContent += delta.content;
                // Yield content chunk
                yield {
                  type: 'content',
                  content: delta.content,
                  done: false,
                };
              }
              
              // Check for tool calls
              if (delta?.tool_calls) {
                if (!toolCalls) {
                  toolCalls = [];
                }
                
                for (const tc of delta.tool_calls) {
                  const index = tc.index || 0;
                  if (!toolCalls[index]) {
                    toolCalls[index] = {
                      id: tc.id || `call_${index}`,
                      type: 'function',
                      function: {
                        name: tc.function?.name || '',
                        arguments: '',
                      },
                    };
                  }
                  
                  if (tc.function?.arguments) {
                    toolCalls[index].function.arguments += tc.function.arguments;
                  }
                  if (tc.function?.name) {
                    toolCalls[index].function.name = tc.function.name;
                  }
                }
              }
            } catch (e) {
              console.warn('⚠️  Failed to parse OpenRouter SSE data:', e.message);
            }
          }
        }
      }

      // Final yield if we haven't received [DONE]
      yield {
        type: 'done',
        content: fullContent,
        tool_calls: toolCalls,
        usage: null,
      };
    } catch (error) {
      console.error('❌ OpenRouter streaming error:', error);
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

module.exports = OpenRouterProvider;
