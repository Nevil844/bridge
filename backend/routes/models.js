const express = require('express');
const { getAllModels } = require('../ai-providers');

const router = express.Router();

/**
 * Get available AI models
 * Returns both free and premium models
 */
router.get('/', (req, res) => {
  try {
    const models = getAllModels();
    res.json(models);
  } catch (error) {
    console.error('Error getting models:', error);
    res.status(500).json({ 
      error: 'Failed to load models',
      models: [
        { id: 'models/gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'free' }
      ]
    });
  }
});

module.exports = router;

