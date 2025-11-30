const express = require('express');
const mcpManager = require('../mcp/manager');
const { verifyUser } = require('../middleware/auth');

const router = express.Router();

// Generic questions (shown when no integrations are connected)
// These should be useful and help users understand what the AI can do
const GENERIC_QUESTIONS = [
  "Explain quantum computing in simple terms",
  "Write a professional email template",
  "Help me plan a productive day",
  "What are the latest trends in AI?",
  "Create a workout routine for beginners",
  "Suggest healthy meal ideas",
  "Help me write a resume summary",
  "Explain how machine learning works",
  "What are some productivity tips?",
  "Help me brainstorm project ideas",
];

// Integration-specific questions
// Only include questions that match the actual tools available
const INTEGRATION_QUESTIONS = {
  spotify: [
    "Search for Night Changes by One Direction",
    "Play the current track",
    "Pause Spotify",
    "Skip to the next song",
    "What's currently playing?",
    "Search for workout playlists",
    "Add a song to my queue",
    "Show me my current queue",
  ],
  github: [
    "Show me my recent commits",
    "What are my open pull requests?",
    "List my repositories",
    "Show me issues in my projects",
    "What's my GitHub activity today?",
    "Find repositories I starred",
  ],
  gmail: [
    "Show me unread emails",
    "List my recent emails",
    "Search for emails from last week",
    "Search for emails with attachments",
    "Send an email",
    "Show me emails from today",
  ],
  'google-drive': [
    "List my recent files",
    "Search for files by name",
    "Show me file details",
    "Find documents in my Drive",
  ],
  jira: [
    "Search for my assigned issues",
    "Get details of a Jira issue",
    "Create a new Jira issue",
    "Update a Jira issue",
    "Add a comment to an issue",
    "Search for high priority issues",
  ],
  zerodha: [
    "What's my portfolio value?",
    "Show me my holdings",
    "What stocks did I buy today?",
    "Check my account balance",
    "Show me my P&L",
    "What's the market status?",
  ],
  zomato: [
    "Find restaurants near me",
    "What are the top rated restaurants?",
    "Show me food delivery options",
    "Find restaurants by cuisine",
    "What's popular in my area?",
    "Show me restaurant reviews",
  ],
  slack: [
    "List all my Slack channels",
    "Read messages from a channel",
    "Send a message to a channel",
    "List all users in my workspace",
    "Get information about a user",
    "List my direct message conversations",
    "Search for messages in Slack",
    "Get information about a channel",
  ],
};

/**
 * GET /api/sample-questions
 * Get sample questions based on user's connected integrations
 */
router.get('/', verifyUser, async (req, res) => {
  try {
    // Get user's connected integrations
    const userIntegrations = await mcpManager.getUserIntegrations(req.userId);
    const integrationTypes = userIntegrations.map(i => i.type);
    
    let questions = [];
    
    if (integrationTypes.length === 0) {
      // No integrations - return generic questions
      questions = GENERIC_QUESTIONS;
    } else {
      // Build questions from connected integrations
      const integrationQuestions = [];
      
      integrationTypes.forEach(type => {
        if (INTEGRATION_QUESTIONS[type]) {
          integrationQuestions.push(...INTEGRATION_QUESTIONS[type]);
        }
      });
      
      // Only use integration-specific questions when integrations are connected
      questions = integrationQuestions;
    }
    
    // Shuffle questions for variety
    const shuffled = questions.sort(() => Math.random() - 0.5);
    
    res.json({
      questions: shuffled,
      hasIntegrations: integrationTypes.length > 0,
      integrations: integrationTypes,
    });
  } catch (error) {
    console.error('Error getting sample questions:', error);
    // Return generic questions as fallback
    res.json({
      questions: GENERIC_QUESTIONS,
      hasIntegrations: false,
      integrations: [],
    });
  }
});

module.exports = router;

