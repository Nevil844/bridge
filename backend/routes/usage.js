/**
 * Token Usage API Routes
 * Admin and user-facing endpoints for usage tracking and analytics
 */

const express = require('express');
const router = express.Router();
const tokenUsageService = require('../db/services/tokenUsage');
const userService = require('../db/services/user');
const { getPlanLimit, getRemainingTokens, getUsagePercentage, getWarningLevel } = require('../config/planLimits');

/**
 * GET /api/usage/:userId
 * Get usage details for a specific user (current month)
 * 
 * Response:
 * {
 *   "userId": "user123",
 *   "month": "2025-11",
 *   "inputTokens": 12345,
 *   "outputTokens": 6789,
 *   "totalTokens": 19134,
 *   "plan": "pro",
 *   "limit": 1250000,
 *   "remainingTokens": 1230866,
 *   "usagePercentage": 1.5,
 *   "warningLevel": "none"
 * }
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { month } = req.query; // Optional: specific month (format: "2025-11")

    // Get usage for current or specified month
    const usage = month 
      ? await tokenUsageService.getMonthUsage(userId, month)
      : await tokenUsageService.getCurrentMonthTotal(userId);

    // Get user's plan from database
    const user = await userService.getUserById(userId);
    const userPlan = user?.plan || req.query.plan || 'free';
    const limit = getPlanLimit(userPlan);
    const remaining = getRemainingTokens(usage.totalTokens, userPlan);
    const percentage = getUsagePercentage(usage.totalTokens, userPlan);
    const warningLevel = getWarningLevel(percentage / 100);

    const currentMonth = month || new Date().toISOString().slice(0, 7);

    res.json({
      userId,
      month: currentMonth,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      plan: userPlan,
      limit,
      remainingTokens: remaining,
      usagePercentage: percentage.toFixed(2),
      warningLevel,
      isOverLimit: usage.totalTokens >= limit,
    });
  } catch (error) {
    console.error('Error fetching user usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

/**
 * GET /api/usage/:userId/history
 * Get usage history (last N months)
 * 
 * Query params:
 *   - months: number of months to fetch (default: 6)
 * 
 * Response:
 * {
 *   "userId": "user123",
 *   "history": [
 *     { "month": "2025-11", "totalTokens": 19134, "models": [...] },
 *     { "month": "2025-10", "totalTokens": 45678, "models": [...] }
 *   ]
 * }
 */
router.get('/:userId/history', async (req, res) => {
  try {
    const { userId } = req.params;
    const months = parseInt(req.query.months) || 6;

    const history = await tokenUsageService.getUsageHistory(userId, months);

    // Group by month
    const groupedByMonth = history.reduce((acc, record) => {
      if (!acc[record.month]) {
        acc[record.month] = {
          month: record.month,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          models: [],
        };
      }
      
      acc[record.month].inputTokens += record.inputTokens;
      acc[record.month].outputTokens += record.outputTokens;
      acc[record.month].totalTokens += record.totalTokens;
      acc[record.month].models.push({
        model: record.model,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        totalTokens: record.totalTokens,
      });
      
      return acc;
    }, {});

    const historyArray = Object.values(groupedByMonth).sort((a, b) => 
      b.month.localeCompare(a.month)
    );

    res.json({
      userId,
      history: historyArray,
    });
  } catch (error) {
    console.error('Error fetching usage history:', error);
    res.status(500).json({ error: 'Failed to fetch usage history' });
  }
});

/**
 * GET /api/usage/:userId/by-model
 * Get usage breakdown by model for current month
 * 
 * Response:
 * {
 *   "userId": "user123",
 *   "month": "2025-11",
 *   "models": [
 *     { "model": "claude-sonnet-4", "totalTokens": 12345, "percentage": 64.5 },
 *     { "model": "gemini-2.5-pro", "totalTokens": 6789, "percentage": 35.5 }
 *   ]
 * }
 */
router.get('/:userId/by-model', async (req, res) => {
  try {
    const { userId } = req.params;
    const { month } = req.query;

    const usageByModel = await tokenUsageService.getUsageByModel(userId, month);
    const total = usageByModel.reduce((sum, record) => sum + record.totalTokens, 0);

    const models = usageByModel.map(record => ({
      model: record.model,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      totalTokens: record.totalTokens,
      percentage: total > 0 ? ((record.totalTokens / total) * 100).toFixed(1) : 0,
    }));

    res.json({
      userId,
      month: month || new Date().toISOString().slice(0, 7),
      models,
      totalTokens: total,
    });
  } catch (error) {
    console.error('Error fetching usage by model:', error);
    res.status(500).json({ error: 'Failed to fetch usage by model' });
  }
});

/**
 * GET /api/usage (Admin only)
 * Get all users' usage for current month
 * 
 * Query params:
 *   - month: specific month (optional)
 *   - limit: number of results (default: 50)
 *   - offset: pagination offset (default: 0)
 * 
 * Response:
 * {
 *   "month": "2025-11",
 *   "users": [
 *     { "userId": "user1", "totalTokens": 12345, "plan": "pro", ... },
 *     { "userId": "user2", "totalTokens": 6789, "plan": "free", ... }
 *   ],
 *   "summary": {
 *     "totalUsers": 150,
 *     "totalTokens": 1234567,
 *     "averageTokens": 8230
 *   }
 * }
 */
router.get('/', async (req, res) => {
  try {
    // TODO: Add admin authentication middleware
    // if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { month, limit = 50, offset = 0 } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    // Get all usage records for the month
    const records = await tokenUsageService.prisma.tokenUsage.findMany({
      where: { month: targetMonth },
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    // Group by user
    const userMap = {};
    records.forEach(record => {
      if (!userMap[record.userId]) {
        userMap[record.userId] = {
          userId: record.userId,
          username: record.user.username,
          email: record.user.email,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          models: [],
        };
      }
      
      userMap[record.userId].inputTokens += record.inputTokens;
      userMap[record.userId].outputTokens += record.outputTokens;
      userMap[record.userId].totalTokens += record.totalTokens;
      userMap[record.userId].models.push(record.model);
    });

    const users = Object.values(userMap).sort((a, b) => b.totalTokens - a.totalTokens);
    const totalTokens = users.reduce((sum, user) => sum + user.totalTokens, 0);

    res.json({
      month: targetMonth,
      users,
      summary: {
        totalUsers: users.length,
        totalTokens,
        averageTokens: users.length > 0 ? Math.round(totalTokens / users.length) : 0,
      },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('Error fetching all users usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

module.exports = router;

