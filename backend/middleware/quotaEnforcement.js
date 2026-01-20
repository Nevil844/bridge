/**
 * Quota Enforcement Middleware
 * Checks if user has exceeded their credit limit before making LLM calls
 */

const tokenUsageService = require('../db/services/tokenUsage');
const userService = require('../db/services/user');
const { getPlanLimit, getRemainingTokens, getUsagePercentage } = require('../config/planLimits');

/**
 * Middleware to check quota before LLM calls
 * Usage: Add this to routes that call LLM APIs
 * 
 * Example:
 *   app.post('/api/chat', checkQuota, async (req, res) => { ... })
 */
async function checkQuota(req, res, next) {
  try {
    const userId = req.body.userId || req.query.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'User ID is required' 
      });
    }

    // Get lifetime usage (includes credits). Credits do not reset.
    const usage = await tokenUsageService.getLifetimeTotal(userId);
    
    // Get user's plan from database (default to 'free' if not set)
    const user = await userService.getUserById(userId);
    const userPlan = user?.plan || 'free';
    const limit = getPlanLimit(userPlan);
    
    // Use credits for limit checking (cost-based)
    const creditsUsed = usage.creditsUsed || 0;
    
    // Check if over limit based on lifetime usage (no resets)
    if (creditsUsed >= limit) {
      const usagePercentage = getUsagePercentage(creditsUsed, userPlan);
      
      return res.status(429).json({
        error: 'Quota Exceeded',
        message: `You have exceeded your ${userPlan} plan limit of ${limit} credits (lifetime).`,
        usage: {
          used: creditsUsed,
          limit: limit,
          percentage: usagePercentage.toFixed(1),
          plan: userPlan,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        },
        upgradeUrl: '/pricing', // Link to pricing page
      });
    }

    // Attach usage info to request for logging/monitoring
    req.tokenUsage = {
      current: creditsUsed,
      limit: limit,
      remaining: getRemainingTokens(creditsUsed, userPlan),
      percentage: getUsagePercentage(creditsUsed, userPlan),
      plan: userPlan,
      creditsUsed: creditsUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    };

    next();
  } catch (error) {
    console.error('Error checking quota:', error);
    // Allow request to proceed on error (fail-open for better UX)
    // Or fail-closed for stricter enforcement:
    // return res.status(500).json({ error: 'Failed to check quota' });
    next();
  }
}

/**
 * Async version for use in code (not middleware)
 * 
 * Example:
 *   await checkUserQuota(userId, 'pro');
 *   // Throws error if over limit
 */
async function checkUserQuota(userId, plan = 'free') {
  // Use lifetime usage for programmatic checks (no resets)
  const usage = await tokenUsageService.getLifetimeTotal(userId);
  const limit = getPlanLimit(plan);
  
  // Use credits for limit checking
  const creditsUsed = usage.creditsUsed || 0;
  
  if (creditsUsed >= limit) {
    const error = new Error(`Credit limit exceeded for plan ${plan}`);
    error.code = 'QUOTA_EXCEEDED';
    error.usage = {
      used: creditsUsed,
      limit: limit,
      percentage: getUsagePercentage(creditsUsed, plan).toFixed(1),
      plan: plan,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    };
    throw error;
  }
  
  return {
    allowed: true,
    remaining: getRemainingTokens(creditsUsed, plan),
    usage: creditsUsed,
    limit: limit,
    creditsUsed: creditsUsed,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };
}

module.exports = {
  checkQuota,
  checkUserQuota,
};

