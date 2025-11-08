const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

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
      { id: 'anthropic.claude-sonnet-4-20250514-v1:0', name: 'Claude Sonnet 4', tier: 'premium' },
      { id: 'anthropic.claude-3-5-sonnet-20241022-v2:0', name: 'Claude 3.5 Sonnet', tier: 'premium' },
      { id: 'anthropic.claude-3-opus-20240229-v1:0', name: 'Claude 3 Opus', tier: 'premium' },
      { id: 'anthropic.claude-3-sonnet-20240229-v1:0', name: 'Claude 3 Sonnet', tier: 'premium' },
      { id: 'anthropic.claude-3-haiku-20240307-v1:0', name: 'Claude 3 Haiku', tier: 'premium' },
      { id: 'anthropic.claude-instant-v1', name: 'Claude Instant', tier: 'premium' },
      { id: 'meta.llama3-1-70b-instruct-v1:0', name: 'Llama 3.1 70B', tier: 'premium' },
      { id: 'meta.llama3-1-8b-instruct-v1:0', name: 'Llama 3.1 8B', tier: 'premium' },
      { id: 'amazon.titan-text-premier-v1:0', name: 'Amazon Titan Text Premier', tier: 'premium' },
      { id: 'mistral.mistral-large-2407-v1:0', name: 'Mistral Large', tier: 'premium' },
      { id: 'mistral.mistral-medium-2312-v1:0', name: 'Mistral Medium', tier: 'premium' },
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
        bedrockMessages.push({
          role: 'user',
          content: msg.content || '',
        });
      } else if (msg.role === 'assistant') {
        const content = [];
        
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
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
        
        bedrockMessages.push({
          role: 'assistant',
          content: content.length > 0 ? content : [{ type: 'text', text: '' }],
        });
      } else if (msg.role === 'tool') {
        bedrockMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id || 'unknown',
              content: msg.content || '',
            },
          ],
        });
      }
    }

    return bedrockMessages;
  }

  /**
   * Send chat completion request to Bedrock
   */
  async chat(messages, model, tools = [], stream = false) {
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
        console.log(`   Original tools:`, tools.map(t => ({ 
          type: t.type, 
          name: t.function?.name || t.name || 'unknown',
          hasFunction: !!t.function 
        })));
        console.log(`   Converted tools:`, convertedTools.map(t => ({ 
          name: t.name || 'unknown',
          hasSchema: !!t.input_schema,
          schemaType: t.input_schema?.type || 'object'
        })));
        if (convertedTools.length === 0) {
          console.warn(`⚠️  Bedrock: All tools were filtered out!`);
        }
        requestBody.tools = convertedTools;
      }

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

      return {
        content,
        tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : null,
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

      return {
        content,
        tool_calls: null,
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

      return {
        content,
        tool_calls: null,
      };
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

