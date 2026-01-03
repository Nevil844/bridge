/**
 * Notification Routes
 * Handles device token registration and push notification preferences
 */

const express = require('express');
const router = express.Router();
const { verifyUser } = require('../middleware/auth');
const deviceTokenService = require('../db/services/deviceToken');

/**
 * POST /api/notifications/register
 * Register a device token for push notifications
 */
router.post('/register', verifyUser, async (req, res) => {
  try {
    const { token, platform } = req.body;

    if (!token || !platform) {
      return res.status(400).json({ error: 'Token and platform are required' });
    }

    const deviceToken = await deviceTokenService.registerToken(
      req.userId,
      token,
      platform
    );

    res.json({
      success: true,
      deviceToken: {
        id: deviceToken.id,
        platform: deviceToken.platform,
        isActive: deviceToken.isActive,
      },
    });
  } catch (error) {
    console.error('Error registering device token:', error);
    res.status(500).json({ error: error.message || 'Failed to register device token' });
  }
});


module.exports = router;

