/**
 * Credit Usage Service
 * Client-side service for fetching user credit usage and quota information
 * Credits are cost-based units (1 credit = $0.01)
 */

import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../utils/api';

export interface TokenUsage {
  userId: string;
  month: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number; // Raw token count (for reference)
  creditsUsed: number; // Credits consumed (primary metric for limits)
  plan: string;
  limit: number; // Credit limit
  remainingTokens: number; // Remaining credits
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
  // Use authenticated fetch - token is automatically added to headers
  const response = await authenticatedFetch(`${API_ENDPOINTS.USAGE}/${userId}?plan=${plan}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Usage API error:', errorText);
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
  // Use authenticated fetch - token is automatically added to headers
  const response = await authenticatedFetch(`${API_ENDPOINTS.USAGE}/${userId}/history?months=${months}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Usage history API error:', errorText);
    throw new Error('Failed to fetch usage history');
  }
  
  return await response.json();
}

/**
 * Get usage breakdown by model
 */
export async function getUserUsageByModel(userId: string): Promise<ModelUsage> {
  // Use authenticated fetch - token is automatically added to headers
  const response = await authenticatedFetch(`${API_ENDPOINTS.USAGE}/${userId}/by-model`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Usage by model API error:', errorText);
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
 * Format credit count for display (e.g., 1234.56 → "1,234.56")
 * Credits are typically smaller numbers, so we format with commas and 2 decimals
 */
export function formatTokenCount(credits: number): string {
  // For credits, show 2 decimal places if not whole number
  if (credits % 1 === 0) {
    return credits.toLocaleString(); // Whole number: "100"
  }
  return credits.toFixed(2); // Decimal: "123.45"
}

/**
 * Format credit count with label
 */
export function formatCredits(credits: number): string {
  return `${formatTokenCount(credits)} credits`;
}

