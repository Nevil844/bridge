/**
 * Plan Limits Configuration
 * Define credit limits for each subscription plan
 * 
 * Credits are cost-based units (1 credit = $0.01)
 * Based on Claude Sonnet 4.5 costs: $0.003/1K input, $0.015/1K output
 */

const PLAN_CREDITS = {
  free: 100,        // 100 credits = $1 worth
  pro: 1000,        // 1000 credits = $10 worth
  power: 3000,      // 3000 credits = $30 worth
  enterprise: 10000, // 10000 credits = $100 worth
};

/**
 * Warning thresholds (percentage of limit)
 */
const WARNING_THRESHOLDS = {
  low: 0.5,      // 50% usage
  medium: 0.75,  // 75% usage
  high: 0.9,     // 90% usage
  critical: 0.95, // 95% usage
};

/**
 * Get credit limit for a plan
 */
function getPlanLimit(plan) {
  return PLAN_CREDITS[plan?.toLowerCase()] || PLAN_CREDITS.free;
}

/**
 * Get warning level based on usage percentage
 */
function getWarningLevel(usagePercentage) {
  if (usagePercentage >= WARNING_THRESHOLDS.critical) return 'critical';
  if (usagePercentage >= WARNING_THRESHOLDS.high) return 'high';
  if (usagePercentage >= WARNING_THRESHOLDS.medium) return 'medium';
  if (usagePercentage >= WARNING_THRESHOLDS.low) return 'low';
  return 'none';
}

/**
 * Calculate remaining credits
 */
function getRemainingTokens(creditsUsed, plan) {
  const limit = getPlanLimit(plan);
  return Math.max(0, limit - creditsUsed);
}

/**
 * Calculate usage percentage
 */
function getUsagePercentage(creditsUsed, plan) {
  const limit = getPlanLimit(plan);
  if (limit === 0) return 0;
  return (creditsUsed / limit) * 100;
}

module.exports = {
  PLAN_CREDITS,
  WARNING_THRESHOLDS,
  getPlanLimit,
  getWarningLevel,
  getRemainingTokens,
  getUsagePercentage,
};

