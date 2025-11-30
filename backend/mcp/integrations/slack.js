const axios = require('axios');

/**
 * Slack Integration (Direct API)
 * Directly uses Slack Web API without MCP server
 * Provides messaging, channel management, and user interactions
 */
class SlackIntegration {
  constructor() {
    this.name = 'Slack';
    this.type = 'slack';
    this.description = 'Send messages, read channels, manage your Slack workspace';
    this.icon = 'https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png';
    this.baseURL = 'https://slack.com/api';
  }

  /**
   * Make authenticated API request to Slack
   * Slack API uses POST for most endpoints with form-encoded or JSON body
   */
  async makeRequest(method, endpoint, accessToken, payload = null) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    };

    // For GET requests, use params; for POST, use data
    if (method === 'GET' && payload && payload.params) {
      config.params = payload.params;
    } else if (method === 'POST' && payload) {
      config.data = payload;
    }

    try {
      const response = await axios(config);
      
      // Slack API returns { ok: true/false, ...data }
      if (!response.data.ok) {
        throw new Error(`Slack API error: ${response.data.error || 'Unknown error'}`);
      }
      
      return response.data;
    } catch (error) {
      if (error.response) {
        const errorMsg = error.response.data?.error || 'Unknown error';
        throw new Error(`Slack API error: ${error.response.status} - ${errorMsg}`);
      }
      throw error;
    }
  }

  /**
   * Connect to Slack (no actual connection needed - just store tokens)
   * Credentials are already decrypted by IntegrationService
   */
  async connect(config) {
    if (!config || !config.token) {
      throw new Error('Slack access token is required');
    }

    const accessToken = config.token;
    const userId = config.userId || 'default-user';

    // Test connection with auth.test
    try {
      const authData = await this.makeRequest('POST', '/auth.test', accessToken);
      console.log(`✅ Slack connection verified for user ${userId} (team: ${authData.team})`);
    } catch (error) {
      throw new Error(`Failed to verify Slack connection: ${error.message}`);
    }

    return {
      accessToken: accessToken,
      userId: userId,
      teamId: config.teamId || null,
    };
  }

  /**
   * Disconnect from Slack (no cleanup needed)
   */
  async disconnect(connection) {
    // No cleanup needed for direct API integration
  }

  /**
   * Get available tools (manually defined)
   */
  async getTools(connection) {
    return [
      {
        name: 'slack_list_channels',
        description: 'List all public channels in the Slack workspace',
        inputSchema: {
          type: 'object',
          properties: {
            exclude_archived: {
              type: 'boolean',
              description: 'Exclude archived channels (default: true)'
            }
          }
        }
      },
      {
        name: 'slack_get_channel_info',
        description: 'Get information about a specific channel',
        inputSchema: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'Channel ID (e.g., C1234567890)'
            }
          },
          required: ['channel']
        }
      },
      {
        name: 'slack_read_channel_messages',
        description: 'Read messages from a channel',
        inputSchema: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'Channel ID (e.g., C1234567890)'
            },
            limit: {
              type: 'number',
              description: 'Number of messages to return (default: 20, max: 100)'
            },
            oldest: {
              type: 'string',
              description: 'Oldest message timestamp to include (optional)'
            },
            latest: {
              type: 'string',
              description: 'Latest message timestamp to include (optional)'
            }
          },
          required: ['channel']
        }
      },
      {
        name: 'slack_send_message',
        description: 'Send a message to a channel or user',
        inputSchema: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'Channel ID (e.g., C1234567890) or user ID (e.g., U1234567890)'
            },
            text: {
              type: 'string',
              description: 'Message text to send'
            },
            thread_ts: {
              type: 'string',
              description: 'Thread timestamp to reply to (optional)'
            }
          },
          required: ['channel', 'text']
        }
      },
      {
        name: 'slack_list_users',
        description: 'List all users in the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            include_deleted: {
              type: 'boolean',
              description: 'Include deleted users (default: false)'
            }
          }
        }
      },
      {
        name: 'slack_get_user_info',
        description: 'Get information about a specific user',
        inputSchema: {
          type: 'object',
          properties: {
            user: {
              type: 'string',
              description: 'User ID (e.g., U1234567890)'
            }
          },
          required: ['user']
        }
      },
      {
        name: 'slack_list_dms',
        description: 'List all direct message conversations',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of conversations to return (default: 20)'
            }
          }
        }
      },
      {
        name: 'slack_search_messages',
        description: 'Search for messages across the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (e.g., "from:username hello")'
            },
            count: {
              type: 'number',
              description: 'Number of results to return (default: 20, max: 100)'
            },
            sort: {
              type: 'string',
              enum: ['score', 'timestamp'],
              description: 'Sort order (default: score)'
            }
          },
          required: ['query']
        }
      }
    ];
  }

  /**
   * Call a tool - direct API implementation
   */
  async callTool(connection, toolName, args) {
    if (!connection || !connection.accessToken) {
      throw new Error('Not connected to Slack');
    }

    const accessToken = connection.accessToken;

    try {
      switch (toolName) {
        case 'slack_list_channels':
          return await this.handleListChannels(connection, args);
        case 'slack_get_channel_info':
          return await this.handleGetChannelInfo(connection, args);
        case 'slack_read_channel_messages':
          return await this.handleReadChannelMessages(connection, args);
        case 'slack_send_message':
          return await this.handleSendMessage(connection, args);
        case 'slack_list_users':
          return await this.handleListUsers(connection, args);
        case 'slack_get_user_info':
          return await this.handleGetUserInfo(connection, args);
        case 'slack_list_dms':
          return await this.handleListDMs(connection, args);
        case 'slack_search_messages':
          return await this.handleSearchMessages(connection, args);
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: error.message
        }]
      };
    }
  }

  /**
   * Handle slack_list_channels
   */
  async handleListChannels(connection, args) {
    const { exclude_archived = true } = args;
    const data = await this.makeRequest('POST', '/conversations.list', connection.accessToken, {
      types: 'public_channel,private_channel',
      exclude_archived: exclude_archived,
    });

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          channels: data.channels.map(ch => ({
            id: ch.id,
            name: ch.name,
            is_private: ch.is_private,
            is_archived: ch.is_archived,
            num_members: ch.num_members,
            topic: ch.topic?.value || '',
            purpose: ch.purpose?.value || '',
          })),
          count: data.channels.length,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle slack_get_channel_info
   */
  async handleGetChannelInfo(connection, args) {
    const { channel } = args;
    const data = await this.makeRequest('POST', '/conversations.info', connection.accessToken, {
      channel
    });

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          id: data.channel.id,
          name: data.channel.name,
          is_private: data.channel.is_private,
          is_archived: data.channel.is_archived,
          num_members: data.channel.num_members,
          topic: data.channel.topic?.value || '',
          purpose: data.channel.purpose?.value || '',
          created: data.channel.created,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle slack_read_channel_messages
   */
  async handleReadChannelMessages(connection, args) {
    const { channel, limit = 20, oldest, latest } = args;
    const payload = {
      channel,
      limit: Math.min(limit, 100),
    };
    if (oldest) payload.oldest = oldest;
    if (latest) payload.latest = latest;

    const data = await this.makeRequest('POST', '/conversations.history', connection.accessToken, payload);

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          messages: data.messages.map(msg => ({
            type: msg.type,
            user: msg.user,
            text: msg.text,
            ts: msg.ts,
            thread_ts: msg.thread_ts,
            reply_count: msg.reply_count,
            reactions: msg.reactions || [],
          })),
          has_more: data.has_more,
          count: data.messages.length,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle slack_send_message
   */
  async handleSendMessage(connection, args) {
    const { channel, text, thread_ts } = args;
    const payload = {
      channel,
      text,
    };
    if (thread_ts) payload.thread_ts = thread_ts;

    const data = await this.makeRequest('POST', '/chat.postMessage', connection.accessToken, payload);

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: {
            ts: data.message.ts,
            channel: data.channel,
            text: data.message.text,
          }
        }, null, 2)
      }]
    };
  }

  /**
   * Handle slack_list_users
   */
  async handleListUsers(connection, args) {
    const { include_deleted = false } = args;
    const data = await this.makeRequest('POST', '/users.list', connection.accessToken, {
      include_deleted
    });

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          users: data.members.map(user => ({
            id: user.id,
            name: user.name,
            real_name: user.real_name,
            display_name: user.profile?.display_name || user.name,
            email: user.profile?.email || '',
            image: user.profile?.image_72 || '',
            is_bot: user.is_bot,
            is_deleted: user.deleted,
          })),
          count: data.members.length,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle slack_get_user_info
   */
  async handleGetUserInfo(connection, args) {
    const { user } = args;
    const data = await this.makeRequest('POST', '/users.info', connection.accessToken, {
      user
    });

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          id: data.user.id,
          name: data.user.name,
          real_name: data.user.real_name,
          display_name: data.user.profile?.display_name || data.user.name,
          email: data.user.profile?.email || '',
          image: data.user.profile?.image_512 || '',
          is_bot: data.user.is_bot,
          is_deleted: data.user.deleted,
          timezone: data.user.tz,
          status: data.user.profile?.status_text || '',
        }, null, 2)
      }]
    };
  }

  /**
   * Handle slack_list_dms
   */
  async handleListDMs(connection, args) {
    const { limit = 20 } = args;
    const data = await this.makeRequest('POST', '/conversations.list', connection.accessToken, {
      types: 'im',
      limit: Math.min(limit, 100),
    });

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          conversations: data.channels.map(conv => ({
            id: conv.id,
            user: conv.user,
            is_im: conv.is_im,
            unread_count: conv.unread_count,
          })),
          count: data.channels.length,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle slack_search_messages
   */
  async handleSearchMessages(connection, args) {
    const { query, count = 20, sort = 'score' } = args;
    const data = await this.makeRequest('POST', '/search.messages', connection.accessToken, {
      query,
      count: Math.min(count, 100),
      sort,
    });

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          query,
          messages: data.messages.matches.map(msg => ({
            type: msg.type,
            user: msg.user,
            username: msg.username,
            text: msg.text,
            ts: msg.ts,
            channel: msg.channel,
            permalink: msg.permalink,
          })),
          total: data.messages.total,
          count: data.messages.matches.length,
        }, null, 2)
      }]
    };
  }
}

module.exports = SlackIntegration;

