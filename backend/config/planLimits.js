/**
 * Plan Limits Configuration
 * Define token limits for each subscription plan
 */

const PLAN_LIMITS = {
  free: 200_000,        // 200K tokens/month (~$0.40 with Claude)
  pro: 1_250_000,       // 1.25M tokens/month (~$20/month)
  power: 3_000_000,     // 3M tokens/month (~$48/month)
  enterprise: 10_000_000, // 10M tokens/month (~$160/month)
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
 * Get limit for a plan
 */
function getPlanLimit(plan) {
  return PLAN_LIMITS[plan?.toLowerCase()] || PLAN_LIMITS.free;
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
 * Calculate remaining tokens
 */
function getRemainingTokens(totalUsed, plan) {
  const limit = getPlanLimit(plan);
  return Math.max(0, limit - totalUsed);
}

/**
 * Calculate usage percentage
 */
function getUsagePercentage(totalUsed, plan) {
  const limit = getPlanLimit(plan);
  return (totalUsed / limit) * 100;
}

module.exports = {
  PLAN_LIMITS,
  WARNING_THRESHOLDS,
  getPlanLimit,
  getWarningLevel,
  getRemainingTokens,
  getUsagePercentage,
};

