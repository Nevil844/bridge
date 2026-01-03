/**
 * Notification Processor Job
 * Background job that processes scheduled notifications
 * 
 * Run this periodically via cron or scheduler:
 *   node jobs/notificationProcessor.js
 * Or use node-cron in server.js:
 *   cron.schedule('*/5 * * * *', () => require('./jobs/notificationProcessor').run());
 */

const notificationService = require('../db/services/notification');
const notificationSender = require('../services/notificationSender');

/**
 * Process pending notifications
 */
async function processNotifications() {
  try {
    console.log('🔔 Processing scheduled notifications...');
    
    // Get pending notifications that are ready to send
    const pendingNotifications = await notificationService.getPendingNotifications();
    
    if (pendingNotifications.length === 0) {
      console.log('   No pending notifications to process');
      return;
    }

    console.log(`   Found ${pendingNotifications.length} notification(s) to process`);

    // Process each notification
    for (const notification of pendingNotifications) {
      try {
        console.log(`   Processing notification: ${notification.id} - "${notification.title}"`);
        
        const result = await notificationSender.sendNotification(notification);
        
        console.log(`   ✅ Notification sent: ${result.sent} successful, ${result.failed} failed`);
      } catch (error) {
        console.error(`   ❌ Error processing notification ${notification.id}:`, error);
      }
    }

    console.log('✅ Notification processing complete');
  } catch (error) {
    console.error('❌ Error in notification processor:', error);
    throw error;
  }
}

/**
 * Run the processor (for direct execution)
 */
async function run() {
  try {
    await processNotifications();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// If run directly
if (require.main === module) {
  run();
}

module.exports = {
  run,
  processNotifications,
};

