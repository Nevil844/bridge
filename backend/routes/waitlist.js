const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * POST /api/waitlist
 * Add email to waitlist
 */
router.post('/', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if email already exists
    const existing = await prisma.waitlist.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return res.status(409).json({ 
        error: 'Email already exists on waitlist',
        message: 'You\'re already on our waitlist! We\'ll notify you when we launch.',
      });
    }

    // Add to waitlist
    const waitlistEntry = await prisma.waitlist.create({
      data: {
        email: email.toLowerCase().trim(),
      },
    });

    console.log(`✅ Added email to waitlist: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Successfully added to waitlist',
      id: waitlistEntry.id,
    });
  } catch (error) {
    console.error('❌ Error adding to waitlist:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        error: 'Email already exists on waitlist',
        message: 'You\'re already on our waitlist! We\'ll notify you when we launch.',
      });
    }

    res.status(500).json({ 
      error: 'Failed to add email to waitlist',
      message: 'An error occurred. Please try again later.',
    });
  }
});

/**
 * GET /api/waitlist
 * Get waitlist stats (admin only - add auth in production)
 */
router.get('/', async (req, res) => {
  try {
    const total = await prisma.waitlist.count();

    res.json({
      total,
    });
  } catch (error) {
    console.error('❌ Error fetching waitlist stats:', error);
    res.status(500).json({ error: 'Failed to fetch waitlist stats' });
  }
});

/**
 * GET /api/waitlist/check
 * Check if an email is invited
 */
router.get('/check', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const waitlistEntry = await prisma.waitlist.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        email: true,
        isInvited: true,
        createdAt: true,
      },
    });

    if (!waitlistEntry) {
      return res.json({
        exists: false,
        isInvited: false,
      });
    }

    res.json({
      exists: true,
      isInvited: waitlistEntry.isInvited,
      email: waitlistEntry.email,
      createdAt: waitlistEntry.createdAt,
    });
  } catch (error) {
    console.error('❌ Error checking waitlist:', error);
    res.status(500).json({ error: 'Failed to check waitlist' });
  }
});

module.exports = router;

