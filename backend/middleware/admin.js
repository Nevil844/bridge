/**
 * Admin Middleware
 * SECURITY: Verifies admin access by checking email from authenticated token
 * 
 * This middleware:
 * 1. Requires verifyUser to run first (ensures valid token)
 * 2. Extracts user email from Google OAuth integration
 * 3. Verifies email matches admin email (neviljobanputra34@gmail.com)
 * 4. Only allows access if email matches exactly
 * 
 * SECURITY NOTES:
 * - Email check is case-sensitive and exact match
 * - Token must be valid (verified by verifyUser)
 * - No fallbacks or bypasses
 */

const adminService = require('../db/services/admin');

/**
 * Middleware to verify admin access
 * MUST be used after verifyUser middleware
 * 
 * @example
 * router.get('/admin/dashboard', verifyUser, verifyAdmin, adminController.getDashboard);
 */
async function verifyAdmin(req, res, next) {
  try {
    // Ensure verifyUser ran first (req.user should exist)
    if (!req.user || !req.userId) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'User authentication required before admin verification' 
      });
    }

    // Check if user is admin in database
    const isUserAdmin = await adminService.isAdmin(req.userId);

    if (!isUserAdmin) {
      console.log('Admin access denied:', {
        userId: req.userId,
        email: req.user.email,
      });
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Admin access denied. This endpoint is restricted to administrators only.' 
      });
    }

    // Admin verified - attach admin flag to request
    req.isAdmin = true;
    req.adminEmail = req.user.email;
    
    next();
  } catch (error) {
    console.error('Admin verification error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to verify admin access',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Helper function to check if a user is admin (for use in services)
 * Returns true if user is in admins table
 */
async function isAdmin(userId) {
  try {
    return await adminService.isAdmin(userId);
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

module.exports = {
  verifyAdmin,
  isAdmin,
};

