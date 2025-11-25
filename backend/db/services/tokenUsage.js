/**
 * Token Usage Service
 * Tracks AI token consumption for billing and rate limiting
 */

const { getPrismaClient } = require('../index');
const userService = require('./user');

class TokenUsageService {
  constructor() {
    this.prisma = getPrismaClient();
  }

  /**
   * Track token usage for a request
   */
  async trackUsage(userId, model, inputTokens, outputTokens) {
    // Ensure user exists
    const user = await userService.getOrCreateUser(userId, null);
    
    const month = new Date().toISOString().slice(0, 7); // "2025-01"

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
          increment: inputTokens + outputTokens,
        },
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        month,
        model: model || 'unknown',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
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
      },
    });

    return {
      inputTokens: result._sum.inputTokens || 0,
      outputTokens: result._sum.outputTokens || 0,
      totalTokens: result._sum.totalTokens || 0,
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
   * Check if user is over usage limit
   */
  async isOverLimit(userId, limit) {
    const total = await this.getCurrentMonthTotal(userId);
    return total.totalTokens > limit;
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

