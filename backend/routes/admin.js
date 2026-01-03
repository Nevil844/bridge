/**
 * Admin API Routes
 * SECURITY: All routes require verifyUser + verifyAdmin middleware
 * Only accessible to admin email: neviljobanputra34@gmail.com
 */

const express = require('express');
const router = express.Router();
const { verifyUser } = require('../middleware/auth');
const { verifyAdmin } = require('../middleware/admin');
const adminService = require('../db/services/admin');

/**
 * GET /api/admin/dashboard
 * Get admin dashboard statistics
 */
router.get('/dashboard', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard statistics',
      message: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * GET /api/admin/users
 * Get all users with usage statistics
 * Query params:
 * - includeDeleted: Include deleted conversations (default: false)
 */
router.get('/users', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const includeDeleted = req.query.includeDeleted === 'true';
    const users = await adminService.getAllUsers(includeDeleted);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      message: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * GET /api/admin/users/:userId
 * Get detailed user information including all conversations (including deleted)
 */
router.get('/users/:userId', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const userDetails = await adminService.getUserDetails(userId);
    
    if (!userDetails) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userDetails);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

/**
 * PATCH /api/admin/users/:userId/plan
 * Update user's plan
 * Body: { plan: 'free' | 'pro' | 'power' | 'enterprise' }
 */
router.patch('/users/:userId/plan', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { plan } = req.body;

    if (!plan) {
      return res.status(400).json({ error: 'Plan is required' });
    }

    const updatedUser = await adminService.updateUserPlan(userId, plan);
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user plan:', error);
    res.status(500).json({ error: error.message || 'Failed to update user plan' });
  }
});

/**
 * GET /api/admin/approvals
 * Get all pending approvals
 */
router.get('/approvals', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const approvals = await adminService.getApprovals();
    res.json(approvals);
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

/**
 * POST /api/admin/approvals/:waitlistId/approve
 * Approve a waitlist entry (set isInvited to true)
 */
router.post('/approvals/:waitlistId/approve', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { waitlistId } = req.params;
    const result = await adminService.approveRequest(waitlistId);
    res.json(result);
  } catch (error) {
    console.error('Error approving waitlist entry:', error);
    res.status(500).json({ error: error.message || 'Failed to approve waitlist entry' });
  }
});

/**
 * DELETE /api/admin/approvals/:waitlistId
 * Remove/reject an approval (set isInvited to false)
 */
router.delete('/approvals/:waitlistId', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { waitlistId } = req.params;
    const result = await adminService.removeApproval(waitlistId);
    res.json(result);
  } catch (error) {
    console.error('Error removing approval:', error);
    res.status(500).json({ error: error.message || 'Failed to remove approval' });
  }
});

/**
 * GET /api/admin/conversations/:conversationId
 * Get conversation with messages (admin access - bypasses user ownership)
 */
router.get('/conversations/:conversationId', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await adminService.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * POST /api/admin/admins
 * Add a user as admin
 * Body: { userId: string }
 */
router.post('/admins', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Don't allow adding yourself (shouldn't happen, but safety check)
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot add yourself as admin' });
    }

    const admin = await adminService.addAdmin(userId, req.userId);
    res.json(admin);
  } catch (error) {
    console.error('Error adding admin:', error);
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'User is already an admin') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to add admin' });
  }
});

/**
 * DELETE /api/admin/admins/:userId
 * Remove admin privileges from a user
 */
router.delete('/admins/:userId', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Don't allow removing yourself
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot remove your own admin privileges' });
    }

    await adminService.removeAdmin(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing admin:', error);
    if (error.message === 'User is not an admin') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to remove admin' });
  }
});

/**
 * GET /api/admin/admins
 * Get all admins
 */
router.get('/admins', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const admins = await adminService.getAllAdmins();
    res.json(admins);
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

/**
 * GET /api/admin/integrations
 * Get all integration settings
 */
router.get('/integrations', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const settings = await adminService.getIntegrationSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching integration settings:', error);
    res.status(500).json({ error: 'Failed to fetch integration settings' });
  }
});

/**
 * PATCH /api/admin/integrations/:provider
 * Update integration setting (enable/disable)
 * Body: { isEnabled: boolean }
 */
router.patch('/integrations/:provider', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { provider } = req.params;
    const { isEnabled } = req.body;

    if (typeof isEnabled !== 'boolean') {
      return res.status(400).json({ error: 'isEnabled must be a boolean' });
    }

    const setting = await adminService.updateIntegrationSetting(provider, isEnabled);
    res.json(setting);
  } catch (error) {
    console.error('Error updating integration setting:', error);
    res.status(500).json({ error: 'Failed to update integration setting' });
  }
});

/**
 * NOTIFICATION ROUTES
 */

const notificationService = require('../db/services/notification');
const notificationSender = require('../services/notificationSender');

/**
 * GET /api/admin/notifications
 * Get notifications with pagination
 * Query params: skip, take
 */
router.get('/notifications', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const take = parseInt(req.query.take) || 5;
    const notifications = await notificationService.getAllNotifications(skip, take);
    const total = await notificationService.getNotificationsCount();
    res.json({ notifications, total, hasMore: skip + take < total });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/admin/notifications/:id
 * Get notification by ID
 */
router.get('/notifications/:id', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await notificationService.getNotificationById(id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({ error: 'Failed to fetch notification' });
  }
});

/**
 * POST /api/admin/notifications
 * Create a new notification
 */
router.post('/notifications', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const {
      title,
      message,
      type,
      targetType,
      targetValue,
      scheduledFor,
      metadata,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    // If this is a cron notification, calculate the first occurrence
    let finalScheduledFor = scheduledFor;
    const notificationMetadata = metadata || {};
    if (notificationMetadata.cronExpression) {
      try {
        const { CronExpressionParser } = require('cron-parser');
        const interval = CronExpressionParser.parse(notificationMetadata.cronExpression, {
          tz: 'Asia/Kolkata', // IST timezone
        });
        finalScheduledFor = interval.next().toDate();
      } catch (error) {
        console.error('Error parsing cron expression:', error);
        return res.status(400).json({ error: 'Invalid cron expression' });
      }
    }

    const notification = await notificationService.createNotification({
      title,
      message,
      type: 'push', // Only push notifications supported
      targetType: targetType || 'all',
      targetValue,
      scheduledFor: finalScheduledFor,
      createdBy: req.userId,
      metadata,
    });

    // For non-cron notifications: if scheduledFor is null or in the past, send immediately
    // Cron notifications should wait for their scheduled time
    if (!notificationMetadata.cronExpression && (!finalScheduledFor || new Date(finalScheduledFor) <= new Date())) {
      // Send in background (don't wait)
      notificationSender.sendNotification(notification).catch(err => {
        console.error('Error sending notification in background:', err);
      });
    }

    res.json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: error.message || 'Failed to create notification' });
  }
});

/**
 * PATCH /api/admin/notifications/:id
 * Update notification
 */
router.patch('/notifications/:id', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existing = await notificationService.getNotificationById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check if this is a cron notification (schedule) - cron notifications should always be editable
    const existingMetadata = existing.metadata || {};
    const isCronNotification = existingMetadata.cronExpression;
    
    // Allow updating metadata (like cronEnabled) even for sent notifications
    // But restrict other updates for sent/sending notifications (unless it's a cron)
    const isMetadataOnlyUpdate = Object.keys(updateData).length === 1 && updateData.metadata !== undefined;
    
    // Cron notifications are schedules and should always be editable
    if (isCronNotification) {
      // Allow all updates to cron notifications regardless of status
      // Cron notifications are schedules, not messages, so they can always be edited
      // Ensure cron notifications are always 'pending' so they can be picked up by the processor
      if (existing.status !== 'pending') {
        updateData.status = 'pending';
      }
    } else if (!isMetadataOnlyUpdate && (existing.status === 'sent' || existing.status === 'sending')) {
      // For non-cron notifications, block updates if already sent/sending
      return res.status(400).json({ error: 'Cannot update notification that is already sent or sending' });
    }

    // For metadata-only updates on sent notifications (non-cron), only allow cronEnabled changes
    if (!isCronNotification && isMetadataOnlyUpdate && (existing.status === 'sent' || existing.status === 'sending')) {
      const newMetadata = updateData.metadata || {};
      
      // Only allow cronEnabled to be changed, preserve everything else
      const allowedMetadata = {
        ...existingMetadata,
        cronEnabled: newMetadata.cronEnabled,
      };
      
      // Preserve other important metadata fields
      if (existingMetadata.sentUserIds) {
        allowedMetadata.sentUserIds = existingMetadata.sentUserIds;
      }
      
      updateData.metadata = allowedMetadata;
    }

    // If cron expression is being updated, recalculate scheduledFor immediately
    // Merge metadata to preserve existing fields (like cronEnabled, sentUserIds)
    if (updateData.metadata !== undefined) {
      updateData.metadata = {
        ...existingMetadata,
        ...updateData.metadata,
      };
    }
    
    const finalMetadata = updateData.metadata || existingMetadata;
    const newCronExpression = finalMetadata.cronExpression;
    const oldCronExpression = existingMetadata.cronExpression;
    
    // If cron expression changed (or is being set for the first time), recalculate next occurrence
    if (newCronExpression && newCronExpression !== oldCronExpression) {
      try {
        const { CronExpressionParser } = require('cron-parser');
        const now = new Date();
        
        // Parse the new cron expression starting from current time
        const interval = CronExpressionParser.parse(newCronExpression, {
          tz: 'Asia/Kolkata', // IST timezone
          currentDate: now, // Explicitly set current date
        });
        
        // Get the next occurrence
        const nextOccurrence = interval.next().toDate();
        const minutesUntilNext = (nextOccurrence - now) / 1000 / 60;
        
        // If the next occurrence is more than 5 minutes away, check if there was a recent occurrence
        // that should have triggered (e.g., if cron was updated to run more frequently)
        if (minutesUntilNext > 5) {
          // Try to find the previous occurrence to see if we missed one
          try {
            // Go back 1 hour and find all occurrences, then find the last one before now
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const prevInterval = CronExpressionParser.parse(newCronExpression, {
              tz: 'Asia/Kolkata',
              currentDate: oneHourAgo,
            });
            
            let lastOccurrence = prevInterval.next().toDate();
            let currentOccurrence = lastOccurrence;
            
            // Find the last occurrence before now
            while (currentOccurrence < now) {
              lastOccurrence = currentOccurrence;
              currentOccurrence = prevInterval.next().toDate();
              if (currentOccurrence > now) break;
            }
            
            // If the last occurrence was within the last 5 minutes, schedule for immediate execution
            // This handles the case where the cron was updated to run more frequently
            const minutesSinceLast = (now - lastOccurrence) / 1000 / 60;
            if (minutesSinceLast >= 0 && minutesSinceLast <= 5) {
              // Schedule for immediate execution (within next minute so processor picks it up)
              updateData.scheduledFor = new Date(now.getTime() + 30 * 1000); // 30 seconds from now
            } else {
              updateData.scheduledFor = nextOccurrence;
            }
          } catch (e) {
            // Fallback to next occurrence if we can't calculate previous
            updateData.scheduledFor = nextOccurrence;
          }
        } else {
          // Next occurrence is soon (within 5 minutes), use it
          updateData.scheduledFor = nextOccurrence;
        }
      } catch (error) {
        console.error('Error parsing cron expression during update:', error);
        return res.status(400).json({ error: 'Invalid cron expression' });
      }
    }

    const notification = await notificationService.updateNotification(id, updateData);
    res.json(notification);
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: error.message || 'Failed to update notification' });
  }
});

/**
 * DELETE /api/admin/notifications/:id
 * Delete notification
 */
router.delete('/notifications/:id', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await notificationService.getNotificationById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (existing.status === 'sending') {
      return res.status(400).json({ error: 'Cannot delete notification that is currently sending' });
    }

    await notificationService.deleteNotification(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: error.message || 'Failed to delete notification' });
  }
});

/**
 * POST /api/admin/notifications/:id/cancel
 * Cancel a pending notification
 */
router.post('/notifications/:id/cancel', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await notificationService.cancelNotification(id);
    res.json(notification);
  } catch (error) {
    console.error('Error cancelling notification:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel notification' });
  }
});

/**
 * POST /api/admin/notifications/:id/send
 * Manually trigger sending a notification
 */
router.post('/notifications/:id/send', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await notificationService.getNotificationById(id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check if this is a cron notification (schedule)
    const metadata = notification.metadata || {};
    const isCronNotification = metadata.cronExpression;

    // For cron notifications, always allow sending (they're schedules that can fire multiple times)
    if (!isCronNotification) {
      // For regular notifications, check status
      if (notification.status === 'sent') {
        return res.status(400).json({ error: 'Notification has already been sent' });
      }

      if (notification.status === 'sending') {
        return res.status(400).json({ error: 'Notification is currently being sent' });
      }
    }

    // For cron notifications, use sendCronNotification to create a new sent notification entry
    // For regular notifications, use sendNotification
    if (isCronNotification) {
      notificationSender.sendCronNotification(notification).catch(err => {
        console.error('Error sending cron notification:', err);
      });
    } else {
      notificationSender.sendNotification(notification).catch(err => {
        console.error('Error sending notification:', err);
      });
    }

    res.json({ success: true, message: 'Notification sending started' });
  } catch (error) {
    console.error('Error triggering notification send:', error);
    res.status(500).json({ error: error.message || 'Failed to send notification' });
  }
});

module.exports = router;

