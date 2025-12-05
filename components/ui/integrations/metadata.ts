export interface IntegrationToolSpec {
  name: string;
  description: string;
  importantParams?: string[];
}

export interface IntegrationMetadata {
  id: string;
  type: string;
  name: string;
  howItWorks: string;
  authNotes?: string;
  exceptions?: string[];
  tools: IntegrationToolSpec[];
}

export const INTEGRATION_METADATA: Record<string, IntegrationMetadata> = {
  github: {
    id: 'github',
    type: 'github',
    name: 'GitHub',
    howItWorks:
      'Bridge connects to the official GitHub MCP server using your personal access token. The AI can then browse your repositories, read code, search issues/PRs, and more directly from GitHub.',
    authNotes:
      'Requires a GitHub personal access token (PAT) with appropriate scopes for repo/code access. You can revoke access anytime from your GitHub settings.',
    tools: [
      {
        name: 'github_search_repositories',
        description: 'Search for repositories by query, language, or other criteria.',
        importantParams: ['query', 'language', 'sort', 'order'],
      },
      {
        name: 'github_get_repository',
        description: 'Get detailed information about a specific repository.',
        importantParams: ['owner', 'repo'],
      },
      {
        name: 'github_list_files',
        description: 'List files and directories in a repository.',
        importantParams: ['owner', 'repo', 'path', 'ref'],
      },
      {
        name: 'github_read_file',
        description: 'Read the contents of a file from a repository.',
        importantParams: ['owner', 'repo', 'path', 'ref'],
      },
      {
        name: 'github_search_code',
        description: 'Search across code in repositories for symbols or text.',
        importantParams: ['query', 'language', 'repo'],
      },
      {
        name: 'github_get_issue',
        description: 'Get details of a specific issue including comments.',
        importantParams: ['owner', 'repo', 'issue_number'],
      },
      {
        name: 'github_list_issues',
        description: 'List issues in a repository with filters.',
        importantParams: ['owner', 'repo', 'state', 'labels'],
      },
      {
        name: 'github_create_issue',
        description: 'Create a new issue in a repository.',
        importantParams: ['owner', 'repo', 'title', 'body', 'labels'],
      },
      {
        name: 'github_get_pull_request',
        description: 'Get details of a specific pull request including reviews and comments.',
        importantParams: ['owner', 'repo', 'pull_number'],
      },
      {
        name: 'github_list_pull_requests',
        description: 'List pull requests in a repository.',
        importantParams: ['owner', 'repo', 'state'],
      },
      {
        name: 'github_create_pull_request',
        description: 'Create a new pull request.',
        importantParams: ['owner', 'repo', 'title', 'head', 'base', 'body'],
      },
      {
        name: 'github_get_branch',
        description: 'Get information about a specific branch.',
        importantParams: ['owner', 'repo', 'branch'],
      },
      {
        name: 'github_list_branches',
        description: 'List branches in a repository.',
        importantParams: ['owner', 'repo'],
      },
      {
        name: 'github_get_commit',
        description: 'Get details of a specific commit.',
        importantParams: ['owner', 'repo', 'sha'],
      },
      {
        name: 'github_list_commits',
        description: 'List commits in a repository.',
        importantParams: ['owner', 'repo', 'sha', 'path'],
      },
    ],
  },
  'google-drive': {
    id: 'google-drive',
    type: 'google-drive',
    name: 'Google Drive',
    howItWorks:
      'Bridge uses the Google Drive API with your consented OAuth tokens. The AI can list, search, and fetch details for your Drive files but cannot act outside the scopes you approve.',
    authNotes:
      'Requires Google OAuth with Drive scopes. You can disconnect at any time; tokens are stored encrypted.',
    tools: [
      {
        name: 'list_drive_files',
        description:
          'List recent files from your Google Drive with names, types, modified dates, and links.',
        importantParams: ['pageSize', 'orderBy'],
      },
      {
        name: 'search_drive_files',
        description:
          'Search for Drive files by name. Useful when you know part of the filename or keyword.',
        importantParams: ['searchTerm', 'pageSize'],
      },
      {
        name: 'get_drive_file_details',
        description:
          'Fetch detailed metadata for a specific file, including links, size, owner, and type.',
        importantParams: ['fileId'],
      },
    ],
  },
  gmail: {
    id: 'gmail',
    type: 'gmail',
    name: 'Gmail',
    howItWorks:
      'Bridge talks directly to the Gmail API using your OAuth tokens. The AI can read, search, label, and send emails on your behalf within the scopes you grant.',
    authNotes:
      'Requires Gmail/Google OAuth. You control the allowed scopes, and you can revoke access from your Google account settings.',
    tools: [
      {
        name: 'list_emails',
        description:
          'List recent emails from your inbox with subject, sender, snippet, and date.',
        importantParams: ['maxResults', 'query'],
      },
      {
        name: 'search_emails',
        description:
          'Search emails using full Gmail query syntax (e.g., is:unread, from:someone, subject:keyword).',
        importantParams: ['query', 'maxResults'],
      },
      {
        name: 'get_email',
        description:
          'Fetch the full content of a particular email including headers, body, and labels.',
        importantParams: ['emailId'],
      },
      {
        name: 'send_email',
        description:
          'Send an email from your Gmail account with subject, body, and optional CC/BCC.',
        importantParams: ['to', 'subject', 'body', 'cc', 'bcc'],
      },
      {
        name: 'get_labels',
        description: 'List all labels configured in your Gmail account.',
      },
      {
        name: 'add_label / remove_label / trash_email',
        description:
          'Update labels or move messages to trash so the AI can help you keep your inbox organized.',
        importantParams: ['emailId', 'labelId'],
      },
    ],
  },
  'google-calendar': {
    id: 'google-calendar',
    type: 'google-calendar',
    name: 'Google Calendar',
    howItWorks:
      'Bridge uses the Google Calendar API to read and manage events. The AI can list, search, create, update, and delete calendar events, including Google Meet links.',
    authNotes:
      'Requires Google Calendar scopes via OAuth. You can limit access to specific calendars and revoke tokens at any time.',
    tools: [
      {
        name: 'list_calendars',
        description:
          'List all calendars you have access to, including primary and shared calendars.',
        importantParams: ['minAccessRole'],
      },
      {
        name: 'list_events / get_upcoming_events / search_events',
        description:
          'View upcoming events, search within a date range, or filter by free-text queries.',
        importantParams: ['calendarId', 'timeMin', 'timeMax', 'maxResults'],
      },
      {
        name: 'get_event',
        description:
          'Get full details for a specific event including attendees, Meet link, and recurrence.',
        importantParams: ['eventId', 'calendarId'],
      },
      {
        name: 'create_event',
        description:
          'Create a new event with attendees, reminders, time zone handling, and optional Google Meet link.',
        importantParams: ['summary', 'start', 'end', 'attendees', 'conferenceData'],
      },
      {
        name: 'update_event',
        description:
          'Edit an existing event, including time, title, location, attendees, and reminders.',
        importantParams: ['eventId', 'start', 'end', 'attendees'],
      },
      {
        name: 'delete_event',
        description:
          'Delete an event and optionally send cancellation emails to attendees.',
        importantParams: ['eventId', 'sendUpdates'],
      },
    ],
  },
  zerodha: {
    id: 'zerodha',
    type: 'zerodha',
    name: 'Zerodha',
    howItWorks:
      "Bridge connects to Zerodha's official Kite MCP server. The AI can access your portfolio, market data, and trading tools via Zerodha's MCP tools.",
    authNotes:
      'Requires a Zerodha API token and an interactive login via the official Kite MCP flow. Tokens are verified against Zerodha APIs and stored securely.',
    exceptions: [
      'On first use, the AI must call the Zerodha login tool to open the Kite authorization page.',
      'You will see a Zerodha-hosted warning/confirmation screen before granting trading access.',
    ],
    tools: [
      {
        name: 'login',
        description:
          'First-time login tool that opens the official Kite authorization page and establishes a session. Must be called before any other tool.',
      },
      {
        name: 'get_profile',
        description: 'Get your Zerodha user profile information.',
      },
      {
        name: 'get_holdings',
        description: 'Get your current stock holdings and positions.',
      },
      {
        name: 'get_positions',
        description: 'Get your current positions including day and net positions.',
      },
      {
        name: 'get_orders',
        description: 'Get your order book with all pending and executed orders.',
      },
      {
        name: 'get_order_history',
        description: 'Get historical order information.',
        importantParams: ['order_id'],
      },
      {
        name: 'get_margins',
        description: 'Get your account margins including available, used, and net margins.',
      },
      {
        name: 'get_quote',
        description: 'Get real-time quote for instruments.',
        importantParams: ['instruments'],
      },
      {
        name: 'get_ohlc',
        description: 'Get OHLC (Open, High, Low, Close) data for instruments.',
        importantParams: ['instruments', 'interval'],
      },
      {
        name: 'place_order',
        description: 'Place a new order (buy/sell).',
        importantParams: ['exchange', 'tradingsymbol', 'transaction_type', 'quantity', 'order_type', 'product'],
      },
      {
        name: 'modify_order',
        description: 'Modify an existing order.',
        importantParams: ['order_id', 'order_type', 'quantity', 'price'],
      },
      {
        name: 'cancel_order',
        description: 'Cancel an existing order.',
        importantParams: ['order_id'],
      },
    ],
  },
  spotify: {
    id: 'spotify',
    type: 'spotify',
    name: 'Spotify',
    howItWorks:
      'Bridge uses the Spotify Web API directly with your OAuth tokens. The AI can control playback, search music, manage playlists, and queue songs.',
    authNotes:
      'Requires Spotify OAuth with playback and library scopes. Your tokens are stored encrypted and can be revoked from your Spotify account.',
    exceptions: [
      'Playback control (play/pause/skip/queue) generally requires a Spotify Premium account.',
      'Some devices or regions may limit which playback actions are available.',
    ],
    tools: [
      {
        name: 'SpotifyPlayback',
        description:
          'Control playback: get the current track, play/pause/resume, skip, go to previous, or change volume.',
        importantParams: ['action', 'track_uri', 'volume', 'device_id'],
      },
      {
        name: 'SpotifySearch',
        description: 'Search tracks, artists, albums, or playlists by query.',
        importantParams: ['qtype', 'query', 'limit'],
      },
      {
        name: 'SpotifyQueue',
        description: 'Add tracks to your queue or inspect the current queue and now-playing track.',
        importantParams: ['action', 'track_id', 'device_id'],
      },
      {
        name: 'SpotifyGetInfo',
        description: 'Fetch detailed information about a track, artist, album, or playlist.',
        importantParams: ['type', 'id'],
      },
      {
        name: 'SpotifyPlaylist',
        description: 'Create playlists, fetch playlist details, and add or remove tracks.',
        importantParams: ['action', 'playlist_id', 'name', 'track_ids'],
      },
      {
        name: 'SpotifySearchAndPlay',
        description:
          'Search for a song by name/artist and immediately start playing the best match.',
        importantParams: ['query'],
      },
    ],
  },
  slack: {
    id: 'slack',
    type: 'slack',
    name: 'Slack',
    howItWorks:
      'Bridge talks directly to the Slack Web API using your workspace token. The AI can list channels, read messages (where permitted), send messages, and search across Slack.',
    authNotes:
      'Requires a Slack OAuth token with the correct workspace scopes. Admins can restrict scopes and revoke the app at any time.',
    tools: [
      {
        name: 'slack_list_channels / slack_get_channel_info',
        description: 'Discover channels and inspect their metadata, topics, and member counts.',
        importantParams: ['channel', 'exclude_archived'],
      },
      {
        name: 'slack_read_channel_messages',
        description: 'Read recent messages in a channel, including basic thread metadata.',
        importantParams: ['channel', 'limit', 'oldest', 'latest'],
      },
      {
        name: 'slack_send_message',
        description: 'Post messages to channels or DMs, optionally as a threaded reply.',
        importantParams: ['channel', 'text', 'thread_ts'],
      },
      {
        name: 'slack_list_users / slack_get_user_info',
        description: 'List workspace members or get rich profile details for a specific user.',
        importantParams: ['user', 'include_deleted'],
      },
      {
        name: 'slack_list_dms',
        description: 'List direct message conversations you are part of.',
        importantParams: ['limit'],
      },
      {
        name: 'slack_search_messages',
        description: 'Search messages across the workspace with flexible query syntax.',
        importantParams: ['query', 'count', 'sort'],
      },
    ],
  },
  youtube: {
    id: 'youtube',
    type: 'youtube',
    name: 'YouTube',
    howItWorks:
      'Bridge uses the YouTube Data API via your Google OAuth tokens. The AI can search videos, inspect channels, read metadata, and work with playlists and transcripts.',
    authNotes:
      'Requires YouTube/Google OAuth with appropriate scopes. Tokens are stored encrypted and can be revoked from your Google account.',
    tools: [
      {
        name: 'youtube_search_videos / youtube_search_channels',
        description:
          'Search for videos or channels by keyword, sorted by relevance, views, date, or rating.',
        importantParams: ['query', 'max_results', 'order'],
      },
      {
        name: 'youtube_get_video_info / youtube_get_video_metadata / youtube_get_video_metadata_summary',
        description:
          'Fetch rich metadata for a video, including views, likes, comments, duration, tags, and a human-readable summary.',
        importantParams: ['video_id', 'fields'],
      },
      {
        name: 'youtube_list_subtitle_languages / youtube_download_subtitles / youtube_get_transcript',
        description:
          'Inspect available subtitle languages, download caption tracks, or get a clean text transcript.',
        importantParams: ['video_id', 'language'],
      },
      {
        name: 'youtube_list_playlists / youtube_get_playlist_items',
        description: 'Browse your playlists and the videos inside each playlist.',
        importantParams: ['playlist_id', 'max_results'],
      },
      {
        name: 'youtube_get_channel_info / youtube_get_channel_videos / youtube_list_subscriptions',
        description:
          'Inspect channels (yours or others), list their videos, and see which channels you are subscribed to.',
        importantParams: ['channel_id', 'max_results', 'order'],
      },
    ],
  },
  jira: {
    id: 'jira',
    type: 'jira',
    name: 'Jira',
    howItWorks:
      'Bridge connects to your Jira workspace via OAuth and exposes tools for issues, projects, and workflows. This integration currently works best in local environments.',
    authNotes:
      'Requires Jira OAuth configuration (domain, client ID/secret) and user consent. Access can be revoked from your Atlassian account.',
    exceptions: ['Currently optimized for local development; production support is still being hardened.'],
    tools: [
      {
        name: 'Issues & projects',
        description:
          'Search, read, and update Jira issues; browse projects and basic workflow metadata.',
      },
    ],
  },
  zomato: {
    id: 'zomato',
    type: 'zomato',
    name: 'Zomato',
    howItWorks:
      'Bridge talks to Zomato APIs to search restaurants, browse menus, and help you build orders through AI tooling. This integration currently works best in local environments.',
    authNotes:
      'Requires Zomato OAuth/API keys where supported. Only non-payment flows are handled by the AI; final checkout always happens on Zomato.',
    exceptions: ['Currently optimized for local development; production support is still being hardened.'],
    tools: [
      {
        name: 'Discovery & ordering',
        description:
          'Search restaurants, view menus, and assemble draft orders based on your preferences.',
      },
    ],
  },
};

export function getIntegrationMetadata(type: string | undefined | null): IntegrationMetadata | null {
  if (!type) return null;
  return INTEGRATION_METADATA[type] ?? null;
}

/**
 * Map a tool name (case-insensitive) to its integration type using metadata.
 * Supports tool names listed with slashes, e.g. "list_events / get_upcoming_events".
 */
export function getIntegrationTypeForTool(toolName: string | undefined | null): string | null {
  if (!toolName) return null;
  const normalized = toolName.trim().toLowerCase();
  if (!normalized) return null;

  // Build a lookup once and memoize it on the module scope
  if (!(global as any).__INTEGRATION_TOOL_LOOKUP) {
    const lookup: Record<string, string> = {};
    Object.values(INTEGRATION_METADATA).forEach(meta => {
      meta.tools.forEach(tool => {
        // Split names like "list_events / get_upcoming_events / search_events"
        tool.name.split('/').map(part => part.trim().toLowerCase()).forEach(part => {
          if (part) {
            lookup[part] = meta.type;
          }
        });
      });
    });
    (global as any).__INTEGRATION_TOOL_LOOKUP = lookup;
  }

  const lookup = (global as any).__INTEGRATION_TOOL_LOOKUP as Record<string, string>;
  return lookup[normalized] || null;
}


