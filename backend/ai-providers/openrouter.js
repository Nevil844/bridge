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
      return response.data;
    } else {
      return response.data.choices[0].message;
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
