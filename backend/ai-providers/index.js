const GeminiProvider = require('./gemini');
const OpenRouterProvider = require('./openrouter');

/**
 * AI Provider Registry
 * Manages different AI providers (Gemini=Free, OpenRouter=Premium)
 */
const providers = {
  gemini: GeminiProvider,
  openrouter: OpenRouterProvider,
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
      models.push(...geminiProvider.getModels());
    }
  } catch (error) {
    console.warn('Gemini provider not configured:', error.message);
  }
  
  // Include OpenRouter (premium models)
  try {
    const openrouterProvider = new OpenRouterProvider();
    if (openrouterProvider.isConfigured()) {
      models.push(...openrouterProvider.getModels());
    }
  } catch (error) {
    console.warn('OpenRouter provider not configured:', error.message);
  }
  
  // If no providers configured, return default free models
  if (models.length === 0) {
    return [
      { id: 'models/gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'free' },
      { id: 'models/gemini-2.5-pro', name: 'Gemini 2.5 Pro', tier: 'free' },
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
    
    if (models.some(m => m.id === modelId)) {
      if (!provider.isConfigured()) {
        throw new Error(`${name} is not configured. Check your .env file.`);
      }
      return provider;
    }
  }
  
  // Default to Gemini if model not found
  const gemini = new GeminiProvider();
  if (!gemini.isConfigured()) {
    throw new Error('Gemini is not configured. Add GOOGLE_GEMINI_API_KEY to .env');
  }
  return gemini;
}

module.exports = {
  getAllModels,
  getProviderForModel,
  providers,
};
