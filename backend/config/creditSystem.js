/**
 * Credit System Configuration
 * Converts token usage to credits based on actual API costs
 * 
 * 1 Credit = $0.01 (1 cent)
 * Credits are calculated from actual API costs and rounded to 2 decimals
 */

const CREDIT_VALUE = 0.01; // $0.01 per credit

/**
 * Model costs per token (Claude Sonnet 4.5 as default)
 * Format: { modelId: { inputCostPerToken, outputCostPerToken } }
 */
const MODEL_COSTS = {
  // Claude models (Anthropic)
  'claude-3-5-sonnet': {
    inputCostPerToken: 0.000003,   // $0.003 per 1K tokens
    outputCostPerToken: 0.000015,  // $0.015 per 1K tokens
  },
  'claude-3-haiku': {
    inputCostPerToken: 0.00000025, // $0.25 per 1M tokens
    outputCostPerToken: 0.00000125, // $1.25 per 1M tokens
  },
  'claude-3-sonnet': {
    inputCostPerToken: 0.000003,   // $3 per 1M tokens
    outputCostPerToken: 0.000015,  // $15 per 1M tokens
  },
  'claude-3-opus': {
    inputCostPerToken: 0.000015,   // $15 per 1M tokens
    outputCostPerToken: 0.000075,  // $75 per 1M tokens
  },
  
  // GPT models (OpenAI via OpenRouter)
  'gpt-3.5-turbo': {
    inputCostPerToken: 0.0000005,  // $0.50 per 1M tokens
    outputCostPerToken: 0.0000015, // $1.50 per 1M tokens
  },
  'gpt-4': {
    inputCostPerToken: 0.00003,    // $30 per 1M tokens
    outputCostPerToken: 0.00006,   // $60 per 1M tokens
  },
  'gpt-4-turbo': {
    inputCostPerToken: 0.00001,    // $10 per 1M tokens
    outputCostPerToken: 0.00003,   // $30 per 1M tokens
  },
  
  // Gemini models (Google)
  'gemini-pro': {
    inputCostPerToken: 0.0000005,  // $0.50 per 1M tokens
    outputCostPerToken: 0.0000015, // $1.50 per 1M tokens
  },
  'gemini-2.5-flash': {
    inputCostPerToken: 0.000000075, // $0.075 per 1M tokens
    outputCostPerToken: 0.0000003,  // $0.30 per 1M tokens
  },
  'gemini-2.5-pro': {
    inputCostPerToken: 0.00000125, // $1.25 per 1M tokens
    outputCostPerToken: 0.000005,  // $5.00 per 1M tokens
  },
};

/**
 * Get default model (Claude Sonnet 4.5)
 */
function getDefaultModel() {
  return 'claude-3-5-sonnet';
}

/**
 * Get cost configuration for a model
 * Falls back to default model if not found
 */
function getModelCosts(modelId) {
  // Normalize model ID (handle variations)
  const normalizedModel = modelId?.toLowerCase() || '';
  
  // Try exact match first
  if (MODEL_COSTS[normalizedModel]) {
    return MODEL_COSTS[normalizedModel];
  }
  
  // Try partial match (e.g., "claude-3-5-sonnet" matches "claude-3-5-sonnet")
  for (const [key, costs] of Object.entries(MODEL_COSTS)) {
    if (normalizedModel.includes(key) || key.includes(normalizedModel)) {
      return costs;
    }
  }
  
  // Default to Claude Sonnet 4.5
  return MODEL_COSTS[getDefaultModel()];
}

/**
 * Calculate credits from token usage
 * Returns credits rounded to 2 decimal places
 * 
 * @param {string} modelId - Model identifier
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @returns {number} Credits used (rounded to 2 decimals)
 */
function calculateCredits(modelId, inputTokens, outputTokens) {
  const costs = getModelCosts(modelId);
  
  // Calculate total cost
  const inputCost = (inputTokens || 0) * costs.inputCostPerToken;
  const outputCost = (outputTokens || 0) * costs.outputCostPerToken;
  const totalCost = inputCost + outputCost;
  
  // Convert to credits and round to 2 decimals
  const credits = totalCost / CREDIT_VALUE;
  return Math.round(credits * 100) / 100; // Round to 2 decimals
}

/**
 * Get credit value (for reference)
 */
function getCreditValue() {
  return CREDIT_VALUE;
}

/**
 * Calculate cost in USD from credits
 */
function creditsToCost(credits) {
  return credits * CREDIT_VALUE;
}

/**
 * Calculate credits from cost in USD
 */
function costToCredits(cost) {
  return Math.round((cost / CREDIT_VALUE) * 100) / 100;
}

module.exports = {
  CREDIT_VALUE,
  MODEL_COSTS,
  getDefaultModel,
  getModelCosts,
  calculateCredits,
  getCreditValue,
  creditsToCost,
  costToCredits,
};

