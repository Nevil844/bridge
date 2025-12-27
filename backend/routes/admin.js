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
    console.log('Admin dashboard request from:', req.adminEmail);
    const stats = await adminService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    console.error('Error stack:', error.stack);
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
    console.error('Error stack:', error.stack);
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
 * POST /api/admin/approvals/:approvalId/approve
 * Approve a request
 */
router.post('/approvals/:approvalId/approve', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { approvalId } = req.params;
    const result = await adminService.approveRequest(approvalId);
    res.json(result);
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

/**
 * DELETE /api/admin/approvals/:approvalId
 * Remove/reject an approval
 */
router.delete('/approvals/:approvalId', verifyUser, verifyAdmin, async (req, res) => {
  try {
    const { approvalId } = req.params;
    const result = await adminService.removeApproval(approvalId);
    res.json(result);
  } catch (error) {
    console.error('Error removing approval:', error);
    res.status(500).json({ error: 'Failed to remove approval' });
  }
});

module.exports = router;

