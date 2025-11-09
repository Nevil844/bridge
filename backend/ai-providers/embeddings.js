/**
 * Unified Embedding Service
 * Supports both OpenAI and AWS Bedrock Titan embeddings
 */

const OpenAI = require('openai');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

class EmbeddingService {
  constructor() {
    this.provider = null;
    this.openaiClient = null;
    this.bedrockClient = null;
    this.model = null;
    this.dimensions = 1536; // Default for OpenAI text-embedding-3-small and Titan v1
    this.region = null; // Store region for error logging
    
    this.initialize();
  }

  initialize() {
    // Check for explicit provider preference
    const preferredProvider = process.env.EMBEDDING_PROVIDER?.toLowerCase();
    
    // If explicitly set to 'bedrock', check Bedrock first
    if (preferredProvider === 'bedrock' || !preferredProvider) {
      // Try to initialize Bedrock (uses default credential chain if env vars not set)
      // This matches the BedrockProvider pattern - works with AWS profile/credentials
      this.region = process.env.AWS_REGION || 'us-east-1';
      const clientConfig = {
        region: this.region,
      };
      
      // Only set explicit credentials if env vars are provided
      // Otherwise, SDK will use default credential chain (~/.aws/credentials, IAM role, etc.)
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        clientConfig.credentials = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        };
      }
      
      // Always try to create Bedrock client (will use default credential chain)
      // Errors will surface when we actually try to use it
      this.bedrockClient = new BedrockRuntimeClient(clientConfig);
      this.provider = 'bedrock';
      
      // Titan Embeddings models:
      // - v1: amazon.titan-embed-text-v1 (1536 dims, fixed) - matches database schema but may not be available in all regions
      // - v2: amazon.titan-embed-text-v2:0 (256/512/1024 dims, configurable) - newer, more widely available
      // Default to v2 as it's more widely available across regions
      // To use v1 (if available in your region): set BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v1
      // Note: v2 uses 1024 dimensions (max), while database schema expects 1536 - embeddings will work but may need migration
      const defaultModel = process.env.BEDROCK_EMBEDDING_MODEL || 'amazon.titan-embed-text-v2:0';
      this.model = defaultModel;
      
      // Set dimensions based on model
      if (defaultModel.includes('v2')) {
        // v2 supports 256, 512, or 1024 dimensions
        // Using 1024 (max) - database schema supports 1024 dimensions
        this.dimensions = 1024;
      } else {
        this.dimensions = 1536; // v1 fixed at 1536 - would need database migration to use
        console.warn('⚠️  Using Titan v1 (1536 dims) but database expects 1024. Consider using v2 or migrating database.');
      }
      
      console.log('✅ Embedding service: Using AWS Bedrock', this.model, '(using default credential chain)');
      return;
    }
    
    // Check for OpenAI (fallback or if explicitly requested)
    if (preferredProvider !== 'bedrock' && process.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      this.provider = 'openai';
      this.model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
      this.dimensions = 1536;
      console.log('✅ Embedding service: Using OpenAI', this.model);
      return;
    }

    // If we get here and Bedrock client was created, it's configured
    if (this.bedrockClient) {
      return;
    }

    console.warn('⚠️  No embedding provider configured. Set OPENAI_API_KEY or ensure AWS credentials are available.');
  }

  /**
   * Generate embedding for text
   * @param {string} text - Text to embed
   * @returns {Promise<number[]|null>} - Embedding vector or null if error
   */
  async generateEmbedding(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return null;
    }

    if (this.provider === 'openai' && this.openaiClient) {
      return this.generateOpenAIEmbedding(text);
    }

    if (this.provider === 'bedrock' && this.bedrockClient) {
      return this.generateBedrockEmbedding(text);
    }

    return null;
  }

  /**
   * Generate embedding using OpenAI
   */
  async generateOpenAIEmbedding(text) {
    try {
      const response = await this.openaiClient.embeddings.create({
        model: this.model,
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating OpenAI embedding:', error);
      return null;
    }
  }

  /**
   * Generate embedding using AWS Bedrock Titan
   */
  async generateBedrockEmbedding(text) {
    try {
      // Titan Embeddings API format
      // v1: { inputText: text }
      // v2: { inputText: text, dimensions: 1024, normalize: true }
      const isV2 = this.model.includes('v2');
      const requestBody = isV2 
        ? {
            inputText: text,
            dimensions: this.dimensions, // v2 supports 256, 512, or 1024
            normalize: true, // Unit vector normalization for better similarity
          }
        : {
            inputText: text,
          };

      // Use stored region (set during initialization)
      const region = this.region || 'us-east-1';
      
      // Titan Embeddings model IDs:
      // - v1: amazon.titan-embed-text-v1 (1536 dims, fixed)
      // - v2: amazon.titan-embed-text-v2:0 (256/512/1024 dims, configurable)
      // Model IDs do NOT need region prefix for Bedrock Runtime API
      // The region is handled by the client configuration
      const effectiveModelId = this.model;

      const response = await this.bedrockClient.send(new InvokeModelCommand({
        modelId: effectiveModelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      }));

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      // Titan returns embedding in 'embedding' field
      const embedding = responseBody.embedding;
      
      if (!Array.isArray(embedding)) {
        console.error('Invalid embedding format: expected array, got', typeof embedding);
        return null;
      }

      // Log actual dimensions for debugging (Titan v1 should be 1536, v2 is configurable)
      if (embedding.length !== this.dimensions) {
        console.warn(`⚠️  Embedding dimensions mismatch: expected ${this.dimensions}, got ${embedding.length}. This may cause issues with existing vectors.`);
      }

      return embedding;
    } catch (error) {
      console.error('Error generating Bedrock embedding:', error);
      // Log more details for debugging
      if (error.name === 'ValidationException') {
        const region = this.region || 'unknown';
        console.error(`   Model ID: ${this.model}`);
        console.error(`   Region: ${region}`);
        console.error(`   Error: ${error.message}`);
        console.error(`   💡 Tip: Model '${this.model}' may not be available in region '${region}'`);
        if (this.model.includes('v1')) {
          console.error(`   💡 Tip: Try setting BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v2:0 in your .env`);
          console.error(`   💡 Note: v2 uses 1024 dimensions (vs 1536 for v1) - may need database migration`);
        } else {
          console.error(`   💡 Tip: Check AWS Bedrock console to see which embedding models are available in your region`);
        }
      }
      return null;
    }
  }

  /**
   * Check if embedding service is configured
   */
  isConfigured() {
    return this.provider !== null;
  }

  /**
   * Get current provider info
   */
  getProviderInfo() {
    return {
      provider: this.provider,
      model: this.model,
      dimensions: this.dimensions,
    };
  }
}

// Export singleton instance
const embeddingService = new EmbeddingService();

module.exports = embeddingService;

