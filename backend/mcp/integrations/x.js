const axios = require('axios');

/**
 * X (Twitter) Integration (Direct API)
 * Directly uses X API v2 without MCP server
 * Provides tweet management, user lookup, search, and more
 * https://developer.x.com/en/docs/x-api
 */
class XIntegration {
  constructor() {
    this.name = 'X';
    this.type = 'x';
    this.description = 'Read and post tweets, search content, manage your X account';
    this.icon = 'https://cdn-icons-png.flaticon.com/512/3256/3256013.png';
    this.baseURL = 'https://api.twitter.com/2';
  }

  /**
   * Make authenticated API request to X API v2
   * @param {string} method - HTTP method (GET, POST, DELETE)
   * @param {string} endpoint - API endpoint (e.g., '/tweets')
   * @param {string} accessToken - OAuth 2.0 access token
   * @param {Object} params - Query parameters or request body
   * @returns {Promise<Object>} - API response data
   */
  async makeRequest(method, endpoint, accessToken, params = null) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000, // 15 second timeout
    };

    if (method === 'GET' && params) {
      config.params = params;
    } else if ((method === 'POST' || method === 'DELETE') && params) {
      config.data = params;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        const errorData = error.response.data;
        const errorMsg = errorData?.detail || errorData?.title || error.message;
        
        // Enhanced error logging for debugging
        console.error(`❌ X API Error Details:`, {
          status: error.response.status,
          statusText: error.response.statusText,
          error: errorData?.error,
          error_description: errorData?.error_description,
          detail: errorData?.detail,
          title: errorData?.title,
          type: errorData?.type,
          endpoint: url,
          method: method,
        });
        
        throw new Error(`X API error (${error.response.status}): ${errorMsg}`);
      }
      throw error;
    }
  }

  /**
   * Refresh access token if needed
   * @param {string} accessToken - Current access token
   * @param {string} refreshToken - Refresh token
   * @param {string} userId - User ID for database updates
   * @param {boolean} forceRefresh - Force refresh even if token is valid (for testing)
   * @returns {Promise<string>} - Valid access token
   */
  async refreshTokenIfNeeded(accessToken, refreshToken, userId, forceRefresh = false) {
    if (!refreshToken) {
      return accessToken;
    }

    try {
      const XOAuth = require('../../oauth/integrations/x.js');
      const xOAuth = new XOAuth();
      
      // FOR TESTING: Force refresh by setting forceRefresh = true
      const FORCE_REFRESH_FOR_TESTING = false;
      
      const shouldForceRefresh = forceRefresh || FORCE_REFRESH_FOR_TESTING;
      
      // Try to validate token (skip if forcing refresh)
      if (!shouldForceRefresh) {
        try {
          await Promise.race([
            xOAuth.validateToken(accessToken),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
          ]);
          return accessToken; // Token is valid
        } catch (validationError) {
          // Token invalid or expired, refresh it
          if (validationError.message.includes('Invalid or expired') || 
              validationError.message.includes('expired') ||
              validationError.response?.status === 401) {
            console.log('⚠️  X token validation failed, refreshing...');
            try {
              const refreshResult = await Promise.race([
                xOAuth.refreshAccessToken(refreshToken),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
              ]);
              console.log('✅ X token refreshed successfully');
              
              // Update database with new token (non-blocking)
              if (userId && refreshResult.accessToken) {
                try {
                  const integrationService = require('../../db/services/integration');
                  await integrationService.storeIntegration(
                    userId,
                    'x',
                    {
                      token: refreshResult.accessToken,
                      refreshToken: refreshResult.refreshToken || refreshToken,
                    }
                  );
                  console.log('✅ Updated X token in database');
                } catch (dbError) {
                  console.warn('⚠️  Could not update X token in database:', dbError.message);
                  // Don't fail - token is refreshed in memory
                }
              }
              
              return refreshResult.accessToken;
            } catch (refreshError) {
              // If refresh token is invalid, throw a clear error instead of using expired token
              if (refreshError.message.includes('Invalid refresh token') || 
                  refreshError.message.includes('re-authenticate')) {
                console.error('❌ X refresh token is invalid - user needs to re-authenticate');
                throw new Error('X authentication expired. Please reconnect your X account from the integrations page.');
              }
              // For other refresh errors, log and throw
              console.error('❌ X token refresh failed:', refreshError.message);
              throw refreshError;
            }
          }
          // Other errors (network, etc.) - return original token
          throw validationError;
        }
      }
      
      // Force refresh path (for testing)
      if (shouldForceRefresh) {
        console.log('🔄 FORCING X token refresh (testing mode)...');
        try {
          const refreshResult = await Promise.race([
            xOAuth.refreshAccessToken(refreshToken),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]);
          console.log('✅ X token refreshed successfully (forced refresh)');
          
          // Update database with new token (non-blocking)
          if (userId && refreshResult.accessToken) {
            try {
              const integrationService = require('../../db/services/integration');
              await integrationService.storeIntegration(
                userId,
                'x',
                {
                  token: refreshResult.accessToken,
                  refreshToken: refreshResult.refreshToken || refreshToken,
                }
              );
              console.log('✅ Updated X token in database');
            } catch (dbError) {
              console.warn('⚠️  Could not update X token in database:', dbError.message);
              // Don't fail - token is refreshed in memory
            }
          }
          
          return refreshResult.accessToken;
        } catch (refreshError) {
          // If refresh token is invalid, throw a clear error instead of using expired token
          if (refreshError.message.includes('Invalid refresh token') || 
              refreshError.message.includes('re-authenticate')) {
            console.error('❌ X refresh token is invalid - user needs to re-authenticate');
            throw new Error('X authentication expired. Please reconnect your X account from the integrations page.');
          }
          // For other refresh errors, fall back to original token
          console.error('❌ X token refresh failed (forced), using original token:', refreshError.message);
          return accessToken; // Return original token if forced refresh fails
        }
      }
    } catch (error) {
      // If it's a re-authentication error, propagate it
      if (error.message.includes('reconnect') || error.message.includes('re-authenticate')) {
        throw error;
      }
      console.log('⚠️  Could not validate/refresh X token, using existing:', error.message);
      return accessToken;
    }
  }

  /**
   * Connect to X API (validate token)
   * Automatically refreshes token if expired
   * @param {Object} config - Integration configuration
   * @param {string} config.token - OAuth 2.0 access token
   * @param {string} config.refreshToken - OAuth 2.0 refresh token
   * @param {string} config.userId - User ID for token refresh updates
   * @returns {Promise<Object>} - Connection object
   */
  async connect(config) {
    const accessToken = config?.token || config?.accessToken;
    const refreshToken = config?.refreshToken;
    const userId = config?.userId;
    
    if (!accessToken) {
      throw new Error('X access token is required');
    }

    // Validate token format - X OAuth 2.0 user context tokens should be strings
    if (typeof accessToken !== 'string') {
      throw new Error('X access token must be a string');
    }

    // Refresh token if needed (like Spotify/Jira)
    let validToken;
    try {
      validToken = await this.refreshTokenIfNeeded(accessToken, refreshToken, userId);
    } catch (refreshError) {
      // Fall back to original token if refresh fails
      validToken = accessToken;
    }
    
    if (!validToken || validToken.length === 0) {
      validToken = accessToken;
    }

    // Test connection by fetching user info
    try {
      const userData = await this.makeRequest('GET', '/users/me', validToken, {
        'user.fields': 'id,name,username',
      });
      
      return {
        accessToken: validToken, // Use refreshed token if it was refreshed
        refreshToken: refreshToken, // Keep refresh token
        userId: userId, // Store userId for token refresh in callTool
        xUserId: userData.data?.id, // X user ID
        username: userData.data?.username,
      };
    } catch (error) {
      throw new Error(`Failed to verify X connection: ${error.message}`);
    }
  }

  /**
   * Disconnect from X (no cleanup needed)
   */
  async disconnect(connection) {
    // No cleanup needed for direct API integration
  }

  /**
   * Get available tools (manually defined based on X API v2)
   */
  async getTools(connection) {
    return [
      {
        name: 'x_get_user_info',
        description: 'Get information about a specific X user by username or user ID',
        inputSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'X username (without @)'
            },
            user_id: {
              type: 'string',
              description: 'X user ID'
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Additional user fields to include (e.g., description, profile_image_url, public_metrics)'
            }
          }
        }
      },
      {
        name: 'x_get_my_info',
        description: 'Get information about the authenticated user',
        inputSchema: {
          type: 'object',
          properties: {
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Additional user fields to include'
            }
          }
        }
      },
      {
        name: 'x_get_tweet',
        description: 'Get a specific tweet by ID',
        inputSchema: {
          type: 'object',
          properties: {
            tweet_id: {
              type: 'string',
              description: 'Tweet ID'
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Additional tweet fields (e.g., author_id, created_at, public_metrics)'
            }
          },
          required: ['tweet_id']
        }
      },
      {
        name: 'x_get_user_tweets',
        description: 'Get tweets from a specific user',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'User ID'
            },
            username: {
              type: 'string',
              description: 'Username (without @)'
            },
            max_results: {
              type: 'number',
              description: 'Maximum number of results (default: 10, max: 100)'
            },
            start_time: {
              type: 'string',
              description: 'Start time in ISO 8601 format (optional)'
            },
            end_time: {
              type: 'string',
              description: 'End time in ISO 8601 format (optional)'
            }
          }
        }
      },
      {
        name: 'x_search_tweets',
        description: 'Search for tweets using a query',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (e.g., "hello world", "from:username", "#hashtag")'
            },
            max_results: {
              type: 'number',
              description: 'Maximum number of results (default: 10, max: 100)'
            },
            start_time: {
              type: 'string',
              description: 'Start time in ISO 8601 format (optional)'
            },
            end_time: {
              type: 'string',
              description: 'End time in ISO 8601 format (optional)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'x_post_tweet',
        description: 'Post a new tweet',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Tweet text (max 280 characters)'
            },
            reply_to_tweet_id: {
              type: 'string',
              description: 'Tweet ID to reply to (optional)'
            }
          },
          required: ['text']
        }
      },
      {
        name: 'x_delete_tweet',
        description: 'Delete a tweet',
        inputSchema: {
          type: 'object',
          properties: {
            tweet_id: {
              type: 'string',
              description: 'Tweet ID to delete'
            }
          },
          required: ['tweet_id']
        }
      },
      {
        name: 'x_get_my_tweets',
        description: 'Get the authenticated user\'s own tweets',
        inputSchema: {
          type: 'object',
          properties: {
            max_results: {
              type: 'number',
              description: 'Maximum number of results (default: 10, max: 100)'
            },
            start_time: {
              type: 'string',
              description: 'Start time in ISO 8601 format (optional)'
            },
            end_time: {
              type: 'string',
              description: 'End time in ISO 8601 format (optional)'
            }
          }
        }
      }
    ];
  }

  /**
   * Call a tool - direct API implementation
   * Automatically refreshes token if expired before making API calls
   */
  async callTool(connection, toolName, args) {
    if (!connection || !connection.accessToken) {
      throw new Error('Not connected to X');
    }

    // Refresh token if needed before making request (like Spotify/Jira)
    let accessToken = connection.accessToken;
    if (connection.refreshToken && connection.userId) {
      accessToken = await this.refreshTokenIfNeeded(
        connection.accessToken,
        connection.refreshToken,
        connection.userId
      );
      // Update connection with refreshed token
      connection.accessToken = accessToken;
    }

    try {
      switch (toolName) {
        case 'x_get_user_info':
          return await this.handleGetUserInfo(connection, args);
        case 'x_get_my_info':
          return await this.handleGetMyInfo(connection, args);
        case 'x_get_tweet':
          return await this.handleGetTweet(connection, args);
        case 'x_get_user_tweets':
          return await this.handleGetUserTweets(connection, args);
        case 'x_search_tweets':
          return await this.handleSearchTweets(connection, args);
        case 'x_post_tweet':
          return await this.handlePostTweet(connection, args);
        case 'x_delete_tweet':
          return await this.handleDeleteTweet(connection, args);
        case 'x_get_my_tweets':
          return await this.handleGetMyTweets(connection, args);
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
   * Handle x_get_user_info
   */
  async handleGetUserInfo(connection, args) {
    const { username, user_id, fields = [] } = args;
    
    if (!username && !user_id) {
      throw new Error('Either username or user_id is required');
    }

    const params = {};
    if (fields.length > 0) {
      params['user.fields'] = fields.join(',');
    }

    let endpoint;
    if (username) {
      endpoint = `/users/by/username/${username}`;
    } else {
      endpoint = `/users/${user_id}`;
    }

    const data = await this.makeRequest('GET', endpoint, connection.accessToken, params);

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify(data.data || data, null, 2)
      }]
    };
  }

  /**
   * Handle x_get_my_info
   */
  async handleGetMyInfo(connection, args) {
    const { fields = [] } = args;
    const params = {};
    if (fields.length > 0) {
      params['user.fields'] = fields.join(',');
    }

    const data = await this.makeRequest('GET', '/users/me', connection.accessToken, params);

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify(data.data || data, null, 2)
      }]
    };
  }

  /**
   * Handle x_get_tweet
   */
  async handleGetTweet(connection, args) {
    const { tweet_id, fields = [] } = args;
    const params = {};
    if (fields.length > 0) {
      params['tweet.fields'] = fields.join(',');
    }

    const data = await this.makeRequest('GET', `/tweets/${tweet_id}`, connection.accessToken, params);

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify(data.data || data, null, 2)
      }]
    };
  }

  /**
   * Handle x_get_user_tweets
   */
  async handleGetUserTweets(connection, args) {
    const { user_id, username, max_results = 10, start_time, end_time } = args;
    
    if (!user_id && !username) {
      throw new Error('Either user_id or username is required');
    }

    // First get user_id if username provided
    let userId = user_id;
    if (username) {
      const userData = await this.makeRequest('GET', `/users/by/username/${username}`, connection.accessToken);
      userId = userData.data.id;
    }

    const params = {
      max_results: Math.min(max_results, 100),
      'tweet.fields': 'created_at,author_id,public_metrics,text',
    };
    if (start_time) params.start_time = start_time;
    if (end_time) params.end_time = end_time;

    const data = await this.makeRequest('GET', `/users/${userId}/tweets`, connection.accessToken, params);

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          tweets: data.data || [],
          meta: data.meta || {},
        }, null, 2)
      }]
    };
  }

  /**
   * Handle x_search_tweets
   */
  async handleSearchTweets(connection, args) {
    const { query, max_results = 10, start_time, end_time } = args;
    const params = {
      query,
      max_results: Math.min(max_results, 100),
      'tweet.fields': 'created_at,author_id,public_metrics,text',
    };
    if (start_time) params.start_time = start_time;
    if (end_time) params.end_time = end_time;

    const data = await this.makeRequest('GET', '/tweets/search/recent', connection.accessToken, params);

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          tweets: data.data || [],
          meta: data.meta || {},
        }, null, 2)
      }]
    };
  }

  /**
   * Handle x_post_tweet
   */
  async handlePostTweet(connection, args) {
    const { text, reply_to_tweet_id } = args;
    
    if (!text || text.length === 0) {
      throw new Error('Tweet text is required');
    }
    if (text.length > 280) {
      throw new Error('Tweet text cannot exceed 280 characters');
    }

    const payload = { text };
    if (reply_to_tweet_id) {
      payload.reply = {
        in_reply_to_tweet_id: reply_to_tweet_id,
      };
    }

    const data = await this.makeRequest('POST', '/tweets', connection.accessToken, payload);

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          tweet: data.data || data,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle x_delete_tweet
   */
  async handleDeleteTweet(connection, args) {
    const { tweet_id } = args;
    
    if (!tweet_id) {
      throw new Error('Tweet ID is required');
    }

    const data = await this.makeRequest('DELETE', `/tweets/${tweet_id}`, connection.accessToken);

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          deleted: data.data?.deleted || false,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle x_get_my_tweets
   */
  async handleGetMyTweets(connection, args) {
    const { max_results = 10, start_time, end_time } = args;
    
    // Get authenticated user ID first
    const userData = await this.makeRequest('GET', '/users/me', connection.accessToken);
    const userId = userData.data.id;

    const params = {
      max_results: Math.min(max_results, 100),
      'tweet.fields': 'created_at,author_id,public_metrics,text',
    };
    if (start_time) params.start_time = start_time;
    if (end_time) params.end_time = end_time;

    // Use the user's tweets endpoint
    const data = await this.makeRequest('GET', `/users/${userId}/tweets`, connection.accessToken, params);

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          tweets: data.data || [],
          meta: data.meta || {},
        }, null, 2)
      }]
    };
  }
}

module.exports = XIntegration;

