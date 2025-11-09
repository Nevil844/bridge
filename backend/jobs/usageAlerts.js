/**
 * Usage Alert Job
 * Background job that checks for users approaching their token limits
 * and sends warnings/notifications
 * 
 * Run this daily via cron or scheduler:
 *   node jobs/usageAlerts.js
 * Or use node-cron in server.js:
 *   cron.schedule('0 0 * * *', () => require('./jobs/usageAlerts').run());
 */

const tokenUsageService = require('../db/services/tokenUsage');
const { getPlanLimit, getWarningLevel, getUsagePercentage } = require('../config/planLimits');
const { getPrismaClient } = require('../db/index');

/**
 * Send usage warning (implement your notification logic here)
 */
async function sendUsageWarning(user, usage, warningLevel) {
  console.log(`📧 Sending ${warningLevel} usage warning to ${user.email || user.username}`);
  console.log(`   Usage: ${usage.totalTokens.toLocaleString()} / ${usage.limit.toLocaleString()} tokens (${usage.percentage.toFixed(1)}%)`);
  
  // TODO: Implement actual notification logic:
  // - Email via SendGrid/AWS SES
  // - Push notification via Firebase/OneSignal
  // - In-app notification
  // - SMS via Twilio
  
  // Example email template:
  const emailData = {
    to: user.email,
    subject: `Usage Alert: ${usage.percentage.toFixed(0)}% of your ${usage.plan} plan used`,
    body: `
      Hi ${user.username},
      
      You've used ${usage.totalTokens.toLocaleString()} out of ${usage.limit.toLocaleString()} tokens this month (${usage.percentage.toFixed(1)}%).
      
      ${warningLevel === 'critical' 
        ? 'You are approaching your monthly limit. Consider upgrading your plan to continue uninterrupted service.' 
        : 'We wanted to let you know about your current usage.'}
      
      Remaining tokens: ${usage.remaining.toLocaleString()}
      
      Upgrade: ${process.env.FRONTEND_URL}/pricing
      
      Thank you!
    `,
  };
  
  // await emailService.send(emailData);
  
  return emailData;
}

/**
 * Check all users and send warnings
 */
async function checkAllUsers() {
  const prisma = getPrismaClient();
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  try {
    console.log(`🔍 Checking usage alerts for month: ${currentMonth}`);
    
    // Get all users with usage this month
    const usageRecords = await prisma.tokenUsage.findMany({
      where: { month: currentMonth },
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
    
    // Group by user and calculate totals
    const userUsageMap = {};
    usageRecords.forEach(record => {
      if (!userUsageMap[record.userId]) {
        userUsageMap[record.userId] = {
          user: record.user,
          totalTokens: 0,
        };
      }
      userUsageMap[record.userId].totalTokens += record.totalTokens;
    });
    
    const alerts = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    
    // Check each user
    for (const [userId, data] of Object.entries(userUsageMap)) {
      const user = data.user;
      const totalTokens = data.totalTokens;
      
      // Get user's plan (you can extend this to fetch from user.plan field)
      const userPlan = 'free'; // TODO: Fetch from user.plan or user metadata
      const limit = getPlanLimit(userPlan);
      const percentage = getUsagePercentage(totalTokens, userPlan);
      const warningLevel = getWarningLevel(percentage / 100);
      
      // Send warnings for medium, high, and critical levels
      if (warningLevel !== 'none' && warningLevel !== 'low') {
        await sendUsageWarning(user, {
          totalTokens,
          limit,
          percentage,
          remaining: Math.max(0, limit - totalTokens),
          plan: userPlan,
        }, warningLevel);
        
        alerts[warningLevel]++;
      }
    }
    
    console.log(`✅ Usage alert check complete`);
    console.log(`   Total users checked: ${Object.keys(userUsageMap).length}`);
    console.log(`   Alerts sent:`, alerts);
    
    return { success: true, alerts };
  } catch (error) {
    console.error('❌ Error checking usage alerts:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Run the job
 */
async function run() {
  console.log('🚀 Starting usage alert job...');
  const result = await checkAllUsers();
  console.log('✅ Usage alert job complete\n');
  return result;
}

// Run if called directly
if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { run, checkAllUsers, sendUsageWarning };

