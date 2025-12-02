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
// Make questions specific and actionable with real examples
const INTEGRATION_QUESTIONS = {
  spotify: [
    "Play Night Changes by One Direction",
    "Play Senorita by Shawn Mendes",
    "Play the last song I was listening to",
    "What song is currently playing?",
    "Skip to the next song",
    "Pause Spotify",
    "Add Blinding Lights by The Weeknd to my queue",
    "Play songs by Ed Sheeran",
    "Create a workout playlist called 'Gym Time'",
  ],
  github: [
    "Show me my last 10 commits",
    "What are my open pull requests in the main repository?",
    "List all my private repositories",
    "Show me issues assigned to me",
    "What commits did I make today?",
    "Find repositories I starred in the last month",
    "Show me pull requests I created this week",
  ],
  gmail: [
    "Show me my 10 most recent emails",
    "Search for emails from Amazon in the last week",
    "Find emails with attachments from today",
    "Search for emails about 'meeting' from last month",
    "Find emails with 'invoice' in the subject",
    "Summarize the last 5 email threads",
  ],
  'google-drive': [
    "List my 10 most recent files",
    "Search for files named 'resume' or 'CV'",
    "Show me all PDF files from last month",
    "Find files shared with me in the last week",
    "Search for files about 'AI' or 'machine learning'",
    "Show me the last 5 files I modified",
  ],
  'google-calendar': [
    "Show me my upcoming events for this week",
    "What meetings do I have today?",
    "Create a meeting with John at 3 PM tomorrow titled 'Project Review'",
    "Schedule a dentist appointment for next Monday at 2 PM",
    "Find all events with 'meeting' in the title",
    "Show me events for the next 7 days",
    "Create an all-day event for 'Team Offsite' on December 15th",
    "What's on my calendar for tomorrow?",
    "Schedule a 30-minute call with Sarah next Friday at 10 AM",
    "Show me all my calendars",
  ],
  jira: [
    "Show me all issues assigned to me on the board",
    "Get details of issues on board",
    "Create a new bug issue in current project titled 'Login button not working'",
    "Update issue status to 'In Progress'",
    "Add a comment to issue saying 'Fixed in latest release'",
    "Search for high priority issues assigned to me",
    "Show me all issues in project on board that are due this week",
  ],
  zerodha: [
    "What's my total portfolio value?",
    "Show me my Zerodha profile details",
    "List all my stock holdings",
    "What stocks did I buy today?",
    "Check my available account balance",
    "Show me my profit and loss for today",
    "What's the current market status?",
    "Show me current market prices of RELIANCE and TCS",
  ],
  zomato: [
    "Find Italian restaurants near me",
    "Show me top rated pizza places in my area",
    "Find restaurants serving biryani within 5 km",
    "What are the best rated restaurants for dinner?",
    "Show me restaurants open now near me",
    "Find Chinese restaurants with 4+ star rating",
    "What are the most popular restaurants in my area?",
    "Show me restaurants that deliver to my location",
  ],
  slack: [
    "List all public channels in my workspace",
    "Read the last 20 messages from #general channel",
    "Send a message 'Hello team!' to #general",
    "List all users in my workspace",
    "Show me my direct message conversations",
    "Search for messages containing 'meeting' in #general",
    "Send a DM to @nevil saying 'Can we sync up?'",
  ],
  youtube: [
    "Get me Mr Beast's latest video",
    "Search for videos about 'Python tutorial'",
    "Show me the latest videos from 5 of my subscriptions",
    "Show me videos in my 'Favorites' playlist",
    "Search for 'cooking recipes' videos",
    "Find me a good TMKOC episode",
    "Get me videos from Tanmay Bhatt's channel",
    "Show me my YouTube subscriptions",
    "Search for 'React tutorial' videos sorted by view count",
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

