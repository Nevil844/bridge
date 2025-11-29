/**
 * API Utility Functions
 * Handles authentication tokens and API request headers
 */

import { secureStorage } from './storage';

const ACCESS_TOKEN_KEY = 'google_access_token';
const TOKEN_CACHE_EXPIRY = 50 * 60 * 1000; // 50 minutes (tokens expire in ~1 hour)

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Get Google access token from secure storage or cache
 */
export async function getAccessToken(): Promise<string | null> {
  // Check cache first
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  // Get from secure storage
  const token = await secureStorage.getItem(ACCESS_TOKEN_KEY);
  
  if (token) {
    // Cache it (assume it expires in 50 minutes)
    tokenCache = {
      token,
      expiresAt: Date.now() + TOKEN_CACHE_EXPIRY,
    };
    return token;
  }

  return null;
}

/**
 * Store Google access token in secure storage
 */
export async function setAccessToken(token: string): Promise<void> {
  await secureStorage.setItem(ACCESS_TOKEN_KEY, token);
  
  // Update cache
  tokenCache = {
    token,
    expiresAt: Date.now() + TOKEN_CACHE_EXPIRY,
  };
}

/**
 * Clear stored access token
 */
export async function clearAccessToken(): Promise<void> {
  await secureStorage.removeItem(ACCESS_TOKEN_KEY);
  tokenCache = null;
}

/**
 * Fetch with automatic authentication
 * Automatically adds Authorization header with Google access token
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();
  
  if (!token) {
    throw new Error('No access token available. Please log in again.');
  }

  // Merge headers
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  
  // Add Content-Type if not present and body is provided
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

