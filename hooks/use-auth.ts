import { API_ENDPOINTS } from '@/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  plan?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasLoggedOut, setHasLoggedOut] = useState(false);

  // Load user from storage on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      setIsLoading(true);
      
      // Check if user has explicitly logged out (persisted in storage)
      const loggedOutFlag = await AsyncStorage.getItem('hasLoggedOut');
      const hasExplicitlyLoggedOut = loggedOutFlag === 'true';
      
      if (hasExplicitlyLoggedOut) {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }
      
      // First, check if there's a stored user ID
      const storedUserId = await AsyncStorage.getItem('userId');
      
      // If user ID exists and is not default-user, use it (normal flow)
      if (storedUserId && storedUserId !== 'default-user') {
        // Fetch access token first
        try {
          const { setAccessToken } = require('@/utils/api');
          const tokenResponse = await fetch(`${API_ENDPOINTS.AUTH.TOKEN}?userId=${storedUserId}`);
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            if (tokenData.accessToken) {
              await setAccessToken(tokenData.accessToken);
            }
          }
        } catch (error) {
          // Ignore token fetch errors
        }
        
        // Fetch user info from backend
        const response = await fetch(`${API_ENDPOINTS.AUTH.ME}?userId=${storedUserId}`);
        
        if (response.ok) {
          const userData = await response.json();
          setUser({
            id: userData.id,
            email: userData.email,
            name: userData.username || userData.email,
            picture: userData.picture || undefined,
            plan: userData.plan || 'free',
          });
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        } else {
          // User not found, clear storage
          await AsyncStorage.removeItem('userId');
          const { clearAccessToken } = require('@/utils/api');
          await clearAccessToken();
          setUser(null);
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }
      }
      
      // TEST MODE: Auto-login with existing user for mobile testing
      // Only runs if NO userId in storage AND user hasn't explicitly logged out
      // Platform-specific test emails: iOS = nevil, Android = kushal
      const TEST_MODE_EMAIL = Platform.OS === 'ios' 
        ? 'neviljobanputra34@gmail.com' 
        : Platform.OS === 'android' 
        ? 'kushalnandha26@gmail.com' 
        : null;
      
      if (TEST_MODE_EMAIL && !storedUserId && !hasExplicitlyLoggedOut) {
        // Fetch user by email from backend
        const response = await fetch(`${API_ENDPOINTS.AUTH.ME}?userId=${TEST_MODE_EMAIL}`);
        
        if (response.ok) {
          const userData = await response.json();
          
          // Store user ID for future use
          await AsyncStorage.setItem('userId', userData.id);
          
          // Fetch and store access token
          try {
            const { setAccessToken } = require('@/utils/api');
            const tokenResponse = await fetch(`${API_ENDPOINTS.AUTH.TOKEN}?userId=${userData.id}`);
            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              if (tokenData.accessToken) {
                await setAccessToken(tokenData.accessToken);
              }
            }
          } catch (error) {
            // Ignore token fetch errors
          }
          
          setUser({
            id: userData.id,
            email: userData.email,
            name: userData.username || userData.email,
            picture: userData.picture || undefined,
            plan: userData.plan || 'free',
          });
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
      } else {
          console.warn('⚠️ Test user not found in database');
        }
      }
      
      // No user found - show login screen
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error loading user:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (userData: User) => {
    try {
      // Store user ID
      await AsyncStorage.setItem('userId', userData.id);
      // Clear logout flag on successful login
      await AsyncStorage.removeItem('hasLoggedOut');
      setUser(userData);
      setIsAuthenticated(true);
      setHasLoggedOut(false);
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('userId');
      // Clear access token
      const { clearAccessToken } = require('@/utils/api');
      await clearAccessToken();
      // Persist logout flag so test mode doesn't auto-login again
      await AsyncStorage.setItem('hasLoggedOut', 'true');
      setUser(null);
      setIsAuthenticated(false);
      setHasLoggedOut(true);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    reload: loadUser,
  };
}

