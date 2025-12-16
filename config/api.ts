// API Configuration
// For iOS Simulator: use 'localhost' or '127.0.0.1'
// For Android Emulator: use '10.0.2.2'
// For Physical Device: use your computer's local IP address

// To find your IP:
// Mac/Linux: Run 'ipconfig getifaddr en0' in terminal
// Windows: Run 'ipconfig' and look for IPv4 Address

// UPDATE THIS WITH YOUR COMPUTER'S IP ADDRESS
const NETWORK_IP = '192.168.1.88'; // Replace with your actual IP!

export const API_CONFIG = {
  // BASE_URL: `http://${NETWORK_IP}:3000`,  // For physical iOS device
  BASE_URL: 'https://api.bridge.neviljobanputra.com',  // For production
  
  // Alternatives (uncomment if needed):
  // BASE_URL: 'http://localhost:3000',      // For web browser
  // BASE_URL: 'http://127.0.0.1:3000',      // For iOS Simulator
  // BASE_URL: 'http://10.0.2.2:3000',       // For Android Emulator
};

// Helper to convert HTTP URL to WebSocket URL
export const getWebSocketUrl = (httpUrl: string): string => {
  if (httpUrl.startsWith('https://')) {
    return httpUrl.replace('https://', 'wss://');
  } else if (httpUrl.startsWith('http://')) {
    return httpUrl.replace('http://', 'ws://');
  }
  return httpUrl;
};

export const API_ENDPOINTS = {
  CHAT: `${API_CONFIG.BASE_URL}/api/chat`,
  get CHAT_WS() {
    return getWebSocketUrl(`${API_CONFIG.BASE_URL}/api/chat/stream`);
  },
  get TRANSCRIBE_WS() {
    return getWebSocketUrl(`${API_CONFIG.BASE_URL}/api/transcribe/stream`);
  },
  CHAT_TOOL_APPROVAL: `${API_CONFIG.BASE_URL}/api/chat/tools/approval`,
  MODELS: `${API_CONFIG.BASE_URL}/api/models`,
  MCP_STATUS: `${API_CONFIG.BASE_URL}/api/mcp/status`,
  INTEGRATIONS: `${API_CONFIG.BASE_URL}/api/integrations`,
  CONVERSATIONS: `${API_CONFIG.BASE_URL}/api/conversations`,
  USER_INTEGRATIONS: `${API_CONFIG.BASE_URL}/api/user-integrations`,
  USAGE: `${API_CONFIG.BASE_URL}/api/usage`,
  AUTH: {
    GOOGLE_URL: `${API_CONFIG.BASE_URL}/api/auth/google/url`,
    GOOGLE_CALLBACK: `${API_CONFIG.BASE_URL}/api/auth/google/callback`,
    GOOGLE_SESSION: `${API_CONFIG.BASE_URL}/api/auth/google/session`,
    ME: `${API_CONFIG.BASE_URL}/api/auth/me`,
    TOKEN: `${API_CONFIG.BASE_URL}/api/auth/token`,
    DELETE_ACCOUNT: `${API_CONFIG.BASE_URL}/api/auth/account`,
  },
  WAITLIST: `${API_CONFIG.BASE_URL}/api/waitlist`,
  SAMPLE_QUESTIONS: `${API_CONFIG.BASE_URL}/api/sample-questions`,
};

