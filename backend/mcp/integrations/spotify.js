const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

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
   * Create Spotify cache file for spotipy
   * Uses project directory for EC2/pm2 compatibility
   */
  async createSpotifyCache(accessToken, refreshToken, userId) {
    // Try multiple locations in order of preference for EC2/pm2 compatibility
    const possibleDirs = [
      path.resolve(__dirname, '../../..', '.spotify-mcp-cache'), // Project directory
      path.join(os.homedir(), '.spotify-mcp-cache'),              // Home directory
      '/tmp/.spotify-mcp-cache',                                   // /tmp fallback
    ];
    
    let cacheDir;
    for (const dir of possibleDirs) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        // Test write access
        const testFile = path.join(dir, '.test-write');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        cacheDir = dir;
        break;
      } catch (e) {
        // Try next location
        continue;
      }
    }
    
    if (!cacheDir) {
      throw new Error('Could not create cache directory in any location');
    }

    const cacheFile = path.join(cacheDir, '.cache');
    
    const now = Math.floor(Date.now() / 1000);
    const cacheData = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: this.scopes,
      expires_at: now + 3600,
    };
    
    if (!cacheData.access_token || !cacheData.refresh_token) {
      throw new Error('Cache data missing required fields');
    }

    const cacheContent = JSON.stringify(cacheData);
    fs.writeFileSync(cacheFile, cacheContent, 'utf8');
    
    // Set permissions to be readable by Python process (world-readable)
    try {
      fs.chmodSync(cacheFile, 0o666); // rw-rw-rw-
      fs.chmodSync(cacheDir, 0o777);  // rwxrwxrwx (executable for directory traversal)
      console.log(`✅ Set cache permissions: file (0o666), dir (0o777)`);
    } catch (e) {
      console.log(`⚠️  Could not set cache permissions: ${e.message}`);
    }
    
    // Verify file exists and is readable
    if (!fs.existsSync(cacheFile)) {
      throw new Error(`Failed to create cache file: ${cacheFile}`);
    }
    
    // Verify we can read it back
    try {
      const testRead = fs.readFileSync(cacheFile, 'utf8');
      JSON.parse(testRead); // Verify it's valid JSON
    } catch (e) {
      throw new Error(`Cache file created but not readable: ${e.message}`);
    }
    
    const absoluteCacheFile = path.resolve(cacheFile);
    console.log(`✅ Cache file created: ${absoluteCacheFile}`);
    
    return absoluteCacheFile;
  }

  /**
   * Clean up any existing spotify-mcp processes
   */
  async cleanupProcesses() {
    try {
      const currentPid = process.pid;
      
      // Find spotify-mcp processes
      try {
        const { stdout } = await execAsync('pgrep -f "spotify-mcp" 2>/dev/null || true');
        const pids = stdout.trim().split('\n').filter(pid => {
          const pidNum = parseInt(pid);
          return pid && !isNaN(pidNum) && pidNum > 0 && pidNum !== currentPid;
        });

        if (pids.length > 0) {
          console.log(`🧹 Cleaning up ${pids.length} existing Spotify MCP process(es)...`);
          
          for (const pidStr of pids) {
            const pid = parseInt(pidStr);
            try {
              // Check if process exists
              process.kill(pid, 0);
              // Kill it
              process.kill(pid, 'SIGTERM');
            } catch (e) {
              // Process doesn't exist or already dead, ignore
            }
          }
          
          // Wait for processes to die
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (e) {
        // pgrep might not be available, that's okay
      }
    } catch (error) {
      // Cleanup errors are non-fatal
      console.log('Note: Process cleanup encountered an error (non-fatal)');
    }
  }

  /**
   * Validate and refresh token if needed
   */
  async ensureValidToken(accessToken, refreshToken) {
    if (!refreshToken || !this.clientId || !this.clientSecret) {
      return accessToken; // Can't refresh, return as-is
    }

    try {
      const SpotifyOAuth = require('../../oauth/integrations/spotify.js');
      const spotifyOAuth = new SpotifyOAuth();
      
      // Try to validate token with timeout
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
      return accessToken; // Fallback to existing token
    }
  }

  /**
   * Connect to Spotify MCP server
   */
  async connect(config) {
    if (!config || !config.token) {
      throw new Error('Spotify access token is required');
    }

    // Clean up any existing processes first
    await this.cleanupProcesses();

    // Decrypt token
    let accessToken;
    try {
      accessToken = this.decryptToken(config.token);
    } catch (decryptError) {
      // Try using token as-is if it looks valid
      if (config.token.startsWith('BQ') && config.token.length > 100) {
        accessToken = config.token;
      } else {
        throw new Error('Invalid token format');
      }
    }

    const refreshToken = config.refreshToken || '';
    const userId = config.userId || 'default-user';

    // Ensure token is valid before creating cache file
    const validToken = await this.ensureValidToken(accessToken, refreshToken);

    // Create cache file
    const cacheFile = await this.createSpotifyCache(validToken, refreshToken, userId);

    // Setup PATH for uvx
    const uvPath = path.join(os.homedir(), '.local', 'bin');
    const envPath = process.env.PATH || '';
    const newPath = `${uvPath}:${envPath}`;

    // Log environment for debugging (EC2/pm2)
    console.log(`🔧 Spotify MCP Environment:`);
    console.log(`   Cache file: ${cacheFile}`);
    console.log(`   HOME: ${os.homedir()}`);
    console.log(`   PWD: ${process.cwd()}`);
    console.log(`   User: ${process.env.USER || process.env.USERNAME || 'unknown'}`);

    // Create transport with all required environment variables
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
        SPOTIPY_CLIENT_ID: this.clientId,
        SPOTIPY_CLIENT_SECRET: this.clientSecret,
        SPOTIPY_REDIRECT_URI: 'https://api.bridge.neviljobanputra.com/api/oauth/callback',
        SPOTIPY_CACHE_PATH: cacheFile, // Absolute path to cache file
        HOME: os.homedir(),
        PWD: process.cwd(),
      },
    });

    // Create client
    const client = new Client(
      {
        name: 'bridge-ai-spotify',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Connect with timeout
    try {
      console.log(`🔌 Connecting to Spotify MCP server...`);
      await Promise.race([
        client.connect(transport),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 30000)
        )
      ]);
      console.log(`✅ Connected to Spotify MCP server`);
    } catch (error) {
      console.error(`❌ Connection failed: ${error.message}`);
      try {
        await this.cleanupProcesses();
      } catch (e) {
        // Ignore cleanup errors
      }
      throw error;
    }

    return {
      client,
      transport,
      token: config.token,
      refreshToken: config.refreshToken,
      process: transport.process,
    };
  }

  /**
   * Disconnect from Spotify MCP server
   */
  async disconnect(connection) {
    if (!connection) return;

    try {
      // Kill process if available
      if (connection.process && !connection.process.killed) {
        try {
          connection.process.kill('SIGTERM');
          setTimeout(() => {
            try {
              if (connection.process && !connection.process.killed) {
                connection.process.kill('SIGKILL');
              }
            } catch (e) {
              // Ignore
            }
          }, 2000);
        } catch (e) {
          // Ignore
        }
      }

      // Close client
      if (connection.client) {
        try {
          await connection.client.close();
        } catch (e) {
          // Ignore
        }
      }

      // Close transport
      if (connection.transport && typeof connection.transport.close === 'function') {
        try {
          await connection.transport.close();
        } catch (e) {
          // Ignore
        }
      }
    } catch (error) {
      console.error('Error disconnecting Spotify:', error.message);
    }
  }

  /**
   * Get available tools from Spotify MCP
   */
  async getTools(connection) {
    if (!connection || !connection.client) {
      return [];
    }

    try {
      const response = await connection.client.listTools();
      const tools = response.tools || [];
      
      // Add custom search and play tool
      tools.push({
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
      
      return tools;
    } catch (error) {
      console.error('❌ Error getting Spotify tools:', error.message);
      return [];
    }
  }

  /**
   * Call a tool on the Spotify MCP server
   */
  async callTool(connection, toolName, args) {
    if (!connection || !connection.client) {
      throw new Error('Not connected to Spotify MCP');
    }

    try {
      // Handle custom search and play tool
      if (toolName === 'SpotifySearchAndPlay') {
        return await this.handleSearchAndPlay(connection, args);
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

  /**
   * Handle the custom SpotifySearchAndPlay tool
   */
  async handleSearchAndPlay(connection, args) {
    console.log(`🎵 SpotifySearchAndPlay: Searching for "${args.query}"`);
    
    // Search for the song
    const searchResult = await connection.client.callTool({
      name: 'SpotifySearch',
      arguments: { qtype: 'track', query: args.query }
    });
    
    if (searchResult.isError) {
      return {
        isError: true,
        content: searchResult.content?.[0]?.text || 'Search failed'
      };
    }
    
    // Parse search results
    let searchData;
    try {
      const contentText = searchResult.content?.[0]?.text || 
                         (typeof searchResult.content === 'string' ? searchResult.content : '{}');
      searchData = JSON.parse(contentText);
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
    
    const track = searchData.tracks[0];
    const trackId = track.id;
    const trackName = track.name;
    const artistName = track.artist || 
                      (track.artists && track.artists[0]) || 
                      'Unknown Artist';
    
    // Check for active device
    const deviceResult = await connection.client.callTool({
      name: 'SpotifyPlayback',
      arguments: { action: 'get' }
    });
    
    if (deviceResult.isError) {
      return {
        isError: true,
        content: 'No active Spotify device found. Please open Spotify on a device and try again.'
      };
    }
    
    // Resume playback if paused
    await connection.client.callTool({
      name: 'SpotifyPlayback',
      arguments: { action: 'resume' }
    });
    
    // Add track to queue
    const queueResult = await connection.client.callTool({
      name: 'SpotifyQueue',
      arguments: { action: 'add', track_id: trackId }
    });
    
    if (queueResult.isError) {
      return {
        isError: true,
        content: `Failed to add track to queue: ${queueResult.content?.[0]?.text || 'Unknown error'}`
      };
    }
    
    // Wait for queue to update
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Skip to next track (the one we just queued)
    const skipResult = await connection.client.callTool({
      name: 'SpotifyPlayback',
      arguments: { action: 'skip' }
    });
    
    if (skipResult.isError) {
      // Try direct play as fallback
      const playResult = await connection.client.callTool({
        name: 'SpotifyPlayback',
        arguments: { action: 'play', track_uri: `spotify:track:${trackId}` }
      });
      
      if (playResult.isError) {
        return {
          isError: true,
          content: `Failed to play track: ${playResult.content?.[0]?.text || 'Unknown error'}`
        };
      }
    }
    
    return {
      isError: false,
      content: `Now playing: ${trackName} by ${artistName}`
    };
  }
}

module.exports = SpotifyIntegration;
