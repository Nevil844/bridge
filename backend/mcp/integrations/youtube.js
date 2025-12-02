const { google } = require('googleapis');

/**
 * YouTube Integration (Direct API)
 * Directly uses YouTube Data API v3 without MCP server
 * Provides video search, playlist management, and channel interactions
 */
class YouTubeIntegration {
  constructor() {
    this.name = 'YouTube';
    this.type = 'youtube';
    this.description = 'Search videos, manage playlists, and access your YouTube content';
    this.icon = 'https://www.youtube.com/img/desktop/yt_1200.png';
  }

  /**
   * Connect to YouTube API
   * @param {Object} config - Integration configuration
   * @param {string} config.token - Google access token
   * @param {string} config.refreshToken - Google refresh token
   * @returns {Promise<Object>} - YouTube client
   */
  async connect(config) {
    if (!config || !config.token || !config.refreshToken) {
      throw new Error('YouTube access token and refresh token are required');
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID || process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
      );
      
      oauth2Client.setCredentials({
        access_token: config.token,
        refresh_token: config.refreshToken,
      });

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      
      // Test the connection
      await youtube.channels.list({
        part: 'snippet',
        mine: true,
      });
      
      return { youtube, oauth2Client };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Disconnect from YouTube
   */
  async disconnect(connection) {
    // No cleanup needed for direct API integration
  }

  /**
   * Get available tools
   */
  async getTools(connection) {
    return [
      {
        name: 'youtube_search_videos',
        description: 'Search for videos on YouTube',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            max_results: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10, max: 50)'
            },
            order: {
              type: 'string',
              description: 'Order results by: relevance, date, rating, title, videoCount, viewCount (default: relevance)',
              enum: ['relevance', 'date', 'rating', 'title', 'videoCount', 'viewCount']
            }
          },
          required: ['query']
        }
      },
      {
        name: 'youtube_search_channels',
        description: 'Search for YouTube channels by name. Use this when user asks about a channel by name (e.g., "Tanmay Bhatt", "PewDiePie", etc.). Returns channel IDs that can be used with youtube_get_channel_info.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Channel name or search query (e.g., "Tanmay Bhatt", "PewDiePie")'
            },
            max_results: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10, max: 50)'
            },
            order: {
              type: 'string',
              description: 'Order results by: relevance, date, rating, title, videoCount, viewCount (default: relevance)',
              enum: ['relevance', 'date', 'rating', 'title', 'videoCount', 'viewCount']
            }
          },
          required: ['query']
        }
      },
      {
        name: 'youtube_get_video_info',
        description: 'Get detailed information about a specific video',
        inputSchema: {
          type: 'object',
          properties: {
            video_id: {
              type: 'string',
              description: 'YouTube video ID'
            }
          },
          required: ['video_id']
        }
      },
      {
        name: 'youtube_get_video_metadata',
        description: 'Get comprehensive video metadata including views, likes, comments, duration, tags, and more. Returns detailed JSON with all available video information.',
        inputSchema: {
          type: 'object',
          properties: {
            video_id: {
              type: 'string',
              description: 'YouTube video ID'
            },
            fields: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Optional array of specific fields to return (e.g., ["title", "viewCount", "likeCount"]). If not provided, returns all metadata.'
            }
          },
          required: ['video_id']
        }
      },
      {
        name: 'youtube_get_video_metadata_summary',
        description: 'Get a human-readable summary of video metadata with key information formatted for easy reading.',
        inputSchema: {
          type: 'object',
          properties: {
            video_id: {
              type: 'string',
              description: 'YouTube video ID'
            }
          },
          required: ['video_id']
        }
      },
      {
        name: 'youtube_list_subtitle_languages',
        description: 'List all available subtitle/caption languages for a video. Returns available languages, formats, and whether they are auto-generated.',
        inputSchema: {
          type: 'object',
          properties: {
            video_id: {
              type: 'string',
              description: 'YouTube video ID'
            }
          },
          required: ['video_id']
        }
      },
      {
        name: 'youtube_download_subtitles',
        description: 'Download subtitles/captions for a video in VTT format with timestamps. Returns raw VTT subtitle content.',
        inputSchema: {
          type: 'object',
          properties: {
            video_id: {
              type: 'string',
              description: 'YouTube video ID'
            },
            language: {
              type: 'string',
              description: 'Language code (e.g., "en", "es", "fr"). Defaults to "en" if not specified. Use youtube_list_subtitle_languages to see available languages.'
            }
          },
          required: ['video_id']
        }
      },
      {
        name: 'youtube_get_transcript',
        description: 'Get a clean plain text transcript of a video without timestamps or formatting. Perfect for reading video content as text.',
        inputSchema: {
          type: 'object',
          properties: {
            video_id: {
              type: 'string',
              description: 'YouTube video ID'
            },
            language: {
              type: 'string',
              description: 'Language code (e.g., "en", "es", "fr"). Defaults to "en" if not specified. Use youtube_list_subtitle_languages to see available languages.'
            }
          },
          required: ['video_id']
        }
      },
      {
        name: 'youtube_list_playlists',
        description: 'List all playlists for the authenticated user',
        inputSchema: {
          type: 'object',
          properties: {
            max_results: {
              type: 'number',
              description: 'Maximum number of results to return (default: 25, max: 50)'
            }
          }
        }
      },
      {
        name: 'youtube_get_playlist_items',
        description: 'Get videos in a specific playlist',
        inputSchema: {
          type: 'object',
          properties: {
            playlist_id: {
              type: 'string',
              description: 'YouTube playlist ID'
            },
            max_results: {
              type: 'number',
              description: 'Maximum number of results to return (default: 25, max: 50)'
            }
          },
          required: ['playlist_id']
        }
      },
      {
        name: 'youtube_get_channel_info',
        description: 'Get information about a YouTube channel',
        inputSchema: {
          type: 'object',
          properties: {
            channel_id: {
              type: 'string',
              description: 'YouTube channel ID (use "mine" for authenticated user\'s channel)'
            }
          }
        }
      },
      {
        name: 'youtube_get_channel_videos',
        description: 'Get videos from a specific channel',
        inputSchema: {
          type: 'object',
          properties: {
            channel_id: {
              type: 'string',
              description: 'YouTube channel ID'
            },
            max_results: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10, max: 50)'
            },
            order: {
              type: 'string',
              description: 'Order results by: date, rating, relevance, title, videoCount, viewCount (default: date)',
              enum: ['date', 'rating', 'relevance', 'title', 'videoCount', 'viewCount']
            }
          },
          required: ['channel_id']
        }
      },
      {
        name: 'youtube_list_subscriptions',
        description: 'List all channels the authenticated user is subscribed to. Use this when user asks about "my subscriptions", "subscribed channels", or "channels I follow".',
        inputSchema: {
          type: 'object',
          properties: {
            max_results: {
              type: 'number',
              description: 'Maximum number of subscriptions to return (default: 25, max: 50)'
            },
            order: {
              type: 'string',
              description: 'Order results by: alphabetical, relevance, unread (default: alphabetical)',
              enum: ['alphabetical', 'relevance', 'unread']
            }
          }
        }
      },
    ];
  }

  /**
   * Call a tool
   */
  async callTool(connection, toolName, args) {
    const { youtube } = connection;
    if (!youtube) {
      throw new Error('YouTube not connected');
    }

    try {
      switch (toolName) {
        case 'youtube_search_videos':
          return await this.handleSearchVideos(connection, args);
        case 'youtube_search_channels':
          return await this.handleSearchChannels(connection, args);
        case 'youtube_get_video_info':
          return await this.handleGetVideoInfo(connection, args);
        case 'youtube_get_video_metadata':
          return await this.handleGetVideoMetadata(connection, args);
        case 'youtube_get_video_metadata_summary':
          return await this.handleGetVideoMetadataSummary(connection, args);
        case 'youtube_list_subtitle_languages':
          return await this.handleListSubtitleLanguages(connection, args);
        case 'youtube_download_subtitles':
          return await this.handleDownloadSubtitles(connection, args);
        case 'youtube_get_transcript':
          return await this.handleGetTranscript(connection, args);
        case 'youtube_list_playlists':
          return await this.handleListPlaylists(connection, args);
        case 'youtube_get_playlist_items':
          return await this.handleGetPlaylistItems(connection, args);
        case 'youtube_get_channel_info':
          return await this.handleGetChannelInfo(connection, args);
        case 'youtube_get_channel_videos':
          return await this.handleGetChannelVideos(connection, args);
        case 'youtube_list_subscriptions':
          return await this.handleListSubscriptions(connection, args);
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`Error executing ${toolName}:`, error.message);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error.message,
              details: error.response?.data?.error || error.stack,
            }),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle youtube_search_videos
   */
  async handleSearchVideos(connection, args) {
    const { youtube } = connection;
    const { query, max_results = 10, order = 'relevance' } = args;
    
    const response = await youtube.search.list({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: Math.min(max_results, 50),
      order: order,
    });

    const data = response.data;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          videos: data.items.map(item => ({
            video_id: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            channel_title: item.snippet.channelTitle,
            channel_id: item.snippet.channelId,
            published_at: item.snippet.publishedAt,
            thumbnails: item.snippet.thumbnails,
          })),
          count: data.items.length,
          total_results: data.pageInfo?.totalResults || 0,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle youtube_search_channels
   */
  async handleSearchChannels(connection, args) {
    const { youtube } = connection;
    const { query, max_results = 10, order = 'relevance' } = args;
    
    const response = await youtube.search.list({
      part: 'snippet',
      q: query,
      type: 'channel',
      maxResults: Math.min(max_results, 50),
      order: order,
    });

    const data = response.data;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          channels: data.items.map(item => ({
            channel_id: item.id.channelId,
            title: item.snippet.title,
            description: item.snippet.description,
            published_at: item.snippet.publishedAt,
            thumbnails: item.snippet.thumbnails,
            custom_url: item.snippet.customUrl || null,
          })),
          count: data.items.length,
          total_results: data.pageInfo?.totalResults || 0,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle youtube_get_video_info
   */
  async handleGetVideoInfo(connection, args) {
    const { youtube } = connection;
    const { video_id } = args;
    
    const response = await youtube.videos.list({
      part: 'snippet,statistics,contentDetails',
      id: video_id,
    });

    const data = response.data;
    if (!data.items || data.items.length === 0) {
      throw new Error(`Video not found: ${video_id}`);
    }

    const video = data.items[0];
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          video_id: video.id,
          title: video.snippet.title,
          description: video.snippet.description,
          channel_title: video.snippet.channelTitle,
          channel_id: video.snippet.channelId,
          published_at: video.snippet.publishedAt,
          thumbnails: video.snippet.thumbnails,
          view_count: video.statistics.viewCount,
          like_count: video.statistics.likeCount,
          comment_count: video.statistics.commentCount,
          duration: video.contentDetails.duration,
          tags: video.snippet.tags || [],
        }, null, 2)
      }]
    };
  }

  /**
   * Handle youtube_get_video_metadata
   */
  async handleGetVideoMetadata(connection, args) {
    const { youtube } = connection;
    const { video_id, fields } = args;
    
    const response = await youtube.videos.list({
      part: 'snippet,statistics,contentDetails,status,topicDetails,recordingDetails',
      id: video_id,
    });

    const data = response.data;
    if (!data.items || data.items.length === 0) {
      throw new Error(`Video not found: ${video_id}`);
    }

    const video = data.items[0];
    const metadata = {
      video_id: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      channel_title: video.snippet.channelTitle,
      channel_id: video.snippet.channelId,
      published_at: video.snippet.publishedAt,
      thumbnails: video.snippet.thumbnails,
      category_id: video.snippet.categoryId,
      default_language: video.snippet.defaultLanguage,
      default_audio_language: video.snippet.defaultAudioLanguage,
      tags: video.snippet.tags || [],
      view_count: video.statistics.viewCount,
      like_count: video.statistics.likeCount,
      comment_count: video.statistics.commentCount,
      favorite_count: video.statistics.favoriteCount,
      duration: video.contentDetails.duration,
      dimension: video.contentDetails.dimension,
      definition: video.contentDetails.definition,
      caption: video.contentDetails.caption,
      licensed_content: video.contentDetails.licensedContent,
      projection: video.contentDetails.projection,
      privacy_status: video.status?.privacyStatus,
      upload_status: video.status?.uploadStatus,
      made_for_kids: video.status?.selfDeclaredMadeForKids,
      recording_date: video.recordingDetails?.recordingDate,
      location: video.recordingDetails?.location,
      topic_categories: video.topicDetails?.topicCategories || [],
      relevant_topic_ids: video.topicDetails?.relevantTopicIds || [],
    };

    // Filter fields if specified
    if (fields && Array.isArray(fields) && fields.length > 0) {
      const filtered = {};
      fields.forEach(field => {
        if (metadata.hasOwnProperty(field)) {
          filtered[field] = metadata[field];
        }
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(filtered, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(metadata, null, 2)
      }]
    };
  }

  /**
   * Handle youtube_get_video_metadata_summary
   */
  async handleGetVideoMetadataSummary(connection, args) {
    const { youtube } = connection;
    const { video_id } = args;
    
    const response = await youtube.videos.list({
      part: 'snippet,statistics,contentDetails',
      id: video_id,
    });

    const data = response.data;
    if (!data.items || data.items.length === 0) {
      throw new Error(`Video not found: ${video_id}`);
    }

    const video = data.items[0];
    
    // Format duration (ISO 8601 to readable)
    const duration = video.contentDetails.duration || 'N/A';
    const durationMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    let durationStr = 'N/A';
    if (durationMatch) {
      const hours = durationMatch[1] || '0';
      const minutes = durationMatch[2] || '0';
      const seconds = durationMatch[3] || '0';
      durationStr = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
    }

    const summary = `📺 **${video.snippet.title}**

👤 **Channel:** ${video.snippet.channelTitle}
📅 **Published:** ${new Date(video.snippet.publishedAt).toLocaleDateString()}
⏱️ **Duration:** ${durationStr}
👁️ **Views:** ${parseInt(video.statistics.viewCount || 0).toLocaleString()}
👍 **Likes:** ${parseInt(video.statistics.likeCount || 0).toLocaleString()}
💬 **Comments:** ${parseInt(video.statistics.commentCount || 0).toLocaleString()}

📝 **Description:**
${video.snippet.description ? (video.snippet.description.substring(0, 500) + (video.snippet.description.length > 500 ? '...' : '')) : 'No description'}

🏷️ **Tags:** ${video.snippet.tags ? video.snippet.tags.slice(0, 10).join(', ') : 'None'}

🔗 **Video ID:** ${video.id}
🔗 **URL:** https://www.youtube.com/watch?v=${video.id}`;

    return {
      content: [{
        type: 'text',
        text: summary
      }]
    };
  }

  /**
   * Handle youtube_list_subtitle_languages
   */
  async handleListSubtitleLanguages(connection, args) {
    const { youtube } = connection;
    const { video_id } = args;
    
    const response = await youtube.captions.list({
      part: 'snippet',
      videoId: video_id,
    });

    const data = response.data;
    const captions = (data.items || []).map(item => ({
      caption_id: item.id,
      language: item.snippet.language,
      language_name: item.snippet.name,
      track_kind: item.snippet.trackKind,
      is_auto_generated: item.snippet.trackKind === 'ASR' || item.snippet.trackKind === 'asr',
      is_translatable: item.snippet.isTranslatable || false,
    }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          video_id,
          available_languages: captions,
          count: captions.length,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle youtube_download_subtitles
   */
  async handleDownloadSubtitles(connection, args) {
    const { youtube, oauth2Client } = connection;
    const { video_id, language = 'en' } = args;
    
    // First, get the caption track ID for the requested language
    const captionsList = await youtube.captions.list({
      part: 'snippet',
      videoId: video_id,
    });

    const captions = captionsList.data.items || [];
    let captionId = null;
    
    // Try to find exact language match first
    for (const caption of captions) {
      if (caption.snippet.language === language) {
        captionId = caption.id;
        break;
      }
    }
    
    // If not found, try to find English as fallback
    if (!captionId) {
      for (const caption of captions) {
        if (caption.snippet.language === 'en' || caption.snippet.language.startsWith('en')) {
          captionId = caption.id;
          break;
        }
      }
    }
    
    // If still not found, use the first available
    if (!captionId && captions.length > 0) {
      captionId = captions[0].id;
    }

    if (!captionId) {
      throw new Error(`No subtitles available for video ${video_id}`);
    }

    // Download the caption track
    const captionResponse = await youtube.captions.download({
      id: captionId,
      tfmt: 'vtt', // VTT format
    }, {
      responseType: 'text',
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          video_id,
          language,
          format: 'vtt',
          subtitle_content: captionResponse.data,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle youtube_get_transcript
   */
  async handleGetTranscript(connection, args) {
    const { youtube } = connection;
    const { video_id, language = 'en' } = args;
    
    // Get subtitles first
    const subtitleResult = await this.handleDownloadSubtitles(connection, { video_id, language });
    const subtitleData = JSON.parse(subtitleResult.content[0].text);
    
    if (!subtitleData.subtitle_content) {
      throw new Error(`No transcript available for video ${video_id}`);
    }

    // Parse VTT and extract clean text
    const vttContent = subtitleData.subtitle_content;
    const lines = vttContent.split('\n');
    const transcriptLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip VTT headers, timestamps, and empty lines
      if (line && 
          !line.startsWith('WEBVTT') && 
          !line.startsWith('NOTE') &&
          !line.match(/^\d{2}:\d{2}:\d{2}/) &&
          !line.match(/^-->/) &&
          line !== '') {
        transcriptLines.push(line);
      }
    }

    const cleanTranscript = transcriptLines.join(' ').replace(/\s+/g, ' ').trim();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          video_id,
          language,
          transcript: cleanTranscript,
          word_count: cleanTranscript.split(' ').length,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle youtube_list_playlists
   */
  async handleListPlaylists(connection, args) {
    const { youtube } = connection;
    const { max_results = 25 } = args;
    
    const response = await youtube.playlists.list({
      part: 'snippet,contentDetails',
      mine: true,
      maxResults: Math.min(max_results, 50),
    });

    const data = response.data;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          playlists: data.items.map(playlist => ({
            playlist_id: playlist.id,
            title: playlist.snippet.title,
            description: playlist.snippet.description,
            channel_title: playlist.snippet.channelTitle,
            channel_id: playlist.snippet.channelId,
            published_at: playlist.snippet.publishedAt,
            thumbnails: playlist.snippet.thumbnails,
            item_count: playlist.contentDetails.itemCount,
          })),
          count: data.items.length,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle youtube_get_playlist_items
   */
  async handleGetPlaylistItems(connection, args) {
    const { youtube } = connection;
    const { playlist_id, max_results = 25 } = args;
    
    const response = await youtube.playlistItems.list({
      part: 'snippet,contentDetails',
      playlistId: playlist_id,
      maxResults: Math.min(max_results, 50),
    });

    const data = response.data;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          videos: data.items.map(item => ({
            video_id: item.contentDetails.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            channel_title: item.snippet.channelTitle,
            channel_id: item.snippet.channelId,
            published_at: item.snippet.publishedAt,
            thumbnails: item.snippet.thumbnails,
            position: item.snippet.position,
          })),
          count: data.items.length,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle youtube_get_channel_info
   */
  async handleGetChannelInfo(connection, args) {
    const { youtube } = connection;
    const { channel_id } = args;
    
    const params = channel_id === 'mine' 
      ? { part: 'snippet,statistics,contentDetails', mine: true }
      : { part: 'snippet,statistics,contentDetails', id: channel_id };

    const response = await youtube.channels.list(params);
    const data = response.data;

    if (!data.items || data.items.length === 0) {
      throw new Error(`Channel not found: ${channel_id}`);
    }

    const channel = data.items[0];
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          channel_id: channel.id,
          title: channel.snippet.title,
          description: channel.snippet.description,
          published_at: channel.snippet.publishedAt,
          thumbnails: channel.snippet.thumbnails,
          subscriber_count: channel.statistics.subscriberCount,
          video_count: channel.statistics.videoCount,
          view_count: channel.statistics.viewCount,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle youtube_get_channel_videos
   */
  async handleGetChannelVideos(connection, args) {
    const { youtube } = connection;
    const { channel_id, max_results = 10, order = 'date' } = args;
    
    // First get the uploads playlist ID from channel
    const channelResponse = await youtube.channels.list({
      part: 'contentDetails',
      id: channel_id,
    });

    const channelData = channelResponse.data;
    if (!channelData.items || channelData.items.length === 0) {
      throw new Error(`Channel not found: ${channel_id}`);
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
    
    // Get videos from uploads playlist
    const response = await youtube.playlistItems.list({
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: Math.min(max_results, 50),
    });

    const data = response.data;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          videos: data.items.map(item => ({
            video_id: item.contentDetails.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            published_at: item.snippet.publishedAt,
            thumbnails: item.snippet.thumbnails,
          })),
          count: data.items.length,
        }, null, 2)
      }]
    };
  }

  /**
   * Handle youtube_list_subscriptions
   */
  async handleListSubscriptions(connection, args) {
    const { youtube } = connection;
    const { max_results = 25, order = 'alphabetical' } = args;
    
    const response = await youtube.subscriptions.list({
      part: 'snippet,contentDetails',
      mine: true,
      maxResults: Math.min(max_results, 50),
      order: order,
    });

    const data = response.data;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          subscriptions: data.items.map(sub => ({
            channel_id: sub.snippet.resourceId.channelId,
            channel_title: sub.snippet.title,
            description: sub.snippet.description,
            published_at: sub.snippet.publishedAt,
            thumbnails: sub.snippet.thumbnails,
            total_item_count: sub.contentDetails.totalItemCount,
            new_video_count: sub.contentDetails.newItemCount || 0,
          })),
          count: data.items.length,
          total_results: data.pageInfo?.totalResults || 0,
        }, null, 2)
      }]
    };
  }
}

module.exports = YouTubeIntegration;

