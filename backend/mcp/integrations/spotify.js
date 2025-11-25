const axios = require('axios');
const crypto = require('crypto');

/**
 * Spotify Integration (Direct API)
 * Directly uses Spotify Web API without MCP server
 * No Python, no cache files, no external processes - just direct API calls
 */
class SpotifyIntegration {
  constructor() {
    this.name = 'Spotify';
    this.type = 'spotify';
    this.description = 'Control Spotify playback, manage playlists, and search music';
    this.icon = 'https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png';
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.baseURL = 'https://api.spotify.com/v1';
  }

  /**
   * Decrypt access token with fallback for different encryption methods
   */
  decryptToken(encryptedToken) {
    // Check if token is already plain text (not encrypted)
    if (!encryptedToken.includes(':')) {
      return encryptedToken;
    }

    // Try multiple decryption methods
    const methods = [
      // Method 1: Storage system method (scryptSync with salt)
      () => {
        const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'change-this-to-a-secure-32-char-key!!';
        const parts = encryptedToken.split(':');
        if (parts.length < 2) throw new Error('Invalid token format');
        
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = parts.join(':');
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      },
      
      // Method 2: Direct key method
      () => {
        const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'change-this-to-a-secure-32-char-key!!';
        const key = Buffer.from(ENCRYPTION_KEY).subarray(0, 32);
        const [ivHex, encrypted] = encryptedToken.split(':');
        if (!ivHex || !encrypted) throw new Error('Invalid token format');
        
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      },
      
      // Method 3: Storage system decrypt function
      () => {
        const { decrypt } = require('../../storage/integrations.js');
        return decrypt(encryptedToken);
      }
    ];
    
    for (let i = 0; i < methods.length; i++) {
      try {
        return methods[i]();
      } catch (error) {
        if (i === methods.length - 1) {
          // Last method failed, try to use token as-is if it looks valid
          if (encryptedToken.startsWith('BQ') && encryptedToken.length > 100) {
            return encryptedToken;
          }
          throw new Error('Failed to decrypt token');
        }
      }
    }
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded(accessToken, refreshToken) {
    if (!refreshToken || !this.clientId || !this.clientSecret) {
      return accessToken;
    }

    try {
      const SpotifyOAuth = require('../../oauth/integrations/spotify.js');
      const spotifyOAuth = new SpotifyOAuth();
      
      // Try to validate token
      try {
        await Promise.race([
          spotifyOAuth.validateToken(accessToken),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);
        return accessToken; // Token is valid
      } catch (validationError) {
        // Token invalid or expired, refresh it
        console.log('⚠️  Token validation failed, refreshing...');
        const refreshResult = await Promise.race([
          spotifyOAuth.refreshAccessToken(refreshToken),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        console.log('✅ Token refreshed successfully');
        return refreshResult.accessToken;
      }
    } catch (error) {
      console.log('⚠️  Could not validate/refresh token, using existing:', error.message);
      return accessToken;
    }
  }

  /**
   * Make authenticated API request to Spotify
   */
  async makeRequest(method, endpoint, accessToken, data = null) {
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

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Spotify API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Connect to Spotify (no actual connection needed - just store tokens)
   */
  async connect(config) {
    if (!config || !config.token) {
      throw new Error('Spotify access token is required');
    }

    // Decrypt token
    let accessToken;
    try {
      accessToken = this.decryptToken(config.token);
    } catch (decryptError) {
      if (config.token.startsWith('BQ') && config.token.length > 100) {
        accessToken = config.token;
      } else {
        throw new Error('Invalid token format');
      }
    }

    const refreshToken = config.refreshToken || '';
    const userId = config.userId || 'default-user';

    // Ensure token is valid
    const validToken = await this.refreshTokenIfNeeded(accessToken, refreshToken);

    // Test connection with a simple API call
    try {
      await this.makeRequest('GET', '/me', validToken);
      console.log(`✅ Spotify connection verified for user ${userId}`);
    } catch (error) {
      throw new Error(`Failed to verify Spotify connection: ${error.message}`);
    }

    return {
      accessToken: validToken,
      refreshToken: refreshToken,
      userId: userId,
    };
  }

  /**
   * Disconnect from Spotify (no cleanup needed)
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
        name: 'SpotifyPlayback',
        description: 'Control Spotify playback: get current track, play, pause, resume, skip, set volume',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['get', 'play', 'pause', 'resume', 'skip', 'previous', 'volume'],
              description: 'Action to perform: get (current track), play, pause, resume, skip, previous, volume'
            },
            track_uri: {
              type: 'string',
              description: 'Spotify track URI (e.g., spotify:track:4iV5W9uYEdYUVa79Axb7Rh) - required for play action'
            },
            volume: {
              type: 'number',
              description: 'Volume level (0-100) - required for volume action'
            },
            device_id: {
              type: 'string',
              description: 'Device ID to play on (optional)'
            }
          },
          required: ['action']
        }
      },
      {
        name: 'SpotifySearch',
        description: 'Search for tracks, artists, albums, or playlists on Spotify',
        inputSchema: {
          type: 'object',
          properties: {
            qtype: {
              type: 'string',
              enum: ['track', 'artist', 'album', 'playlist'],
              description: 'Type of search: track, artist, album, or playlist'
            },
            query: {
              type: 'string',
              description: 'Search query (e.g., "night changes one direction")'
            },
            limit: {
              type: 'number',
              description: 'Number of results to return (default: 20, max: 50)'
            }
          },
          required: ['qtype', 'query']
        }
      },
      {
        name: 'SpotifyQueue',
        description: 'Manage Spotify queue: add tracks, view queue',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['add', 'get'],
              description: 'Action: add (add track to queue) or get (get current queue)'
            },
            track_id: {
              type: 'string',
              description: 'Spotify track ID - required for add action'
            },
            device_id: {
              type: 'string',
              description: 'Device ID (optional)'
            }
          },
          required: ['action']
        }
      },
      {
        name: 'SpotifyGetInfo',
        description: 'Get information about tracks, artists, albums, or playlists',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['track', 'artist', 'album', 'playlist'],
              description: 'Type of item to get info for'
            },
            id: {
              type: 'string',
              description: 'Spotify ID of the item'
            }
          },
          required: ['type', 'id']
        }
      },
      {
        name: 'SpotifyPlaylist',
        description: 'Manage Spotify playlists: create, get, add tracks, remove tracks',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['create', 'get', 'add', 'remove'],
              description: 'Action to perform'
            },
            playlist_id: {
              type: 'string',
              description: 'Playlist ID (required for get, add, remove)'
            },
            name: {
              type: 'string',
              description: 'Playlist name (required for create)'
            },
            track_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of track IDs (required for add, remove)'
            }
          },
          required: ['action']
        }
      },
      {
        name: 'SpotifySearchAndPlay',
        description: 'Search for a song and immediately play it',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Song name and artist (e.g., "night changes one direction")'
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
      throw new Error('Not connected to Spotify');
    }

    // Refresh token if needed before making request
    const accessToken = await this.refreshTokenIfNeeded(
      connection.accessToken,
      connection.refreshToken
    );
    
    // Update connection with refreshed token
    if (accessToken !== connection.accessToken) {
      connection.accessToken = accessToken;
    }

    try {
      switch (toolName) {
        case 'SpotifyPlayback':
          return await this.handlePlayback(connection, args);
        case 'SpotifySearch':
          return await this.handleSearch(connection, args);
        case 'SpotifyQueue':
          return await this.handleQueue(connection, args);
        case 'SpotifyGetInfo':
          return await this.handleGetInfo(connection, args);
        case 'SpotifyPlaylist':
          return await this.handlePlaylist(connection, args);
        case 'SpotifySearchAndPlay':
          return await this.handleSearchAndPlay(connection, args);
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
   * Handle SpotifyPlayback tool
   */
  async handlePlayback(connection, args) {
    const { action, track_uri, volume, device_id } = args;
    const accessToken = connection.accessToken;

    switch (action) {
      case 'get': {
        const data = await this.makeRequest('GET', '/me/player/currently-playing', accessToken);
        if (!data || !data.item) {
          return {
            isError: false,
            content: [{
              type: 'text',
              text: JSON.stringify({ message: 'No track currently playing' })
            }]
          };
        }
        return {
          isError: false,
          content: [{
            type: 'text',
            text: JSON.stringify({
              is_playing: data.is_playing,
              track: {
                name: data.item.name,
                artist: data.item.artists?.map(a => a.name).join(', ') || 'Unknown',
                album: data.item.album?.name || 'Unknown',
                duration_ms: data.item.duration_ms,
                progress_ms: data.progress_ms
              }
            })
          }]
        };
      }
      case 'play': {
        const playData = {};
        if (track_uri) playData.uris = [track_uri];
        if (device_id) playData.device_id = device_id;
        await this.makeRequest('PUT', '/me/player/play' + (device_id ? `?device_id=${device_id}` : ''), accessToken, playData);
        return {
          isError: false,
          content: [{ type: 'text', text: JSON.stringify({ message: 'Playback started' }) }]
        };
      }
      case 'pause': {
        await this.makeRequest('PUT', '/me/player/pause' + (device_id ? `?device_id=${device_id}` : ''), accessToken);
        return {
          isError: false,
          content: [{ type: 'text', text: JSON.stringify({ message: 'Playback paused' }) }]
        };
      }
      case 'resume': {
        await this.makeRequest('PUT', '/me/player/play' + (device_id ? `?device_id=${device_id}` : ''), accessToken);
        return {
          isError: false,
          content: [{ type: 'text', text: JSON.stringify({ message: 'Playback resumed' }) }]
        };
      }
      case 'skip': {
        await this.makeRequest('POST', '/me/player/next' + (device_id ? `?device_id=${device_id}` : ''), accessToken);
        return {
          isError: false,
          content: [{ type: 'text', text: JSON.stringify({ message: 'Skipped to next track' }) }]
        };
      }
      case 'previous': {
        await this.makeRequest('POST', '/me/player/previous' + (device_id ? `?device_id=${device_id}` : ''), accessToken);
        return {
          isError: false,
          content: [{ type: 'text', text: JSON.stringify({ message: 'Previous track' }) }]
        };
      }
      case 'volume': {
        if (volume === undefined) {
          throw new Error('Volume level (0-100) is required');
        }
        await this.makeRequest('PUT', `/me/player/volume?volume_percent=${volume}` + (device_id ? `&device_id=${device_id}` : ''), accessToken);
        return {
          isError: false,
          content: [{ type: 'text', text: JSON.stringify({ message: `Volume set to ${volume}%` }) }]
        };
      }
      default:
        throw new Error(`Unknown playback action: ${action}`);
    }
  }

  /**
   * Handle SpotifySearch tool
   */
  async handleSearch(connection, args) {
    const { qtype, query, limit = 20 } = args;
    const accessToken = connection.accessToken;

    const searchQuery = encodeURIComponent(query);
    const type = qtype === 'track' ? 'track' : qtype === 'artist' ? 'artist' : qtype === 'album' ? 'album' : 'playlist';
    const endpoint = `/search?q=${searchQuery}&type=${type}&limit=${Math.min(limit, 50)}`;

    const data = await this.makeRequest('GET', endpoint, accessToken);
    
    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify(data)
      }]
    };
  }

  /**
   * Handle SpotifyQueue tool
   */
  async handleQueue(connection, args) {
    const { action, track_id, device_id } = args;
    const accessToken = connection.accessToken;

    if (action === 'add') {
      if (!track_id) {
        throw new Error('track_id is required for add action');
      }
      const uri = `spotify:track:${track_id}`;
      await this.makeRequest('POST', `/me/player/queue?uri=${uri}` + (device_id ? `&device_id=${device_id}` : ''), accessToken);
      return {
        isError: false,
        content: [{ type: 'text', text: JSON.stringify({ message: 'Track added to queue' }) }]
      };
    } else if (action === 'get') {
      // Queue endpoint doesn't exist in Spotify API, return current playback instead
      const data = await this.makeRequest('GET', '/me/player', accessToken);
      return {
        isError: false,
        content: [{
          type: 'text',
          text: JSON.stringify({
            queue: data.queue || [],
            currently_playing: data.item
          })
        }]
      };
    } else {
      throw new Error(`Unknown queue action: ${action}`);
    }
  }

  /**
   * Handle SpotifyGetInfo tool
   */
  async handleGetInfo(connection, args) {
    const { type, id } = args;
    const accessToken = connection.accessToken;

    if (!id) {
      throw new Error('id is required');
    }

    const endpoint = `/${type}s/${id}`;
    const data = await this.makeRequest('GET', endpoint, accessToken);
    
    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify(data)
      }]
    };
  }

  /**
   * Handle SpotifyPlaylist tool
   */
  async handlePlaylist(connection, args) {
    const { action, playlist_id, name, track_ids } = args;
    const accessToken = connection.accessToken;

    // Get user ID first
    const userData = await this.makeRequest('GET', '/me', accessToken);
    const userId = userData.id;

    switch (action) {
      case 'create': {
        if (!name) {
          throw new Error('name is required for create action');
        }
        const createData = { name, public: false };
        const playlist = await this.makeRequest('POST', `/users/${userId}/playlists`, accessToken, createData);
        return {
          isError: false,
          content: [{ type: 'text', text: JSON.stringify(playlist) }]
        };
      }
      case 'get': {
        if (!playlist_id) {
          throw new Error('playlist_id is required for get action');
        }
        const playlist = await this.makeRequest('GET', `/playlists/${playlist_id}`, accessToken);
        return {
          isError: false,
          content: [{ type: 'text', text: JSON.stringify(playlist) }]
        };
      }
      case 'add': {
        if (!playlist_id || !track_ids || track_ids.length === 0) {
          throw new Error('playlist_id and track_ids are required for add action');
        }
        const uris = track_ids.map(id => `spotify:track:${id}`);
        await this.makeRequest('POST', `/playlists/${playlist_id}/tracks`, accessToken, { uris });
        return {
          isError: false,
          content: [{ type: 'text', text: JSON.stringify({ message: 'Tracks added to playlist' }) }]
        };
      }
      case 'remove': {
        if (!playlist_id || !track_ids || track_ids.length === 0) {
          throw new Error('playlist_id and track_ids are required for remove action');
        }
        const tracks = track_ids.map(id => ({ uri: `spotify:track:${id}` }));
        await this.makeRequest('DELETE', `/playlists/${playlist_id}/tracks`, accessToken, { tracks });
        return {
          isError: false,
          content: [{ type: 'text', text: JSON.stringify({ message: 'Tracks removed from playlist' }) }]
        };
      }
      default:
        throw new Error(`Unknown playlist action: ${action}`);
    }
  }

  /**
   * Handle SpotifySearchAndPlay tool
   */
  async handleSearchAndPlay(connection, args) {
    const { query } = args;
    const accessToken = connection.accessToken;

    // Search for the track
    const searchQuery = encodeURIComponent(query);
    const searchData = await this.makeRequest('GET', `/search?q=${searchQuery}&type=track&limit=1`, accessToken);
    
    if (!searchData.tracks || searchData.tracks.items.length === 0) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'No tracks found for the search query' }]
      };
    }

    const track = searchData.tracks.items[0];
    const trackUri = track.uri;

    // Play the track
    await this.makeRequest('PUT', '/me/player/play', accessToken, { uris: [trackUri] });

    return {
      isError: false,
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: `Now playing: ${track.name} by ${track.artists.map(a => a.name).join(', ')}`,
          track: {
            name: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            album: track.album.name,
            id: track.id
          }
        })
      }]
    };
  }
}

module.exports = SpotifyIntegration;
