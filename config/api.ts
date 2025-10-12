// API Configuration
// For iOS Simulator: use 'localhost'
// For Android Emulator: use '10.0.2.2'
// For Physical Device: use your computer's local IP address

// To find your IP:
// Mac/Linux: Run 'ipconfig getifaddr en0' in terminal
// Windows: Run 'ipconfig' and look for IPv4 Address

export const API_CONFIG = {
  // Change this to your machine's IP when using a physical device
  BASE_URL: 'http://192.168.1.61:3000',
  
  // Uncomment for iOS Simulator:
  // BASE_URL: 'http://localhost:3000',
  
  // Uncomment for Android Emulator:
  // BASE_URL: 'http://10.0.2.2:3000',
};

export const API_ENDPOINTS = {
  CHAT: `${API_CONFIG.BASE_URL}/api/chat`,
  MODELS: `${API_CONFIG.BASE_URL}/api/models`,
};

