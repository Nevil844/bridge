/**
 * Token Usage Service
 * Tracks AI token consumption and credits for billing and rate limiting
 */

const { getPrismaClient } = require('../index');
const userService = require('./user');
const { calculateCredits } = require('../../config/creditSystem');

class TokenUsageService {
  constructor() {
    this.prisma = getPrismaClient();
  }

  /**
   * Track token usage for a request
   * Calculates and stores credits based on actual API costs
   */
  async trackUsage(userId, model, inputTokens, outputTokens) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    const month = new Date().toISOString().slice(0, 7); // "2025-01"
    
    // Calculate credits from token usage
    const credits = calculateCredits(model, inputTokens, outputTokens);
    const totalTokens = inputTokens + outputTokens;

    return await this.prisma.tokenUsage.upsert({
      where: {
        userId_month_model: {
          userId: user.id,
          month,
          model: model || 'unknown',
        },
      },
      update: {
        inputTokens: {
          increment: inputTokens,
        },
        outputTokens: {
          increment: outputTokens,
        },
        totalTokens: {
          increment: totalTokens,
        },
        creditsUsed: {
          increment: credits,
        },
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        month,
        model: model || 'unknown',
        inputTokens,
        outputTokens,
        totalTokens,
        creditsUsed: credits,
      },
    });
  }

  /**
   * Get usage for current month
   */
  async getCurrentMonthUsage(userId) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    const month = new Date().toISOString().slice(0, 7);

    return await this.prisma.tokenUsage.findMany({
      where: {
        userId: user.id,
        month,
      },
    });
  }

  /**
   * Get total usage for current month (all models)
   * Returns both token counts and credits
   */
  async getCurrentMonthTotal(userId) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    const month = new Date().toISOString().slice(0, 7);

    const result = await this.prisma.tokenUsage.aggregate({
      where: {
        userId: user.id,
        month,
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        creditsUsed: true,
      },
    });

    // Convert Decimal to number for credits
    const creditsUsed = result._sum.creditsUsed 
      ? parseFloat(result._sum.creditsUsed.toString()) 
      : 0;

    return {
      inputTokens: result._sum.inputTokens || 0,
      outputTokens: result._sum.outputTokens || 0,
      totalTokens: result._sum.totalTokens || 0,
      creditsUsed: creditsUsed,
    };
  }

  /**
   * Get total usage for a rolling window (all models)
   * Returns both token counts and credits.
   *
   * @param {string} userId - User ID
   * @param {number} days - Number of days to look back (default: 30)
   */
  async getRollingTotal(userId, days = 30) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const result = await this.prisma.tokenUsage.aggregate({
      where: {
        userId: user.id,
        createdAt: {
          gte: since,
        },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        creditsUsed: true,
      },
    });

    const creditsUsed = result._sum.creditsUsed
      ? parseFloat(result._sum.creditsUsed.toString())
      : 0;

    return {
      inputTokens: result._sum.inputTokens || 0,
      outputTokens: result._sum.outputTokens || 0,
      totalTokens: result._sum.totalTokens || 0,
      creditsUsed,
    };
  }

  /**
   * Get total usage for lifetime (all time, all models)
   * Returns both token counts and credits.
   */
  async getLifetimeTotal(userId) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);

    const result = await this.prisma.tokenUsage.aggregate({
      where: {
        userId: user.id,
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        creditsUsed: true,
      },
    });

    const creditsUsed = result._sum.creditsUsed
      ? parseFloat(result._sum.creditsUsed.toString())
      : 0;

    return {
      inputTokens: result._sum.inputTokens || 0,
      outputTokens: result._sum.outputTokens || 0,
      totalTokens: result._sum.totalTokens || 0,
      creditsUsed,
    };
  }

  /**
   * Get usage for specific month
   */
  async getMonthUsage(userId, month) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    return await this.prisma.tokenUsage.findMany({
      where: {
        userId: user.id,
        month,
      },
    });
  }

  /**
   * Get usage history (last N months)
   */
  async getUsageHistory(userId, months = 6) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    return await this.prisma.tokenUsage.findMany({
      where: { userId: user.id },
      orderBy: { month: 'desc' },
      take: months * 10, // Approximate (multiple models per month)
    });
  }

  /**
   * Check if user is over usage limit (based on credits)
   */
  async isOverLimit(userId, limit) {
    // Lifetime usage for limit checks (no resets)
    const total = await this.getLifetimeTotal(userId);
    return total.creditsUsed >= limit;
  }

  /**
   * Get usage by model
   */
  async getUsageByModel(userId, month = null) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    return await this.prisma.tokenUsage.findMany({
      where: {
        userId: user.id,
        month: targetMonth,
      },
      orderBy: {
        totalTokens: 'desc',
      },
    });
  }
}

module.exports = new TokenUsageService();

