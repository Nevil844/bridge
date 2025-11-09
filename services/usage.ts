/**
 * Token Usage Service
 * Client-side service for fetching user token usage and quota information
 */

import { API_ENDPOINTS } from '../config/api';

export interface TokenUsage {
  userId: string;
  month: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  plan: string;
  limit: number;
  remainingTokens: number;
  usagePercentage: string;
  warningLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  isOverLimit: boolean;
}

export interface UsageHistory {
  userId: string;
  history: {
    month: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    models: {
      model: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    }[];
  }[];
}

export interface ModelUsage {
  userId: string;
  month: string;
  models: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    percentage: string;
  }[];
  totalTokens: number;
}

/**
 * Get current month's token usage for a user
 */
export async function getUserUsage(userId: string, plan: string = 'free'): Promise<TokenUsage> {
  const response = await fetch(`${API_ENDPOINTS.USAGE}/${userId}?plan=${plan}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch usage data');
  }
  
  return await response.json();
}

/**
 * Get usage history (last N months)
 */
export async function getUserUsageHistory(
  userId: string, 
  months: number = 6
): Promise<UsageHistory> {
  const response = await fetch(`${API_ENDPOINTS.USAGE}/${userId}/history?months=${months}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch usage history');
  }
  
  return await response.json();
}

/**
 * Get usage breakdown by model
 */
export async function getUserUsageByModel(userId: string): Promise<ModelUsage> {
  const response = await fetch(`${API_ENDPOINTS.USAGE}/${userId}/by-model`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch usage by model');
  }
  
  return await response.json();
}

/**
 * Get warning color based on usage percentage
 */
export function getWarningColor(warningLevel: string): string {
  switch (warningLevel) {
    case 'critical':
      return '#ff4444'; // Red
    case 'high':
      return '#ff8800'; // Orange
    case 'medium':
      return '#ffaa00'; // Yellow
    case 'low':
      return '#4a9eff'; // Blue
    default:
      return '#4caf50'; // Green
  }
}

/**
 * Format token count for display (e.g., 1234567 → "1.23M")
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

