/**
 * Integration API Routes
 * RESTful endpoints for user integrations (OAuth, API keys)
 */

const express = require('express');
const router = express.Router();
const integrationService = require('../db/services/integration');

/**
 * GET /api/user-integrations
 * Get all active integrations for a user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId || 'default-user';
    const integrations = await integrationService.getUserIntegrations(userId);
    
    // Don't expose full credentials in list view
    const sanitized = integrations.map(int => ({
      id: int.id,
      provider: int.provider,
      isActive: int.isActive,
      metadata: int.metadata,
      createdAt: int.createdAt,
      updatedAt: int.updatedAt,
    }));

    res.json(sanitized);
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

/**
 * GET /api/user-integrations/:provider
 * Get specific integration with credentials
 */
router.get('/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.query.userId || 'default-user';

    const integration = await integrationService.getIntegration(userId, provider);
    
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json(integration);
  } catch (error) {
    console.error('Error fetching integration:', error);
    res.status(500).json({ error: 'Failed to fetch integration' });
  }
});

/**
 * POST /api/user-integrations
 * Store or update integration
 */
router.post('/', async (req, res) => {
  try {
    const { userId, provider, credentials, metadata } = req.body;

    if (!userId || !provider || !credentials) {
      return res.status(400).json({ 
        error: 'userId, provider, and credentials are required' 
      });
    }

    const integration = await integrationService.storeIntegration(
      userId, 
      provider, 
      credentials, 
      metadata
    );

    res.json({
      id: integration.id,
      provider: integration.provider,
      isActive: integration.isActive,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    });
  } catch (error) {
    console.error('Error storing integration:', error);
    res.status(500).json({ error: 'Failed to store integration' });
  }
});

/**
 * DELETE /api/user-integrations/:provider
 * Deactivate integration
 */
router.delete('/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.query.userId || 'default-user';

    await integrationService.deleteIntegration(userId, provider);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting integration:', error);
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

/**
 * GET /api/user-integrations/check/:provider
 * Check if user has integration
 */
router.get('/check/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.query.userId || 'default-user';

    const hasIntegration = await integrationService.hasIntegration(userId, provider);
    res.json({ hasIntegration });
  } catch (error) {
    console.error('Error checking integration:', error);
    res.status(500).json({ error: 'Failed to check integration' });
  }
});

module.exports = router;

