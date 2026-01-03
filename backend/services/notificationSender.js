/**
 * Notification Sender Service
 * Handles actual sending of notifications via different channels
 */

const notificationService = require('../db/services/notification');

class NotificationSender {
  /**
   * Send notification to users
   */
  async sendNotification(notification) {
    try {
      // Mark as sending
      await notificationService.markAsSending(notification.id);

      // Get target users
      const targetUsers = await notificationService.getTargetUsers(notification);
      
      if (targetUsers.length === 0) {
        await notificationService.markAsSent(notification.id, 0, 0);
        return { sent: 0, failed: 0, message: 'No target users found' };
      }

      let sentCount = 0;
      let failedCount = 0;

      // Send based on notification type
      const { type } = notification;
      
      if (type === 'email' || type === 'all') {
        const emailResult = await this.sendEmailNotification(notification, targetUsers);
        sentCount += emailResult.sent;
        failedCount += emailResult.failed;
      }

      if (type === 'in_app' || type === 'all') {
        const inAppResult = await this.sendInAppNotification(notification, targetUsers);
        sentCount += inAppResult.sent;
        failedCount += inAppResult.failed;
      }

      if (type === 'push' || type === 'all') {
        const pushResult = await this.sendPushNotification(notification, targetUsers);
        sentCount += pushResult.sent;
        failedCount += pushResult.failed;
      }

      // Mark as sent
      await notificationService.markAsSent(notification.id, sentCount, failedCount);

      return {
        sent: sentCount,
        failed: failedCount,
        total: targetUsers.length,
      };
    } catch (error) {
      console.error('Error sending notification:', error);
      await notificationService.markAsFailed(notification.id, error.message);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(notification, users) {
    let sent = 0;
    let failed = 0;

    const emailSubject = notification.metadata?.subject || notification.title;
    const emailBody = this.formatEmailBody(notification.message, notification.metadata);

    for (const user of users) {
      if (!user.email) {
        failed++;
        continue;
      }

      try {
        // TODO: Implement actual email sending
        // For now, just log it
        console.log(`📧 Email notification to ${user.email}:`);
        console.log(`   Subject: ${emailSubject}`);
        console.log(`   Body: ${emailBody.substring(0, 100)}...`);

        // Example: await emailService.send({
        //   to: user.email,
        //   subject: emailSubject,
        //   html: emailBody,
        // });

        sent++;
      } catch (error) {
        console.error(`Failed to send email to ${user.email}:`, error);
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Send in-app notification
   */
  async sendInAppNotification(notification, users) {
    let sent = 0;
    let failed = 0;

    // TODO: Implement in-app notification storage
    // This could be stored in a UserNotification table or similar
    for (const user of users) {
      if (!user.id) {
        // Skip waitlist entries without user accounts
        continue;
      }

      try {
        // TODO: Store notification in database for user to see
        // await prisma.userNotification.create({
        //   data: {
        //     userId: user.id,
        //     notificationId: notification.id,
        //     title: notification.title,
        //     message: notification.message,
        //     read: false,
        //   },
        // });

        console.log(`📱 In-app notification for user ${user.id}: ${notification.title}`);
        sent++;
      } catch (error) {
        console.error(`Failed to send in-app notification to user ${user.id}:`, error);
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Send push notification
   */
  async sendPushNotification(notification, users) {
    const pushService = require('./pushNotification');
    
    // Filter users with IDs (skip waitlist entries without accounts)
    const usersWithIds = users.filter(u => u.id);
    
    if (usersWithIds.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const userIds = usersWithIds.map(u => u.id);
    
    try {
      const result = await pushService.sendToUsers(
        userIds,
        notification.title,
        notification.message,
        {
          notificationId: notification.id,
          type: 'admin_notification',
          ...notification.metadata,
        }
      );

      return {
        sent: result.sent || 0,
        failed: result.failed || 0,
      };
    } catch (error) {
      console.error('Error sending push notifications:', error);
      return {
        sent: 0,
        failed: usersWithIds.length,
      };
    }
  }

  /**
   * Format email body with HTML
   */
  formatEmailBody(message, metadata = {}) {
    const htmlTemplate = metadata.htmlTemplate || `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #FF9500; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Bridge AI</h1>
            </div>
            <div class="content">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <div class="footer">
              <p>This is an automated message from Bridge AI.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return htmlTemplate.replace('{{message}}', message);
  }
}

module.exports = new NotificationSender();

