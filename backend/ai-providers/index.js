const GeminiProvider = require('./gemini');
const OpenRouterProvider = require('./openrouter');
const BedrockProvider = require('./bedrock');

/**
 * AI Provider Registry
 * Manages different AI providers (Gemini=Free, OpenRouter=Premium, Bedrock=Premium)
 */
const providers = {
  gemini: GeminiProvider,
  openrouter: OpenRouterProvider,
  bedrock: BedrockProvider,
};

/**
 * Get all available models from ALL providers
 * Returns both free (Gemini) and premium (OpenRouter) models
 */
function getAllModels() {
  const models = [];
  
  // Always include Gemini (free models)
  try {
    const geminiProvider = new GeminiProvider();
    if (geminiProvider.isConfigured()) {
      const geminiModels = geminiProvider.getModels();
      models.push(...geminiModels.map(m => ({ ...m, provider: 'gemini' })));
    }
  } catch (error) {
    console.warn('Gemini provider not configured:', error.message);
  }
  
  // Include OpenRouter (premium models)
  try {
    const openrouterProvider = new OpenRouterProvider();
    if (openrouterProvider.isConfigured()) {
      const openrouterModels = openrouterProvider.getModels();
      models.push(...openrouterModels.map(m => ({ ...m, provider: 'openrouter' })));
    }
  } catch (error) {
    console.warn('OpenRouter provider not configured:', error.message);
  }
  
  // Include Bedrock (premium models)
  // Always include Bedrock models in the list (even if not configured)
  // The UI will handle showing them as unavailable
  try {
    const bedrockProvider = new BedrockProvider();
    const bedrockModels = bedrockProvider.getModels();
    models.push(...bedrockModels.map(m => ({ ...m, provider: 'bedrock' })));
  } catch (error) {
    console.warn('Bedrock provider not configured:', error.message);
  }
  
  // If no providers configured, return default free models
  if (models.length === 0) {
    return [
      { id: 'models/gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'free', provider: 'gemini' },
      { id: 'models/gemini-2.5-pro', name: 'Gemini 2.5 Pro', tier: 'free', provider: 'gemini' },
    ];
  }
  
  return models;
}

/**
 * Get the appropriate provider for a specific model
 */
function getProviderForModel(modelId) {
  // Check which provider has this model
  for (const [name, ProviderClass] of Object.entries(providers)) {
    const provider = new ProviderClass();
    const models = provider.getModels();

    // Direct match
    if (models.some(m => m.id === modelId)) {
      if (!provider.isConfigured()) {
        throw new Error(`${name} is not configured. Check your .env file.`);
      }
      return provider;
    }
  }

  // No provider matched this model explicitly - fail fast so the UI can correct the selection
  throw new Error(`Unknown model id: ${modelId}. Ensure the frontend uses an id from /api/models.`);
}

module.exports = {
  getAllModels,
  getProviderForModel,
  providers,
};
