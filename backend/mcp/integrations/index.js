/**
 * MCP Integrations Registry
 * Add new integrations here to make them available in the app
 */

const GitHubIntegration = require('./github.js');
const GoogleDriveIntegration = require('./google-drive.js');
const GmailIntegration = require('./gmail.js');
const ZerodhaIntegration = require('./zerodha.js');
const SpotifyIntegration = require('./spotify.js');
const ZomatoIntegration = require('./zomato.js');
const JiraIntegration = require('./jira.js');
const SlackIntegration = require('./slack.js');
const YouTubeIntegration = require('./youtube.js');
const GoogleCalendarIntegration = require('./google-calendar.js');

// Available integrations
// Add new integrations here as you create them
const integrations = {
  github: {
    class: GitHubIntegration,
    name: 'GitHub',
    description: 'Access GitHub repositories, issues, pull requests, and more',
    icon: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
    authType: 'oauth',
  },
  'google-drive': {
    class: GoogleDriveIntegration,
    name: 'Google Drive',
    description: 'Search files, list documents, and access your Google Drive',
    icon: 'https://www.google.com/drive/static/images/drive/logo-drive.png',
    authType: 'oauth',
  },
  gmail: {
    class: GmailIntegration,
    name: 'Gmail',
    description: 'Read, send, search, and manage your Gmail emails',
    icon: 'https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png',
    authType: 'oauth',
  },
  zerodha: {
    class: ZerodhaIntegration,
    name: 'Zerodha',
    description: 'Access your portfolio, market data, and trading insights',
    icon: 'https://zerodha.com/static/images/logo.svg',
    authType: 'oauth',
  },
  spotify: {
    class: SpotifyIntegration,
    name: 'Spotify',
    description: 'Control playback, manage playlists, and search music',
    icon: 'https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png',
    authType: 'oauth',
  },
  zomato: {
    class: ZomatoIntegration,
    name: 'Zomato',
    description: 'Discover restaurants, browse menus, create carts, and place food orders',
    icon: 'https://logo.clearbit.com/zomato.com',
    authType: 'oauth',
  },
  jira: {
    class: JiraIntegration,
    name: 'Jira',
    description: 'Create and manage issues, projects, workflows, and more',
    icon: 'https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon-32x32.png',
    authType: 'oauth', // Uses Atlassian Remote MCP Server with OAuth (recommended)
  },
  slack: {
    class: SlackIntegration,
    name: 'Slack',
    description: 'Send messages, read channels, and manage your workspace',
    icon: 'https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png',
    authType: 'oauth',
  },
  youtube: {
    class: YouTubeIntegration,
    name: 'YouTube',
    description: 'Search videos, manage playlists, and access your YouTube content',
    icon: 'https://www.youtube.com/img/desktop/yt_1200.png',
    authType: 'oauth',
  },
  'google-calendar': {
    class: GoogleCalendarIntegration,
    name: 'Google Calendar',
    description: 'View events, create meetings, manage your calendar, and schedule appointments',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/512px-Google_Calendar_icon_%282020%29.svg.png?20221106121915',
    authType: 'oauth',
  },
  // Future integrations:
};

module.exports = integrations;

