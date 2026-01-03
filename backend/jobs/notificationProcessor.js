/**
 * Notification Processor Job
 * Background job that processes scheduled notifications
 * 
 * Run this periodically via cron or scheduler:
 *   node jobs/notificationProcessor.js
 * Or use node-cron in server.js (every 5 minutes):
 *   cron.schedule('every 5 minutes', () => require('./jobs/notificationProcessor').run());
 */

const notificationService = require('../db/services/notification');
const notificationSender = require('../services/notificationSender');

/**
 * Process pending notifications
 */
async function processNotifications() {
  try {
    // Get pending notifications that are ready to send
    const pendingNotifications = await notificationService.getPendingNotifications();
    
    if (pendingNotifications.length === 0) {
      return;
    }

    // Process each notification
    for (const notification of pendingNotifications) {
      try {
        const metadata = notification.metadata || {};
        const hasCron = metadata && metadata.cronExpression;
        
        if (hasCron) {
          // For cron notifications, create a new sent notification entry
          // and keep the cron notification as pending for next run
          await notificationSender.sendCronNotification(notification);
        } else {
          // For one-time notifications, send and mark as sent
          await notificationSender.sendNotification(notification);
        }
      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in notification processor:', error);
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

