const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * Spotify MCP Integration
 * Connects to the community-maintained Spotify MCP server
 * https://github.com/varunneal/spotify-mcp
 */
class SpotifyIntegration {
  constructor() {
    this.name = 'Spotify';
    this.type = 'spotify';
    this.description = 'Control Spotify playback, manage playlists, and search music';
    this.icon = 'https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png';
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.scopes = 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private user-library-read user-library-modify user-read-recently-played user-top-read';
  }

  /**
   * Decrypt access token with fallback for different encryption methods
   */
  decryptToken(encryptedToken) {
    // Check if token is already plain text (not encrypted)
    if (!encryptedToken.includes(':')) {
      console.log('Token appears to be plain text, using directly');
      return encryptedToken;
    }

    // Try multiple decryption methods in order of preference
    const methods = [
      // Method 1: Storage system method (scryptSync with salt)
      () => {
        const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'change-this-to-a-secure-32-char-key!!';
        const ALGORITHM = 'aes-256-cbc';
        
        const parts = encryptedToken.split(':');
        if (parts.length < 2) throw new Error('Invalid token format');
        
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = parts.join(':');
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      },
      
      // Method 2: Direct key method (old method)
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
          // Last method failed, try to use token as-is if it looks like a valid token
          if (encryptedToken.startsWith('BQ') && encryptedToken.length > 100) {
            console.log('Using token as-is (appears to be valid Spotify token)');
            return encryptedToken;
          }
          console.error(`All decryption methods failed. Method ${i + 1} error:`, error.message);
          throw new Error('Failed to decrypt token with any method');
        }
        // Try next method
        continue;
      }
    }
  }

  /**
   * Create Spotify cache file for spotipy
   * The Spotify MCP uses spotipy which expects tokens in a cache file
   */
  createSpotifyCache(accessToken, refreshToken, userId) {
    const cacheDir = path.join(os.tmpdir(), 'spotify-mcp-cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const cacheFile = path.join(cacheDir, `.spotify-cache-${userId}`);
    
    // spotipy cache format
    const cacheData = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: this.scopes,
      expires_at: Math.floor(Date.now() / 1000) + 3600, // Current time + 1 hour
    };

    fs.writeFileSync(cacheFile, JSON.stringify(cacheData));
    console.log(`📝 Created Spotify cache at: ${cacheFile}`);
    
    return cacheFile;
  }

  /**
   * Connect to Spotify MCP server
   * Uses the Python-based spotify-mcp package via uvx
   * @param {Object} config - Integration configuration
   * @param {string} config.token - Spotify access token (encrypted)
   * @param {string} config.refreshToken - Spotify refresh token
   * @param {string} config.userId - User ID for cache file
   * @returns {Promise<Object>} - MCP client and process
   */
  async connect(config) {
    if (!config || !config.token) {
      throw new Error('Spotify access token is required');
    }

    try {
      // Decrypt the access token with improved error handling
      let accessToken;
      try {
        accessToken = this.decryptToken(config.token);
      } catch (decryptError) {
        console.log('Decryption failed, trying to use token as-is...');
        // If decryption fails, try using the token directly
        if (config.token.startsWith('BQ') && config.token.length > 100) {
          accessToken = config.token;
          console.log('Using token as-is (appears to be valid Spotify token)');
        } else {
          throw new Error('Invalid token format and decryption failed');
        }
      }
      
      const refreshToken = config.refreshToken || '';
      const userId = config.userId || 'default-user';
      
      // Create spotipy cache file with our tokens
      const cacheFile = this.createSpotifyCache(accessToken, refreshToken, userId);
      
      // Add uvx to PATH for this process
      const uvPath = path.join(os.homedir(), '.local', 'bin');
      const envPath = process.env.PATH || '';
      const newPath = `${uvPath}:${envPath}`;

      const transport = new StdioClientTransport({
        command: 'uvx',
        args: [
          '--python', '3.12',
          '--from', 'git+https://github.com/varunneal/spotify-mcp',
          'spotify-mcp'
        ],
        env: {
          ...process.env,
          PATH: newPath,
          SPOTIFY_CLIENT_ID: this.clientId,
          SPOTIFY_CLIENT_SECRET: this.clientSecret,
          SPOTIFY_REDIRECT_URI: 'http://127.0.0.1:3000/api/oauth/callback',
          SPOTIPY_CACHE_PATH: cacheFile,
        },
      });

      const client = new Client(
        {
          name: 'bridge-ai-spotify',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      await client.connect(transport);
      
      return { 
        client, 
        transport,
        token: config.token,
        refreshToken: config.refreshToken,
      };
    } catch (error) {
      console.error('Failed to connect to Spotify MCP:', error.message);
      throw error;
    }
  }

  /**
   * Disconnect from Spotify MCP server
   * @param {Object} connection - Connection object with client and process
   */
  async disconnect(connection) {
    if (connection) {
      try {
        if (connection.client) {
          await connection.client.close();
        }
      } catch (error) {
        console.error('Error disconnecting Spotify:', error.message);
      }
    }
  }

  /**
   * Get available tools from Spotify MCP
   * @param {Object} connection - Connection object with client
   * @returns {Promise<Array>} - List of available tools
   */
  async getTools(connection) {
    if (!connection || !connection.client) {
      return [];
    }

    try {
      const response = await connection.client.listTools();
      
      if (response.tools && response.tools.length > 0) {
        console.log(`   📋 Spotify: ${response.tools.length} tools`);
      }
      
      // Add a custom search and play tool
      const customTools = response.tools || [];
      customTools.push({
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
      });
      
      return customTools;
    } catch (error) {
      console.error('❌ Error getting Spotify tools:', error.message);
      return [];
    }
  }

  /**
   * Call a tool on the Spotify MCP server
   * @param {Object} connection - Connection object with client
   * @param {string} toolName - Name of the tool to call
   * @param {Object} args - Tool arguments
   * @returns {Promise<any>} - Tool result
   */
  async callTool(connection, toolName, args) {
    if (!connection || !connection.client) {
      throw new Error('Not connected to Spotify MCP');
    }

    try {
      // Handle custom search and play tool
      if (toolName === 'SpotifySearchAndPlay') {
        console.log(`🎵 SpotifySearchAndPlay: Searching for "${args.query}"`);
        
        // First, search for the song
        const searchResult = await connection.client.callTool({
          name: 'SpotifySearch',
          arguments: { qtype: 'track', query: args.query }
        });
        
        if (searchResult.isError) {
          console.error(`❌ Search failed: ${searchResult.content?.[0]?.text || 'Unknown error'}`);
          return searchResult;
        }
        
        // Extract track ID from search results
        let searchData;
        try {
          if (searchResult.content && searchResult.content[0] && searchResult.content[0].text) {
            searchData = JSON.parse(searchResult.content[0].text);
          } else if (searchResult.content && typeof searchResult.content === 'string') {
            searchData = JSON.parse(searchResult.content);
          } else {
            return {
              isError: true,
              content: 'Unexpected search result format'
            };
          }
        } catch (parseError) {
          return {
            isError: true,
            content: 'Failed to parse search results'
          };
        }
        
        if (!searchData.tracks || searchData.tracks.length === 0) {
          return {
            isError: true,
            content: 'No tracks found for the search query'
          };
        }
        
        const trackId = searchData.tracks[0].id;
        const trackName = searchData.tracks[0].name;
        
        // Handle both "artist" (singular) and "artists" (plural) formats
        let artistName;
        if (searchData.tracks[0].artist) {
          artistName = searchData.tracks[0].artist;
        } else if (searchData.tracks[0].artists && searchData.tracks[0].artists.length > 0) {
          artistName = searchData.tracks[0].artists[0];
        } else {
          artistName = 'Unknown Artist';
        }
        
        
        // Check if there's an active device and get current playback state
        const deviceResult = await connection.client.callTool({
          name: 'SpotifyPlayback',
          arguments: { 
            action: 'get'
          }
        });
        
        if (deviceResult.isError) {
          return {
            isError: true,
            content: `No active Spotify device found. Please open Spotify on a device and try again.`
          };
        }
        
        // Ensure playback is active (resume if paused)
        const resumeResult = await connection.client.callTool({
          name: 'SpotifyPlayback',
          arguments: { 
            action: 'resume'
          }
        });
        
        // Add the track to the queue
        const queueResult = await connection.client.callTool({
          name: 'SpotifyQueue',
          arguments: { 
            action: 'add',
            track_id: trackId
          }
        });
        
        if (queueResult.isError) {
          return {
            isError: true,
            content: `Failed to add track to queue: ${queueResult.content?.[0]?.text || 'Unknown error'}`
          };
        }
        
        // Wait a brief moment for queue to update
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Skip to the next track (our newly queued track) to play it immediately
        const skipResult = await connection.client.callTool({
          name: 'SpotifyPlayback',
          arguments: { 
            action: 'skip'
          }
        });
        
        if (skipResult.isError) {
          // If skip fails, try to play the track directly using track URI
          console.log(`⚠️ Skip failed, trying direct play with track URI...`);
          const directPlayResult = await connection.client.callTool({
            name: 'SpotifyPlayback',
            arguments: { 
              action: 'play',
              track_uri: `spotify:track:${trackId}`
            }
          });
          
          if (directPlayResult.isError) {
            return {
              isError: true,
              content: `Failed to play track: ${directPlayResult.content?.[0]?.text || 'Unknown error'}`
            };
          }
        }
        
        return {
          isError: false,
          content: `Now playing: ${trackName} by ${artistName}`
        };
      }
      
      // Handle regular tools
      const result = await connection.client.callTool({ 
        name: toolName, 
        arguments: args 
      });
      
      if (result.isError) {
        console.error(`❌ Spotify ${toolName}: ${result.content?.[0]?.text || 'Unknown error'}`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Error calling Spotify tool ${toolName}:`, error.message);
      throw error;
    }
  }

}

module.exports = SpotifyIntegration;

