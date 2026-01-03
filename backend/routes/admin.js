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

module.exports = router;

