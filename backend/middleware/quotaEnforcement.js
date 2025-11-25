/**
 * Quota Enforcement Middleware
 * Checks if user has exceeded their token limit before making LLM calls
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

    // Get current month's usage
    const usage = await tokenUsageService.getCurrentMonthTotal(userId);
    
    // Get user's plan from database (default to 'free' if not set)
    const user = await userService.getUserById(userId);
    const userPlan = user?.plan || 'free';
    const limit = getPlanLimit(userPlan);
    
    // Check if over limit
    if (usage.totalTokens >= limit) {
      const usagePercentage = getUsagePercentage(usage.totalTokens, userPlan);
      
      return res.status(429).json({
        error: 'Quota Exceeded',
        message: `You have exceeded your ${userPlan} plan limit of ${limit.toLocaleString()} tokens/month.`,
        usage: {
          used: usage.totalTokens,
          limit: limit,
          percentage: usagePercentage.toFixed(1),
          plan: userPlan,
        },
        upgradeUrl: '/pricing', // Link to pricing page
      });
    }

    // Attach usage info to request for logging/monitoring
    req.tokenUsage = {
      current: usage.totalTokens,
      limit: limit,
      remaining: getRemainingTokens(usage.totalTokens, userPlan),
      percentage: getUsagePercentage(usage.totalTokens, userPlan),
      plan: userPlan,
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
  const usage = await tokenUsageService.getCurrentMonthTotal(userId);
  const limit = getPlanLimit(plan);
  
  if (usage.totalTokens >= limit) {
    const error = new Error(`Token limit exceeded for plan ${plan}`);
    error.code = 'QUOTA_EXCEEDED';
    error.usage = {
      used: usage.totalTokens,
      limit: limit,
      percentage: getUsagePercentage(usage.totalTokens, plan).toFixed(1),
      plan: plan,
    };
    throw error;
  }
  
  return {
    allowed: true,
    remaining: getRemainingTokens(usage.totalTokens, plan),
    usage: usage.totalTokens,
    limit: limit,
  };
}

module.exports = {
  checkQuota,
  checkUserQuota,
};

